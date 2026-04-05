import { Client, ClientChannel } from 'ssh2';
import { SshServerConfig, SshConnectionStatus, SshServerMetrics } from './types';

// Shell command executed on the remote host to collect all metrics.
// Output lines are prefixed with a marker token for reliable parsing.
// CPU: two /proc/stat reads 0.5 s apart → CPU delta.
// MEM: /proc/meminfo (values in kB).
// DISK: df -B1, only real block-device mount-points (/dev/...).
// PROC: ps aux sorted by CPU, top 10 processes.
// ENERGY: Intel RAPL power_uw file (Linux only, optional).
const METRICS_CMD =
  "S1=$(awk 'NR==1{s=0;for(i=2;i<=NF;i++)s+=$i;print s,$5}' /proc/stat 2>/dev/null); " +
  "sleep 0.5; " +
  "S2=$(awk 'NR==1{s=0;for(i=2;i<=NF;i++)s+=$i;print s,$5}' /proc/stat 2>/dev/null); " +
  'echo "CPU $S1 | $S2"; ' +
  "awk '/^MemTotal:/{t=$2}/^MemFree:/{f=$2}/^MemAvailable:/{a=$2}" +
    "END{if(t)print \"MEM\",t,f,(a?a:f)}' /proc/meminfo 2>/dev/null; " +
  "df -B1 2>/dev/null | awk 'NR>1 && $1~/^\\/dev\\// {print \"DISK\",$1,$2,$3,$6}'; " +
  "ps aux --sort=-%cpu 2>/dev/null | " +
    "awk 'NR>1&&NR<=11{cmd=\"\";for(i=11;i<=NF;i++)cmd=cmd\" \"$i;" +
    "gsub(/[|]/,\"_\",cmd);printf \"PROC|%s|%s|%s|%s|%s\\n\",$1,$2,$3,$4,substr(cmd,2,50)}'; " +
  "(cat /sys/class/powercap/intel-rapl:0/power_uw 2>/dev/null | " +
    "awk '{printf \"ENERGY %.2fW\\n\",$1/1000000}') 2>/dev/null || echo 'ENERGY N/A'";

interface ConnectionEntry {
  client: Client;
  config: SshServerConfig;
  password: string;
  status: SshConnectionStatus;
  errorMessage?: string;
}

export class SshMonitor {
  private connections: Map<string, ConnectionEntry> = new Map();

  /**
   * Establishes (or re-establishes) an SSH connection for the given server.
   * The instance stores the password so it can auto-reconnect on disconnect.
   */
  connect(config: SshServerConfig, password: string): void {
    this.disconnect(config.id);

    const entry: ConnectionEntry = {
      client: new Client(),
      config,
      password,
      status: 'connecting',
    };
    this.connections.set(config.id, entry);

    this._doConnect(entry);
  }

  private _doConnect(entry: ConnectionEntry): void {
    const { config, password } = entry;

    entry.client = new Client();
    entry.status = 'connecting';
    entry.errorMessage = undefined;

    entry.client.on('ready', () => {
      entry.status = 'connected';
      entry.errorMessage = undefined;
    });

    entry.client.on('error', (err) => {
      entry.status = 'error';
      entry.errorMessage = err.message;
      // Schedule auto-reconnect
      this._scheduleReconnect(entry, 15000);
    });

    entry.client.on('close', () => {
      if (entry.status === 'connected') {
        entry.status = 'disconnected';
        this._scheduleReconnect(entry, 10000);
      }
    });

    entry.client.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password,
      readyTimeout: 15000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    });
  }

  private _scheduleReconnect(entry: ConnectionEntry, delayMs: number): void {
    setTimeout(() => {
      if (this.connections.has(entry.config.id)) {
        this._doConnect(entry);
      }
    }, delayMs);
  }

  /** Closes the connection for the given server ID and removes it from the map. */
  disconnect(id: string): void {
    const entry = this.connections.get(id);
    if (entry) {
      try { entry.client.end(); } catch (_) { /* ignore */ }
      this.connections.delete(id);
    }
  }

  /** Closes all active connections. */
  disconnectAll(): void {
    for (const id of [...this.connections.keys()]) {
      this.disconnect(id);
    }
  }

  /** Returns the current connection status for a server. */
  getStatus(id: string): SshConnectionStatus {
    return this.connections.get(id)?.status ?? 'disconnected';
  }

  /** Executes the metrics command on a connected server and returns parsed results. */
  async collectMetrics(config: SshServerConfig): Promise<SshServerMetrics> {
    const entry = this.connections.get(config.id);

    if (!entry || entry.status !== 'connected') {
      return {
        id: config.id,
        config,
        status: entry?.status ?? 'disconnected',
        errorMessage: entry?.errorMessage,
      };
    }

    try {
      const output = await this._execCommand(entry.client, METRICS_CMD);
      return { id: config.id, config, status: 'connected', ...parseMetricsOutput(output) };
    } catch (err: any) {
      return {
        id: config.id,
        config,
        status: 'error',
        errorMessage: err.message ?? 'Unknown error',
      };
    }
  }

  private _execCommand(client: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Command timed out')), 12000);

      client.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        let output = '';
        stream.on('data', (data: Buffer) => { output += data.toString(); });
        stream.stderr.on('data', (_data: Buffer) => { /* ignore */ });
        stream.on('close', () => { clearTimeout(timer); resolve(output); });
        stream.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
      });
    });
  }
}

// ─── Output parser ────────────────────────────────────────────────────────────

function parseMetricsOutput(raw: string): Partial<SshServerMetrics> {
  const lines = raw.split('\n');

  let cpuUsage: number | undefined;
  let ram: SshServerMetrics['ram'];
  const disks: NonNullable<SshServerMetrics['disks']> = [];
  const processes: NonNullable<SshServerMetrics['processes']> = [];
  let energy: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { continue; }

    if (line.startsWith('CPU ')) {
      // "CPU total1 idle1 | total2 idle2"
      const m = line.match(/^CPU (\d+) (\d+) \| (\d+) (\d+)/);
      if (m) {
        const totalDiff = parseInt(m[3]) - parseInt(m[1]);
        const idleDiff  = parseInt(m[4]) - parseInt(m[2]);
        if (totalDiff > 0) {
          cpuUsage = Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 1000) / 10));
        } else {
          cpuUsage = 0;
        }
      }

    } else if (line.startsWith('MEM ')) {
      // "MEM totalKB freeKB availableKB"
      const parts = line.split(' ');
      if (parts.length >= 4) {
        const totalBytes = parseInt(parts[1]) * 1024;
        const availBytes = parseInt(parts[3]) * 1024;
        const usedBytes  = Math.max(0, totalBytes - availBytes);
        ram = {
          totalBytes,
          usedBytes,
          usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        };
      }

    } else if (line.startsWith('DISK ')) {
      // "DISK device totalBytes usedBytes mountpoint"
      const parts = line.split(' ');
      if (parts.length >= 5) {
        const totalBytes = parseInt(parts[2]);
        const usedBytes  = parseInt(parts[3]);
        disks.push({
          device: parts[1],
          mountpoint: parts[4],
          totalBytes,
          usedBytes,
          usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
        });
      }

    } else if (line.startsWith('PROC|')) {
      // "PROC|user|pid|cpu%|mem%|command"
      const parts = line.split('|');
      if (parts.length >= 6) {
        processes.push({
          user:       parts[1],
          pid:        parseInt(parts[2]) || 0,
          cpuPercent: parseFloat(parts[3]) || 0,
          memPercent: parseFloat(parts[4]) || 0,
          command:    parts[5].trim(),
        });
      }

    } else if (line.startsWith('ENERGY ')) {
      const val = line.slice(7).trim();
      if (val && val !== 'N/A') {
        energy = val;
      }
    }
  }

  return {
    cpu:       cpuUsage !== undefined ? { usagePercent: cpuUsage } : undefined,
    ram,
    disks:     disks.length     > 0 ? disks     : undefined,
    processes: processes.length > 0 ? processes : undefined,
    energy,
    timestamp: Date.now(),
  };
}

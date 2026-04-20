import { Client, ClientChannel } from 'ssh2';
import { DockerContainerAction, DockerContainerMetrics, SshServerConfig, SshConnectionStatus, SshServerMetrics } from './types';

// Shell command executed on the remote Linux/macOS host to collect all metrics at once.
// Each output line is prefixed with a unique marker for reliable parsing:
//   CPU  <total1> <idle1> | <total2> <idle2>   (two /proc/stat reads 0.5 s apart)
//   NET  <rx1> <tx1> | <rx2> <tx2>              (/proc/net/dev reads 0.5 s apart)
//   MEM  <totalKB> <freeKB> <availKB>           (/proc/meminfo)
//   DISK <device> <totalB> <usedB> <mountpoint> (df -B1, /dev/* only)
//   PROC|<user>|<pid>|<cpu%>|<mem%>|<cmd>       (ps aux, top 10 by CPU)
//   ENERGY <N.NNW>|N/A                           (Intel RAPL power_uw, optional)
const METRICS_CMD_LINUX = [
  "S1=$(awk 'NR==1{s=0;for(i=2;i<=NF;i++)s+=$i;print s,$5}' /proc/stat 2>/dev/null)",
  "N1=$(awk -F'[: ]+' '$1 !~ /lo/ && NF>=11 {rx+=$3; tx+=$11} END {print rx+0, tx+0}' /proc/net/dev 2>/dev/null)",
  "sleep 0.5",
  "S2=$(awk 'NR==1{s=0;for(i=2;i<=NF;i++)s+=$i;print s,$5}' /proc/stat 2>/dev/null)",
  "N2=$(awk -F'[: ]+' '$1 !~ /lo/ && NF>=11 {rx+=$3; tx+=$11} END {print rx+0, tx+0}' /proc/net/dev 2>/dev/null)",
  'echo "CPU $S1 | $S2"',
  'echo "NET $N1 | $N2"',
  "awk '/^MemTotal:/{t=$2}/^MemFree:/{f=$2}/^MemAvailable:/{a=$2}" +
    "END{if(t)print \"MEM\",t,f,(a?a:f)}' /proc/meminfo 2>/dev/null",
  "df -B1 2>/dev/null | awk 'NR>1 && $1~/^\\/dev\\// {print \"DISK\",$1,$2,$3,$6}'",
  "ps aux --sort=-%cpu 2>/dev/null | " +
    "awk 'NR>1&&NR<=11{cmd=\"\";for(i=11;i<=NF;i++)cmd=cmd\" \"$i;" +
    "gsub(/[|]/,\"_\",cmd);printf \"PROC|%s|%s|%s|%s|%s\\n\",$1,$2,$3,$4,substr(cmd,2,50)}'",
  "(cat /sys/class/powercap/intel-rapl:0/power_uw 2>/dev/null | " +
    "awk '{printf \"ENERGY %.2fW\\n\",$1/1000000}') 2>/dev/null || echo 'ENERGY N/A'",
].join("; ");

function buildLinuxDockerQueryCommand(dockerPrefix: string): string {
  const psFormat = 'DOCKERPS|{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Size}}|-|-';
  const psFormat2 = 'DOCKERPS|{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|-|-|-';
  const stFormat = 'DOCKERST|{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}';

  return [
    "export PATH=\"$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/snap/bin:/opt/homebrew/bin\"",
    "echo DOCKER_AVAILABLE",
    `if ${dockerPrefix} ps -a --size --format '${psFormat}' 2>/dev/null; then true; elif ${dockerPrefix} ps -a --format '${psFormat2}' 2>/dev/null; then true; else echo DOCKER_ERROR\\|docker-ps-failed; fi`,
    `${dockerPrefix} stats --no-stream --format '${stFormat}' 2>/dev/null || true`,
  ].join('; ');
}

// PowerShell command executed on the remote Windows host (via SSH / OpenSSH for Windows).
// It is wrapped with an explicit powershell invocation so it works even if SSH default shell is CMD.
const METRICS_PS_SCRIPT_WINDOWS = [
  // CPU: locale-independent via CIM
  "$cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average",
  "Write-Output ('CPU WIN ' + [math]::Round($cpu,1))",
  // NET: bytes/sec via adapter statistics delta over 0.5s
  "$n1=Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes -Sum",
  "$m1=Get-NetAdapterStatistics | Measure-Object -Property SentBytes -Sum",
  "$rx1=if($n1.Sum){[double]$n1.Sum}else{0}",
  "$tx1=if($m1.Sum){[double]$m1.Sum}else{0}",
  "Start-Sleep -Milliseconds 500",
  "$n2=Get-NetAdapterStatistics | Measure-Object -Property ReceivedBytes -Sum",
  "$m2=Get-NetAdapterStatistics | Measure-Object -Property SentBytes -Sum",
  "$rx2=if($n2.Sum){[double]$n2.Sum}else{0}",
  "$tx2=if($m2.Sum){[double]$m2.Sum}else{0}",
  "$rxps=[math]::Max(0,[math]::Round(($rx2-$rx1)*2,0))",
  "$txps=[math]::Max(0,[math]::Round(($tx2-$tx1)*2,0))",
  "Write-Output ('NET ' + $rxps + ' ' + $txps)",
  // RAM: via CIM
  "$os=Get-CimInstance Win32_OperatingSystem",
  "Write-Output ('MEM ' + ($os.TotalVisibleMemorySize) + ' 0 ' + ($os.FreePhysicalMemory))",
  // Disks: via Get-PSDrive (filesystem drives only)
  "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object { $t=$_.Used+$_.Free; Write-Output ('DISK ' + $_.Root + ' ' + $t + ' ' + $_.Used + ' ' + $_.Root) }",
  // Top processes by CPU time; username may be unavailable for some processes
  "Get-Process -IncludeUserName | Sort-Object CPU -Descending | Select-Object -First 10 | ForEach-Object { $cmd=$_.Name -replace '[|]','_'; $u = if ($_.UserName) { $_.UserName } else { 'N/A' }; Write-Output ('PROC|' + $u + '|' + $_.Id + '|' + [math]::Round($_.CPU,1) + '|0|' + $cmd) }",
].join('; ');

const METRICS_CMD_WINDOWS =
  'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' +
  METRICS_PS_SCRIPT_WINDOWS.replace(/"/g, '\\"') +
  '"';

// PowerShell snippet shared by all Windows Docker commands.
// Discovers the working Docker invocation and sets:
//   $de   = path to docker.exe (or $null for WSL mode)
//   $dh   = named-pipe host string (or $null for direct/wsl)
//   $mode = 'direct' | 'pipe' | 'wsl' | 'none'
// Strategy: direct PATH → Docker Desktop named pipes → WSL docker
const DOCKER_WIN_DISCOVERY_PS = [
  "$de=$null; $dh=$null; $mode='none'",
  "$_dg=Get-Command docker -ErrorAction SilentlyContinue",
  "if ($_dg) { $de=$_dg.Source } elseif (Test-Path 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe') { $de='C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' }",
  // Test direct connection (daemon accessible via default named pipe)
  "if ($de) { & $de version 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $mode='direct' } }",
  // Try Docker Desktop named pipes: Linux-engine first, then Windows-engine
  "if ($mode -ne 'direct' -and $de) { foreach ($p in @('npipe:////./pipe/dockerDesktopLinuxEngine','npipe:////./pipe/docker_engine')) { & $de -H $p version 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $dh=$p; $mode='pipe'; break } } }",
  // WSL fallback: useful when Docker Desktop uses WSL2 backend and SSH session has WSL access
  "if ($mode -eq 'none') { if (Get-Command wsl -ErrorAction SilentlyContinue) { wsl -e docker version 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $mode='wsl' } } }",
].join('; ');

const DOCKER_PS_SCRIPT_WINDOWS = [
  DOCKER_WIN_DISCOVERY_PS,
  "$psfmt='DOCKERPS|{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Size}}|-|-'",
  "$psfmt2='DOCKERPS|{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|-|-|-'",
  "$stfmt='DOCKERST|{{.ID}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}'",
  "if ($mode -eq 'none') { Write-Output 'DOCKER_UNAVAILABLE' }",
  "if ($mode -ne 'none') { Write-Output 'DOCKER_AVAILABLE' }",
  "if ($mode -eq 'direct') { & $de ps -a --size --format $psfmt 2>$null; if ($LASTEXITCODE -ne 0) { & $de ps -a --format $psfmt2 }; & $de stats --no-stream --format $stfmt 2>$null }",
  "if ($mode -eq 'pipe') { & $de -H $dh ps -a --size --format $psfmt 2>$null; if ($LASTEXITCODE -ne 0) { & $de -H $dh ps -a --format $psfmt2 }; & $de -H $dh stats --no-stream --format $stfmt 2>$null }",
  "if ($mode -eq 'wsl') { wsl -e docker ps -a --size --format $psfmt 2>$null; if ($LASTEXITCODE -ne 0) { wsl -e docker ps -a --format $psfmt2 }; wsl -e docker stats --no-stream --format $stfmt 2>$null }",
].join('; ');

const DOCKER_CMD_WINDOWS =
  'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' +
  DOCKER_PS_SCRIPT_WINDOWS.replace(/"/g, '\\"') +
  '"';

const DOCKER_DIAG_CMD_LINUX = [
  "echo '== docker-path =='",
  "(command -v docker || echo 'docker-not-found') 2>&1",
  "echo '== id-groups =='",
  "(id 2>&1 || true)",
  "(groups 2>&1 || true)",
  "echo '== docker-version =='",
  "(docker version 2>&1 || sudo -n docker version 2>&1 || echo 'docker-version-failed')",
  "echo '== docker-ps =='",
  "(docker ps -a 2>&1 || sudo -n docker ps -a 2>&1 || echo 'docker-ps-failed')",
  "echo '== docker-info =='",
  "(docker info 2>&1 || sudo -n docker info 2>&1 || echo 'docker-info-failed')",
].join('; ');

const DOCKER_DIAG_PS_WINDOWS = [
  "Write-Output '== docker-discovery =='",
  DOCKER_WIN_DISCOVERY_PS,
  "if ($de) { Write-Output ('docker-exe: '+$de) } else { Write-Output 'docker-exe: not-found' }",
  "if ($dh) { Write-Output ('named-pipe: '+$dh) }",
  "Write-Output ('connection-mode: '+$mode)",
  "Write-Output '== whoami =='",
  "whoami 2>$null",
  "Write-Output '== docker-version =='",
  "if ($mode -eq 'direct') { & $de version 2>&1 }",
  "if ($mode -eq 'pipe') { & $de -H $dh version 2>&1 }",
  "if ($mode -eq 'wsl') { wsl -e docker version 2>&1 }",
  "if ($mode -eq 'none') { Write-Output 'docker-version-failed: no working connection found' }",
  "Write-Output '== docker-ps =='",
  "if ($mode -eq 'direct') { & $de ps -a 2>&1 }",
  "if ($mode -eq 'pipe') { & $de -H $dh ps -a 2>&1 }",
  "if ($mode -eq 'wsl') { wsl -e docker ps -a 2>&1 }",
  "if ($mode -eq 'none') { Write-Output 'docker-ps-failed' }",
  "Write-Output '== docker-info =='",
  "if ($mode -eq 'direct') { & $de info 2>&1 }",
  "if ($mode -eq 'pipe') { & $de -H $dh info 2>&1 }",
  "if ($mode -eq 'wsl') { wsl -e docker info 2>&1 }",
  "if ($mode -eq 'none') { Write-Output 'docker-info-failed' }",
].join('; ');

const DOCKER_DIAG_CMD_WINDOWS =
  'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "' +
  DOCKER_DIAG_PS_WINDOWS.replace(/"/g, '\\"') +
  '"';

/** Timeout for a single remote command execution (ms). */
const COMMAND_TIMEOUT_MS = 15000;

interface ConnectionEntry {
  client: Client;
  config: SshServerConfig;
  password: string;
  status: SshConnectionStatus;
  errorMessage?: string;
}

export type OnStatusChange = (id: string, status: SshConnectionStatus, errorMessage?: string) => void;

export class SshMonitor {
  private onStatusChange?: OnStatusChange;
  private connections: Map<string, ConnectionEntry> = new Map();
  // Active streams for container logs: key = `${serverId}:${containerId}`
  private logStreams: Map<string, ClientChannel> = new Map();
  // Active terminal PTY streams for container exec: key = `${serverId}:${containerId}`
  private terminalStreams: Map<string, ClientChannel> = new Map();

  /**
   * Set a callback to be notified when SSH connection status changes.
   */
  setOnStatusChange(cb: OnStatusChange): void {
    this.onStatusChange = cb;
  }

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
      if (this.onStatusChange) this.onStatusChange(config.id, 'connected', undefined);
    });

    entry.client.on('error', (err) => {
      entry.status = 'error';
      entry.errorMessage = err.message;
      if (this.onStatusChange) this.onStatusChange(config.id, 'error', err.message);
      // Schedule auto-reconnect
      this._scheduleReconnect(entry, 15000);
    });

    entry.client.on('close', () => {
      if (entry.status === 'connected') {
        entry.status = 'disconnected';
        if (this.onStatusChange) this.onStatusChange(config.id, 'disconnected', undefined);
        this._scheduleReconnect(entry, 10000);
      }
    });

    try {
      entry.client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password,
        readyTimeout: 15000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      });
    } catch (err: any) {
      entry.status = 'error';
      entry.errorMessage = err.message;
      this._scheduleReconnect(entry, 15000);
    }
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

  /** Returns the error message for a server if status is 'error'. */
  getErrorMessage(id: string): string | undefined {
    const entry = this.connections.get(id);
    return entry?.status === 'error' ? entry.errorMessage : undefined;
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
      const isWindows = config.osType === 'windows';
      const baseCmd = isWindows ? METRICS_CMD_WINDOWS : METRICS_CMD_LINUX;

      const baseOutput = await this._execCommand(entry.client, baseCmd);
      const baseParsed = parseMetricsOutput(baseOutput, isWindows);

      let dockerInfo: SshServerMetrics['docker'] = {
        available: false,
        errorMessage: 'Docker indisponível',
        containers: [],
      };

      try {
        const dockerCmd = isWindows
          ? DOCKER_CMD_WINDOWS
          : buildLinuxDockerQueryCommand(await this.resolveLinuxDockerPrefix(entry.client, entry.password).catch(() => 'docker'));
        const dockerOutput = await this._execCommand(entry.client, dockerCmd);
        const dockerParsed = parseMetricsOutput(dockerOutput, isWindows);
        if (dockerParsed.docker) {
          dockerInfo = dockerParsed.docker;
        }
      } catch (err: any) {
        dockerInfo = {
          available: false,
          errorMessage: err?.message || 'Falha ao consultar Docker',
          containers: [],
        };
      }

      return {
        id: config.id,
        config,
        status: 'connected' as const,
        ...baseParsed,
        docker: dockerInfo,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        id: config.id,
        config,
        status: 'error',
        errorMessage: err.message ?? 'Unknown error',
      };
    }
  }

  async controlContainer(config: SshServerConfig, containerId: string, action: DockerContainerAction): Promise<void> {
    const entry = this.connections.get(config.id);
    if (!entry || entry.status !== 'connected') {
      throw new Error('Servidor SSH não está conectado');
    }

    const safeRef = sanitizeContainerRef(containerId);
    if (!safeRef) {
      throw new Error('ID/nome do container inválido');
    }

    const isWindows = config.osType === 'windows';
    let command = '';

    if (isWindows) {
      // Build a PowerShell script that discovers Docker (direct / named-pipe / WSL)
      // and then runs the appropriate action command.
      let actionSnippet: string;
      if (action === 'stop') {
        actionSnippet = [
          `if ($mode -eq 'direct') { & $de stop ${safeRef} 2>&1 }`,
          `if ($mode -eq 'pipe') { & $de -H $dh stop ${safeRef} 2>&1 }`,
          `if ($mode -eq 'wsl') { wsl -e docker stop ${safeRef} 2>&1 }`,
          "if ($mode -eq 'none') { Write-Error 'Docker indisponivel' }",
        ].join('; ');
      } else if (action === 'pause') {
        actionSnippet = [
          `if ($mode -eq 'direct') { & $de pause ${safeRef} 2>&1 }`,
          `if ($mode -eq 'pipe') { & $de -H $dh pause ${safeRef} 2>&1 }`,
          `if ($mode -eq 'wsl') { wsl -e docker pause ${safeRef} 2>&1 }`,
          "if ($mode -eq 'none') { Write-Error 'Docker indisponivel' }",
        ].join('; ');
      } else if (action === 'play') {
        actionSnippet = [
          `if ($mode -eq 'direct') { & $de unpause ${safeRef} 2>$null; if ($LASTEXITCODE -ne 0) { & $de start ${safeRef} } }`,
          `if ($mode -eq 'pipe') { & $de -H $dh unpause ${safeRef} 2>$null; if ($LASTEXITCODE -ne 0) { & $de -H $dh start ${safeRef} } }`,
          `if ($mode -eq 'wsl') { wsl -e docker unpause ${safeRef} 2>$null; if ($LASTEXITCODE -ne 0) { wsl -e docker start ${safeRef} } }`,
          "if ($mode -eq 'none') { Write-Error 'Docker indisponivel' }",
        ].join('; ');
      } else if (action === 'recreate') {
        actionSnippet = [
          `if ($mode -eq 'direct') { & $de restart ${safeRef} 2>&1 }`,
          `if ($mode -eq 'pipe') { & $de -H $dh restart ${safeRef} 2>&1 }`,
          `if ($mode -eq 'wsl') { wsl -e docker restart ${safeRef} 2>&1 }`,
          "if ($mode -eq 'none') { Write-Error 'Docker indisponivel' }",
        ].join('; ');
      } else {
        throw new Error('Ação de container não suportada');
      }
      const psScript = `${DOCKER_WIN_DISCOVERY_PS}; ${actionSnippet}`;
      command = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`;
    } else {
      // Linux / macOS path
      const dockerPrefix = await this.resolveLinuxDockerPrefix(entry.client, entry.password);
      if (action === 'stop') {
        command = `${dockerPrefix} stop ${safeRef}`;
      } else if (action === 'pause') {
        command = `${dockerPrefix} pause ${safeRef}`;
      } else if (action === 'play') {
        command = `${dockerPrefix} unpause ${safeRef} >/dev/null 2>&1 || ${dockerPrefix} start ${safeRef}`;
      } else if (action === 'recreate') {
        command = `${dockerPrefix} restart ${safeRef}`;
      } else {
        throw new Error('Ação de container não suportada');
      }
    }

    await this._execCommand(entry.client, command);
  }

  /** Starts streaming `docker logs -f` for a container. Calls onData for each chunk. */
  async startContainerLogs(config: SshServerConfig, containerId: string, tail = 200, onData?: (chunk: string) => void, onClose?: () => void): Promise<void> {
    const entry = this.connections.get(config.id);
    if (!entry || entry.status !== 'connected') {
      throw new Error('Servidor SSH não está conectado');
    }

    const key = `${config.id}:${containerId}`;
    if (this.logStreams.has(key)) return; // already running

    const isWindows = config.osType === 'windows';
    let command = '';
    if (isWindows) {
      // Try simple docker logs command in PowerShell; discovery already used elsewhere may be required for robustness
      command = `docker logs -f --tail ${Number(tail || 200)} ${containerId}`;
    } else {
      const dockerPrefix = await this.resolveLinuxDockerPrefix(entry.client, entry.password).catch(() => 'docker');
      command = `${dockerPrefix} logs -f --tail ${Number(tail || 200)} ${containerId}`;
    }

    entry.client.exec(command, (err, stream) => {
      if (err) {
        if (onData) onData(`ERROR: ${err.message}\n`);
        return;
      }

      this.logStreams.set(key, stream);

      stream.on('data', (chunk: Buffer) => {
        try { if (onData) onData(chunk.toString('utf8')); } catch (e) { /* ignore */ }
      });
      stream.stderr.on('data', (chunk: Buffer) => { try { if (onData) onData(chunk.toString('utf8')); } catch (e) { } });
      stream.on('close', () => { this.logStreams.delete(key); if (onClose) onClose(); });
      stream.on('error', () => { this.logStreams.delete(key); if (onClose) onClose(); });
    });
  }

  stopContainerLogs(serverId: string, containerId: string): void {
    const key = `${serverId}:${containerId}`;
    const st = this.logStreams.get(key);
    if (st) {
      try { st.close(); } catch (_) { try { st.end(); } catch (_) { } }
      this.logStreams.delete(key);
    }
  }

  /** Start an interactive terminal inside the container (docker exec -it). onData will be called for output. */
  async startContainerTerminal(config: SshServerConfig, containerId: string, onData?: (data: string) => void, onClose?: () => void): Promise<void> {
    const entry = this.connections.get(config.id);
    if (!entry || entry.status !== 'connected') {
      throw new Error('Servidor SSH não está conectado');
    }

    const safeRef = sanitizeContainerRef(containerId);
    if (!safeRef) {
      throw new Error('ID/nome do container inválido');
    }

    const key = `${config.id}:${containerId}`;
    if (this.terminalStreams.has(key)) return; // already running

    const isWindows = config.osType === 'windows';
    let command = '';
    if (isWindows) {
      // Host OS being Windows does not imply a Windows container.
      // Try Linux shell first, then fall back to Windows shells.
      const psScript = [
        DOCKER_WIN_DISCOVERY_PS,
        "$linuxCmd='(command -v bash >/dev/null 2>&1 && exec bash -i) || exec sh -i'",
        `if ($mode -eq 'direct') { & $de exec -it ${safeRef} sh -lc $linuxCmd; if ($LASTEXITCODE -eq 0) { exit 0 }; & $de exec -it ${safeRef} powershell.exe -NoLogo 2>$null; if ($LASTEXITCODE -eq 0) { exit 0 }; & $de exec -it ${safeRef} cmd.exe; exit $LASTEXITCODE }`,
        `if ($mode -eq 'pipe') { & $de -H $dh exec -it ${safeRef} sh -lc $linuxCmd; if ($LASTEXITCODE -eq 0) { exit 0 }; & $de -H $dh exec -it ${safeRef} powershell.exe -NoLogo 2>$null; if ($LASTEXITCODE -eq 0) { exit 0 }; & $de -H $dh exec -it ${safeRef} cmd.exe; exit $LASTEXITCODE }`,
        `if ($mode -eq 'wsl') { wsl -e docker exec -it ${safeRef} sh -lc $linuxCmd; if ($LASTEXITCODE -eq 0) { exit 0 }; wsl -e docker exec -it ${safeRef} powershell.exe -NoLogo 2>$null; if ($LASTEXITCODE -eq 0) { exit 0 }; wsl -e docker exec -it ${safeRef} cmd.exe; exit $LASTEXITCODE }`,
        "if ($mode -eq 'none') { Write-Error 'Docker indisponivel' }",
      ].join('; ');
      command = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`;
    } else {
      const dockerPrefix = await this.resolveLinuxDockerPrefix(entry.client, entry.password).catch(() => 'docker');
      // Force an interactive shell so the session stays open.
      command = `${dockerPrefix} exec -it ${safeRef} sh -c '(command -v bash >/dev/null 2>&1 && exec bash -i) || exec sh -i'`;
    }

    // Request a pty for interactive terminal
    entry.client.exec(command, { pty: { term: 'xterm-256color', cols: 120, rows: 30 } }, (err, stream) => {
      if (err) {
        if (onData) onData(`ERROR: ${err.message}\n`);
        if (onClose) onClose();
        return;
      }

      this.terminalStreams.set(key, stream);

      stream.on('data', (chunk: Buffer) => { try { if (onData) onData(chunk.toString('utf8')); } catch (e) { } });
      stream.stderr.on('data', (chunk: Buffer) => { try { if (onData) onData(chunk.toString('utf8')); } catch (e) { } });
      stream.on('close', () => { this.terminalStreams.delete(key); if (onClose) onClose(); });
      stream.on('exit', () => { this.terminalStreams.delete(key); if (onClose) onClose(); });
      stream.on('error', () => { this.terminalStreams.delete(key); if (onClose) onClose(); });

      // expose a write method on the stream
      // Note: stream.write accepts Buffer|string
    });
  }

  writeContainerTerminalInput(serverId: string, containerId: string, data: string): void {
    const key = `${serverId}:${containerId}`;
    const st = this.terminalStreams.get(key);
    if (st) {
      try { st.write(data); } catch (e) { /* ignore */ }
    }
  }

  stopContainerTerminal(serverId: string, containerId: string): void {
    const key = `${serverId}:${containerId}`;
    const st = this.terminalStreams.get(key);
    if (st) {
      try { st.close(); } catch (_) { try { st.end(); } catch (_) { } }
      this.terminalStreams.delete(key);
    }
  }

  async diagnoseDocker(config: SshServerConfig): Promise<string> {
    const entry = this.connections.get(config.id);
    if (!entry || entry.status !== 'connected') {
      throw new Error('Servidor SSH não está conectado');
    }

    const isWindows = config.osType === 'windows';
    const cmd = isWindows ? DOCKER_DIAG_CMD_WINDOWS : DOCKER_DIAG_CMD_LINUX;
    const out = await this._execCommand(entry.client, cmd, 25000);
    return out.trim() || 'Sem saída do diagnóstico';
  }

  private _execCommand(client: Client, command: string, timeoutMs: number = COMMAND_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Command timed out')), timeoutMs);

      client.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        let output = '';
        let stderrOutput = '';
        stream.on('data', (data: Buffer) => { output += data.toString(); });
        stream.stderr.on('data', (data: Buffer) => { stderrOutput += data.toString(); });
        stream.on('close', () => { 
          clearTimeout(timer); 
          resolve(output || stderrOutput); 
        });
        stream.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
      });
    });
  }

  private async resolveLinuxDockerPrefix(client: Client, password: string): Promise<string> {
    const escapedPassword = shellSingleQuote(password || '');
    const cmd = [
      "export PATH=\"$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/snap/bin:/opt/homebrew/bin\"",
      "D='docker'",
      "if ! command -v docker >/dev/null 2>&1; then",
      "  if [ -x /usr/bin/docker ]; then D='/usr/bin/docker';",
      "  elif [ -x /usr/local/bin/docker ]; then D='/usr/local/bin/docker';",
      "  elif [ -x /snap/bin/docker ]; then D='/snap/bin/docker';",
      "  else echo NONE; exit 0; fi",
      'fi',
      "if $D ps -a >/dev/null 2>&1; then echo DIRECT:$D; exit 0; fi",
      "if command -v sudo >/dev/null 2>&1 && sudo -n $D ps -a >/dev/null 2>&1; then echo SUDO_N:$D; exit 0; fi",
      "if command -v sudo >/dev/null 2>&1 && [ -n '" + escapedPassword + "' ] && printf '%s\\n' '" + escapedPassword + "' | sudo -S -p '' $D ps -a >/dev/null 2>&1; then echo SUDO_P:$D; exit 0; fi",
      'echo NONE',
    ].join('; ');

    const output = (await this._execCommand(client, cmd)).trim();
    const marker = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => line.startsWith('DIRECT:') || line.startsWith('SUDO_N:') || line.startsWith('SUDO_P:') || line === 'NONE');

    if (marker && marker.startsWith('DIRECT:')) {
      return marker.slice('DIRECT:'.length).trim() || 'docker';
    }
    if (marker && marker.startsWith('SUDO_N:')) {
      const dockerPath = marker.slice('SUDO_N:'.length).trim() || 'docker';
      return `sudo -n ${dockerPath}`;
    }
    if (marker && marker.startsWith('SUDO_P:')) {
      const dockerPath = marker.slice('SUDO_P:'.length).trim() || 'docker';
      return `printf '%s\\n' '${escapedPassword}' | sudo -S -p '' ${dockerPath}`;
    }
    throw new Error('Docker indisponível no host Linux (sem permissão de execução)');
  }
}

// ─── Output parser ────────────────────────────────────────────────────────────

function parseMetricsOutput(raw: string, isWindows = false): Partial<SshServerMetrics> {
  const lines = raw.split('\n');

  let cpuUsage: number | undefined;
  let network: SshServerMetrics['network'];
  let ram: SshServerMetrics['ram'];
  const disks: NonNullable<SshServerMetrics['disks']> = [];
  const processes: NonNullable<SshServerMetrics['processes']> = [];
  let energy: string | undefined;
  let dockerAvailable = false;
  let dockerSeen = false;
  let dockerErrorMessage: string | undefined;
  const dockerById = new Map<string, DockerContainerMetrics>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { continue; }

    if (isWindows && line.startsWith('CPU WIN ')) {
      // "CPU WIN <pct>" (or legacy "CPU WIN <pct1> <pct2>")
      const parts = line.split(' ');
      if (parts.length >= 3) {
        const v1 = parseFloat(parts[2]);
        const v2 = parts.length >= 4 ? parseFloat(parts[3]) : NaN;
        if (!isNaN(v1) && !isNaN(v2)) {
          cpuUsage = Math.round(((v1 + v2) / 2) * 10) / 10;
        } else if (!isNaN(v1)) {
          cpuUsage = Math.max(0, Math.min(100, Math.round(v1 * 10) / 10));
        }
      }

    } else if (!isWindows && line.startsWith('CPU ')) {
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

    } else if (line.startsWith('NET ')) {
      // Linux:   NET rx1 tx1 | rx2 tx2
      // Windows: NET rxBytesPerSec txBytesPerSec
      if (isWindows) {
        const parts = line.split(' ');
        if (parts.length >= 3) {
          const rx = parseFloat(parts[1]) || 0;
          const tx = parseFloat(parts[2]) || 0;
          network = {
            downloadBytesPerSec: Math.max(0, Math.round(rx)),
            uploadBytesPerSec: Math.max(0, Math.round(tx)),
          };
        }
      } else {
        const m = line.match(/^NET (\d+) (\d+) \| (\d+) (\d+)/);
        if (m) {
          const rx1 = parseInt(m[1], 10);
          const tx1 = parseInt(m[2], 10);
          const rx2 = parseInt(m[3], 10);
          const tx2 = parseInt(m[4], 10);
          network = {
            downloadBytesPerSec: Math.max(0, (rx2 - rx1) * 2),
            uploadBytesPerSec: Math.max(0, (tx2 - tx1) * 2),
          };
        }
      }

    } else if (line.startsWith('MEM ')) {
      // Linux: "MEM totalKB freeKB availableKB"
      // Windows: "MEM totalKB 0 freeKB"  (TotalVisibleMemorySize & FreePhysicalMemory, both in KB)
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

    } else if (line === 'DOCKER_AVAILABLE') {
      dockerSeen = true;
      dockerAvailable = true;

    } else if (line === 'DOCKER_UNAVAILABLE') {
      dockerSeen = true;
      dockerAvailable = false;
      dockerErrorMessage = 'Docker indisponível na sessão SSH (PATH/permissão)';

    } else if (line.startsWith('DOCKER_ERROR|')) {
      dockerSeen = true;
      dockerAvailable = false;
      const detail = line.slice('DOCKER_ERROR|'.length).trim();
      dockerErrorMessage = detail ? `Falha Docker: ${detail}` : 'Falha ao consultar Docker';

    } else if (line.startsWith('DOCKERPS|')) {
      dockerSeen = true;
      const parts = line.split('|');
      if (parts.length >= 9) {
        const id = parts[1];
        const name = parts[2] || id;
        dockerById.set(id, {
          id,
          name,
          image: parts[3] || '-',
          status: parts[4] || '-',
          ports: parts[5] || '-',
          size: parts[6] || '-',
          stack: resolveDockerStackName(parts[7], parts[8], name),
        });
      }

    } else if (line.startsWith('DOCKERST|')) {
      dockerSeen = true;
      const parts = line.split('|');
      if (parts.length >= 8) {
        const id = parts[1];
        const existing = dockerById.get(id) || {
          id,
          name: id,
          image: '-',
          status: '-',
          ports: '-',
        };

        const mem = parseDockerMemUsage(parts[3]);
        const net = parseDockerIoPair(parts[5]);
        const blk = parseDockerIoPair(parts[6]);

        existing.cpuPercent = parsePercent(parts[2]);
        existing.memoryUsageBytes = mem.used;
        existing.memoryLimitBytes = mem.limit;
        existing.memoryPercent = parsePercent(parts[4]);
        existing.networkRxBytes = net.left;
        existing.networkTxBytes = net.right;
        existing.blockReadBytes = blk.left;
        existing.blockWriteBytes = blk.right;
        existing.pids = parseInt(parts[7], 10) || 0;
        dockerById.set(id, existing);
      }
    }
  }

  const out: Partial<SshServerMetrics> = {
    cpu:       cpuUsage !== undefined ? { usagePercent: cpuUsage } : undefined,
    network,
    ram,
    disks:     disks.length     > 0 ? disks     : undefined,
    processes: processes.length > 0 ? processes : undefined,
    energy,
    timestamp: Date.now(),
  };

  if (dockerSeen || dockerById.size > 0) {
    out.docker = {
      available: dockerAvailable,
      errorMessage: dockerAvailable ? undefined : dockerErrorMessage,
      containers: Array.from(dockerById.values()),
    };
  }

  return out;
}

function sanitizeContainerRef(value: string): string {
  if (!value) { return ''; }
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed) ? trimmed : '';
}

function shellSingleQuote(value: string): string {
  return String(value || '').replace(/'/g, `'"'"'`);
}

function resolveDockerStackName(composeLabel: string, swarmLabel: string, containerName: string): string {
  const compose = (composeLabel || '').trim();
  if (compose) { return compose; }

  const swarm = (swarmLabel || '').trim();
  if (swarm) { return swarm; }

  const inferred = inferStackFromContainerName(containerName);
  return inferred || '';
}

function inferStackFromContainerName(containerName: string): string {
  const name = (containerName || '').trim();
  if (!name) { return ''; }

  const composeLike = name.match(/^([a-zA-Z0-9][a-zA-Z0-9_.-]*)_[a-zA-Z0-9][a-zA-Z0-9_.-]*_\d+$/);
  if (composeLike) {
    return composeLike[1];
  }

  const swarmLike = name.match(/^([a-zA-Z0-9][a-zA-Z0-9_.-]*)_([a-zA-Z0-9][a-zA-Z0-9_.-]*)\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/);
  if (swarmLike) {
    return swarmLike[1];
  }

  return '';
}

function parsePercent(value: string): number {
  if (!value) { return 0; }
  return parseFloat(value.replace('%', '').trim()) || 0;
}

function parseDockerMemUsage(value: string): { used: number; limit: number } {
  const parts = (value || '').split('/').map((v) => v.trim());
  return {
    used: parseHumanBytes(parts[0] || '0'),
    limit: parseHumanBytes(parts[1] || '0'),
  };
}

function parseDockerIoPair(value: string): { left: number; right: number } {
  const parts = (value || '').split('/').map((v) => v.trim());
  return {
    left: parseHumanBytes(parts[0] || '0'),
    right: parseHumanBytes(parts[1] || '0'),
  };
}

function parseHumanBytes(value: string): number {
  const input = (value || '').trim();
  if (!input || input === '0' || input === '-') { return 0; }
  const m = input.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?$/);
  if (!m) { return 0; }
  const num = parseFloat(m[1]);
  const unitRaw = (m[2] || 'B').toUpperCase();
  const unit = unitRaw.replace(/I?B$/, '');
  const multipliers: Record<string, number> = {
    B: 1,
    K: 1024,
    M: 1024 ** 2,
    G: 1024 ** 3,
    T: 1024 ** 4,
    P: 1024 ** 5,
  };
  const mul = multipliers[unit] || 1;
  return Math.round(num * mul);
}

export type MonitorStatus = 'online' | 'offline' | 'pending';
export type MonitorType = 'http' | 'tcp' | 'database';

export interface PingData {
  isOnline: boolean;
  statusCode: number;
  ttfb: number;                 // Time to first byte (ms)
  dnsLookup: number;            // ms
  tcpConnection: number;        // ms
  sslHandshake: number;         // ms
  totalResponseTime: number;    // ms
  contentLength: number;        // bytes
  sslExpiryDays?: number;       // days remaining
  keywordFound?: boolean;       // optional
  redirectCount?: number;       // optional
  errorMessage?: string;        // if any error occurred
}

export interface ServerPingHistory {
  date: number;
  status: MonitorStatus;
  responseTime: number;
}

export interface ServerInfo {
  id: string;
  url: string; 
  type: MonitorType;
  status: MonitorStatus;
  lastChecked?: number;
  downCount: number;
  monitoredSince: number;
  // Advanced metrics
  keyword?: string;
  lastPing?: PingData;
  history: ServerPingHistory[];
}

export interface IMonitor {
  /**
   * Pings the server and returns the detailed PingData
   */
  ping(server: ServerInfo): Promise<PingData>;
}

// ─── SSH Monitoring ───────────────────────────────────────────────────────────

export interface SshServerConfig {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
}

export type SshConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SshServerMetrics {
  id: string;
  config: SshServerConfig;
  status: SshConnectionStatus;
  errorMessage?: string;
  cpu?: {
    usagePercent: number;
  };
  ram?: {
    totalBytes: number;
    usedBytes: number;
    usagePercent: number;
  };
  disks?: Array<{
    device: string;
    mountpoint: string;
    totalBytes: number;
    usedBytes: number;
    usagePercent: number;
  }>;
  processes?: Array<{
    pid: number;
    user: string;
    cpuPercent: number;
    memPercent: number;
    command: string;
  }>;
  energy?: string;
  timestamp?: number;
}

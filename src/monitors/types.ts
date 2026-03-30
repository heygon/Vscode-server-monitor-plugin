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

import * as vscode from 'vscode';
import { IMonitor, MonitorType, ServerInfo } from './types';
import { HttpMonitor } from './HttpMonitor';

const STORAGE_KEY = 'serverMonitor.servers';
const MAX_HISTORY = 60; // Mantém os últimos 60 pings

export class MonitorManager {
  private context: vscode.ExtensionContext;
  private monitors: Map<MonitorType, IMonitor>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.monitors = new Map();
    
    // Register default monitors
    this.monitors.set('http', new HttpMonitor());
    // In the future: this.monitors.set('tcp', new TcpMonitor());
  }

  public getServers(): ServerInfo[] {
    return this.context.globalState.get<ServerInfo[]>(STORAGE_KEY, []);
  }

  public async saveServers(servers: ServerInfo[]): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, servers);
  }

  public async addServer(url: string, type: MonitorType = 'http'): Promise<ServerInfo | null> {
    const servers = this.getServers();
    if (servers.find(s => s.url === url)) {
      vscode.window.showErrorMessage('Esse servidor já está sendo monitorado.');
      return null;
    }

    const newServer: ServerInfo = {
      id: Date.now().toString() + Math.random().toString(),
      url,
      type,
      status: 'pending',
      downCount: 0,
      monitoredSince: Date.now(),
      history: []
    };
    
    servers.push(newServer);
    await this.saveServers(servers);
    return newServer;
  }

  public async removeServer(id: string): Promise<ServerInfo[]> {
    const servers = this.getServers();
    const updated = servers.filter(s => s.id !== id);
    await this.saveServers(updated);
    return updated;
  }

  /**
   * Pings all active servers and updates their state.
   */
  public async pingAll(): Promise<{ stateChanged: boolean, servers: ServerInfo[] }> {
    const servers = this.getServers();
    let stateChanged = false;

    await Promise.all(
      servers.map(async (server) => {
        const monitor = this.monitors.get(server.type);
        if (!monitor) {
          console.warn(`No monitor found for type ${server.type}`);
          return;
        }

        const pingData = await monitor.ping(server);
        const newStatus = pingData.isOnline ? 'online' : 'offline';
        const oldStatus = server.status;

        // Limita e atualiza o histórico
        if (!server.history) server.history = [];
        server.history.push({
          date: Date.now(),
          status: newStatus,
          responseTime: pingData.totalResponseTime
        });

        if (server.history.length > MAX_HISTORY) {
            server.history.shift(); // Remove o mais antigo
        }

        server.lastPing = pingData;

        if (newStatus === 'offline' && oldStatus !== 'offline') {
          server.downCount = (server.downCount || 0) + 1;
          vscode.window.showErrorMessage(`O serviço ${server.url} caiu!`);
        } else if (newStatus === 'online' && oldStatus === 'offline') {
           vscode.window.showInformationMessage(`O serviço ${server.url} voltou a ficar online.`);
        }
        
        if (oldStatus !== newStatus) {
          stateChanged = true;
        }
        
        server.status = newStatus;
        server.lastChecked = Date.now();
      })
    );

    await this.saveServers(servers);
    return { stateChanged, servers };
  }
}

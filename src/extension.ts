import * as vscode from "vscode";
import * as crypto from "crypto";
import { createInterface } from "./interface";
import { MonitorManager } from "./monitors/MonitorManager";
import { SshMonitor } from "./monitors/SshMonitor";
import { DockerContainerAction, SshServerConfig } from "./monitors/types";

let myStatusBarItem: vscode.StatusBarItem;
let timeoutId: NodeJS.Timeout | undefined;
let sshIntervalId: NodeJS.Timeout | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let monitorManager: MonitorManager;
let sshMonitor: SshMonitor;

const SSH_CONFIGS_KEY = 'serverMonitor.sshServers';
const HTTP_POLL_INTERVAL_ONLINE_MS = 90000;
const HTTP_POLL_INTERVAL_OFFLINE_MS = 10000;
const SSH_DOCKER_POLL_INTERVAL_ONLINE_MS = 6000;
const SSH_DOCKER_POLL_INTERVAL_OFFLINE_MS = 2000;

export function activate(context: vscode.ExtensionContext) {
  monitorManager = new MonitorManager(context);
  sshMonitor = new SshMonitor();

  // Set SSH status change callback to update webview in real-time
  sshMonitor.setOnStatusChange((id, status, errorMessage) => {
    if (activePanel) {
      const configs = getSshConfigs(context);
      activePanel.webview.postMessage({
        type: 'updateSshMetrics',
        metrics: configs.map(c => ({
          id: c.id, 
          config: c, 
          status: sshMonitor.getStatus(c.id),
          errorMessage: sshMonitor.getStatus(c.id) === 'error' ? errorMessage : undefined,
        })),
      });
    }
  });

  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  context.subscriptions.push(myStatusBarItem);

  const openDashboardCommand = vscode.commands.registerCommand(
    "monitor.openDashboard",
    () => { openDashboardWebview(context); }
  );
  context.subscriptions.push(openDashboardCommand);
  myStatusBarItem.command = "monitor.openDashboard";

  // Start the background HTTP monitoring loop
  startMonitoring(context);

  // Restore SSH connections from storage and start 6-second polling
  loadAndConnectSshServers(context).then(() => { 
    startSshPolling(context); 
  }).catch(() => {/* SSH init errors are surfaced per-server */});

  updateStatusBar();
}

function getSshConfigs(context: vscode.ExtensionContext): SshServerConfig[] {
  return context.globalState.get<SshServerConfig[]>(SSH_CONFIGS_KEY, []);
}

async function loadAndConnectSshServers(context: vscode.ExtensionContext): Promise<void> {
  const configs = getSshConfigs(context);
  for (const config of configs) {
    const password = await context.secrets.get(`ssh.password.${config.id}`);
    if (password !== undefined) {
      sshMonitor.connect(config, password);
    }
  }
}

function startSshPolling(context: vscode.ExtensionContext): void {
  if (sshIntervalId) { clearTimeout(sshIntervalId); }

  const isContainerOffline = (status: string | undefined): boolean => {
    const s = (status || '').toLowerCase();
    return !(s.startsWith('up') || s.includes('running'));
  };

  const getNextSshDockerDelay = (metrics: Awaited<ReturnType<SshMonitor['collectMetrics']>>[]): number => {
    const hasOfflineSsh = metrics.some((m) => m.status !== 'connected');
    const hasOfflineContainer = metrics.some((m) =>
      m.status === 'connected' &&
      m.docker?.available &&
      (m.docker.containers || []).some((c) => isContainerOffline(c.status))
    );

    return (hasOfflineSsh || hasOfflineContainer)
      ? SSH_DOCKER_POLL_INTERVAL_OFFLINE_MS
      : SSH_DOCKER_POLL_INTERVAL_ONLINE_MS;
  };

  const loop = async () => {
    let nextDelay = SSH_DOCKER_POLL_INTERVAL_ONLINE_MS;
    const configs = getSshConfigs(context);
    if (configs.length > 0) {
      try {
        const metrics = await Promise.all(configs.map(c => sshMonitor.collectMetrics(c)));
        nextDelay = getNextSshDockerDelay(metrics);
        if (activePanel) {
          activePanel.webview.postMessage({ type: 'updateSshMetrics', metrics });
        }
      } catch {
        // On transient errors, speed up retries.
        nextDelay = SSH_DOCKER_POLL_INTERVAL_OFFLINE_MS;
      }
    }

    sshIntervalId = setTimeout(loop, nextDelay);
  };

  loop();
}

function updateStatusBar(): void {
  const servers = monitorManager.getServers();
  const offlineCount = servers.filter(s => s.status === 'offline').length;

  const itemSettings = vscode.workspace.getConfiguration('serverMonitor.dashboard');
  const name    = itemSettings.get("text") as string;
  const icon    = itemSettings.get("icon") as string;
  const tooltip = itemSettings.get("tooltip") as string;

  if (offlineCount > 0) {
    myStatusBarItem.text = `$(alert) ${offlineCount} Servidores Fora`;
    myStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    myStatusBarItem.tooltip = `Atenção: ${offlineCount} servidores estão Offline.`;
  } else {
    myStatusBarItem.text = `${icon} ${name}`;
    myStatusBarItem.backgroundColor = undefined;
    myStatusBarItem.tooltip = tooltip;
  }

  myStatusBarItem.show();
}

function startMonitoring(context: vscode.ExtensionContext) {
  if (timeoutId) { clearTimeout(timeoutId); }

  const loop = async () => {
    let nextDelay = HTTP_POLL_INTERVAL_ONLINE_MS;
    const { stateChanged, servers } = await monitorManager.pingAll();
    if (servers.some((s) => s.status === 'offline')) {
      nextDelay = HTTP_POLL_INTERVAL_OFFLINE_MS;
    }
    if (stateChanged) { updateStatusBar(); }
    if (activePanel) {
      activePanel.webview.postMessage({ type: 'updateServers', servers });
    }
    timeoutId = setTimeout(loop, nextDelay);
  };

  loop();
}

function openDashboardWebview(context: vscode.ExtensionContext) {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    "serverMonitorDashboard",
    "Server Monitor Dashboard",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] }
  );

  activePanel.webview.html = createInterface();

  activePanel.onDidDispose(() => { activePanel = undefined; }, null, context.subscriptions);

  // Send initial HTTP data
  activePanel.webview.postMessage({ type: 'updateServers', servers: monitorManager.getServers() });

  // Send initial SSH status
  const sshConfigs = getSshConfigs(context);
  activePanel.webview.postMessage({
    type: 'updateSshMetrics',
    metrics: sshConfigs.map(c => ({ id: c.id, config: c, status: sshMonitor.getStatus(c.id) })),
  });

  activePanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'addServer': {
          const added = await monitorManager.addServer(message.url, 'http');
          if (added) { updateDashboardAndStatus(); startMonitoring(context); }
          break;
        }

        case 'removeServer': {
          await monitorManager.removeServer(message.id);
          updateDashboardAndStatus();
          break;
        }

        case 'addSshServer': {
          const { label, host, port, username, password, osType } = message;
          if (!host || !username || !password) { break; }
          const id = `ssh-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
          const config: SshServerConfig = {
            id,
            label: (label as string) || host,
            host,
            port: parseInt(port) || 22,
            username,
            osType: osType === 'windows' ? 'windows' : 'linux',
          };
          try {
            const configs = getSshConfigs(context);
            configs.push(config);
            await context.globalState.update(SSH_CONFIGS_KEY, configs);
            await context.secrets.store(`ssh.password.${id}`, password);
            sshMonitor.connect(config, password);
            activePanel?.webview.postMessage({
              type: 'updateSshMetrics',
              metrics: getSshConfigs(context).map(c => ({
                id: c.id, config: c, status: sshMonitor.getStatus(c.id),
              })),
            });
          } catch { /* ignore */ }
          break;
        }

        case 'removeSshServer': {
          const { id } = message;
          sshMonitor.disconnect(id);
          const remaining = getSshConfigs(context).filter(c => c.id !== id);
          await context.globalState.update(SSH_CONFIGS_KEY, remaining);
          await context.secrets.delete(`ssh.password.${id}`);
          activePanel?.webview.postMessage({
            type: 'updateSshMetrics',
            metrics: remaining.map(c => ({
              id: c.id, config: c, status: sshMonitor.getStatus(c.id),
            })),
          });
          break;
        }

        case 'dockerContainerAction': {
          const { serverId, containerId, action } = message as {
            serverId: string;
            containerId: string;
            action: DockerContainerAction;
          };
          if (!serverId || !containerId || !action) { break; }
          const config = getSshConfigs(context).find((c) => c.id === serverId);
          if (!config) { break; }

          try {
            await sshMonitor.controlContainer(config, containerId, action);
          } catch (err: any) {
            vscode.window.showWarningMessage(`Falha ao executar ação no container: ${err?.message || 'erro desconhecido'}`);
          }

          try {
            const metrics = await Promise.all(getSshConfigs(context).map((c) => sshMonitor.collectMetrics(c)));
            activePanel?.webview.postMessage({ type: 'updateSshMetrics', metrics });
          } catch {
            // next polling cycle will refresh
          }
          break;
        }

        case 'dockerDiagnosticsRequest': {
          const configs = getSshConfigs(context);
          const results = await Promise.all(configs.map(async (c) => {
            const status = sshMonitor.getStatus(c.id);
            const hostLabel = c.label || c.host;
            if (status !== 'connected') {
              return {
                serverId: c.id,
                hostLabel,
                ok: false,
                output: `Host não está conectado (status: ${status}).`,
              };
            }

            try {
              const output = await sshMonitor.diagnoseDocker(c);
              return {
                serverId: c.id,
                hostLabel,
                ok: true,
                output,
              };
            } catch (err: any) {
              return {
                serverId: c.id,
                hostLabel,
                ok: false,
                output: err?.message || 'Falha ao executar diagnóstico Docker.',
              };
            }
          }));

          activePanel?.webview.postMessage({
            type: 'dockerDiagnosticsResult',
            results,
          });
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

function updateDashboardAndStatus() {
  activePanel?.webview.postMessage({ type: 'updateServers', servers: monitorManager.getServers() });
  updateStatusBar();
}

export function deactivate() {
  if (timeoutId)     { clearTimeout(timeoutId); }
  if (sshIntervalId) { clearTimeout(sshIntervalId); }
  sshMonitor?.disconnectAll();
}

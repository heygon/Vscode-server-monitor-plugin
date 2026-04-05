import * as vscode from "vscode";
import { createInterface } from "./interface";
import { MonitorManager } from "./monitors/MonitorManager";
import { SshMonitor } from "./monitors/SshMonitor";
import { SshServerConfig } from "./monitors/types";

let myStatusBarItem: vscode.StatusBarItem;
let timeoutId: NodeJS.Timeout | undefined;
let sshIntervalId: NodeJS.Timeout | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let monitorManager: MonitorManager;
let sshMonitor: SshMonitor;

const SSH_CONFIGS_KEY = 'serverMonitor.sshServers';

export function activate(context: vscode.ExtensionContext) {
  monitorManager = new MonitorManager(context);
  sshMonitor = new SshMonitor();

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

  // Restore SSH connections from storage and start 2-second polling
  loadAndConnectSshServers(context).then(() => { startSshPolling(context); });

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
  if (sshIntervalId) { clearInterval(sshIntervalId); }

  const collect = async () => {
    const configs = getSshConfigs(context);
    if (configs.length === 0) { return; }
    const metrics = await Promise.all(configs.map(c => sshMonitor.collectMetrics(c)));
    if (activePanel) {
      activePanel.webview.postMessage({ type: 'updateSshMetrics', metrics });
    }
  };

  sshIntervalId = setInterval(collect, 2000);
  collect();
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
    const { stateChanged, servers } = await monitorManager.pingAll();
    if (stateChanged) { updateStatusBar(); }
    if (activePanel) {
      activePanel.webview.postMessage({ type: 'updateServers', servers });
    }
    timeoutId = setTimeout(loop, 60000);
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
          const { label, host, port, username, password } = message;
          if (!host || !username || !password) { break; }
          const id = `ssh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const config: SshServerConfig = {
            id,
            label: (label as string) || host,
            host,
            port: parseInt(port) || 22,
            username,
          };
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
  if (sshIntervalId) { clearInterval(sshIntervalId); }
  sshMonitor?.disconnectAll();
}

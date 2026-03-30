import * as vscode from "vscode";
import { createInterface } from "./interface";
import { MonitorManager } from "./monitors/MonitorManager";

let myStatusBarItem: vscode.StatusBarItem;
let timeoutId: NodeJS.Timeout | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let monitorManager: MonitorManager;

export function activate(context: vscode.ExtensionContext) {
  monitorManager = new MonitorManager(context);

  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  context.subscriptions.push(myStatusBarItem);

  const openDashboardCommand = vscode.commands.registerCommand(
    "monitor.openDashboard",
    () => {
      openDashboardWebview(context);
    }
  );
  context.subscriptions.push(openDashboardCommand);
  myStatusBarItem.command = "monitor.openDashboard";

  // Start the background monitoring loop
  startMonitoring(context);

  updateStatusBar();
}

function updateStatusBar(): void {
  const servers = monitorManager.getServers();
  const offlineCount = servers.filter(s => s.status === 'offline').length;
  
  let itemSettings = vscode.workspace.getConfiguration('serverMonitor.dashboard');
  let name = itemSettings.get("text") as string;
  let icon = itemSettings.get("icon") as string;
  let tooltip = itemSettings.get("tooltip") as string;

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
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  // Define the recursive monitoring function
  const loop = async () => {
    const { stateChanged, servers } = await monitorManager.pingAll();

    if (stateChanged) {
      updateStatusBar();
    }
    
    // Notify active panel if open to update time/status
    if (activePanel) {
      activePanel.webview.postMessage({ type: 'updateServers', servers });
    }

    // Schedule next run
    timeoutId = setTimeout(loop, 60000); // Ex: a cada 60 segundos conforme prompt
  };

  // Start immediately
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
    {
      enableScripts: true, 
      retainContextWhenHidden: true,
      localResourceRoots: []
    }
  );

  activePanel.webview.html = createInterface();

  activePanel.onDidDispose(
    () => {
      activePanel = undefined;
    },
    null,
    context.subscriptions
  );

  // Send initial data to webview
  const servers = monitorManager.getServers();
  activePanel.webview.postMessage({ type: 'updateServers', servers });

  // Handle messages from the webview
  activePanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.type) {
        case 'addServer':
          const added = await monitorManager.addServer(message.url, 'http'); // Assumes http for generic add
          if (added) {
            updateDashboardAndStatus();
            // Optional: trigger immediate ping
            startMonitoring(context);
          }
          break;

        case 'removeServer':
          await monitorManager.removeServer(message.id);
          updateDashboardAndStatus();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

function updateDashboardAndStatus() {
  const currentServers = monitorManager.getServers();
  activePanel?.webview.postMessage({ type: 'updateServers', servers: currentServers });
  updateStatusBar();
}

export function deactivate() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}
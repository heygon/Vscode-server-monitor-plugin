<h1 align="center">Server Monitor for VS Code (Uptime Kuma Inspired)</h1>

<p align="center">
   <strong>The ultimate plugin for real-time health monitoring of servers, APIs, and HTTP/HTTPS URLs right inside your editor!</strong>
</p>

## 🚀 About the Project
**Server Monitor** turns your Visual Studio Code into a powerful control tower in true Uptime Kuma style. Without leaving your development environment or opening a browser, you can diagnose connectivity, SSL certificate health, precise packet routing timings (TTFB, DNS, TCP), and a complete history of failures or instability.

---

## ✨ Key Features
* **Responsive Grid Dashboard**: Simultaneous view of all hosted sites using native _VS Code_ components (`@vscode/webview-ui-toolkit`).
* **Background Worker Monitoring**: Your servers are tested even when the Webview interface is closed, with native notifications in the VS Code Alerts tab if any service goes down.
* **Availability History Bar**: The well-known "GitHub timeline" style (History Bar), storing up to the last 60 checks with variation status (Green, Orange, and Red).
* **Sparkline Charts**: Line charts showing latency fluctuations from previous checks using *Chart.js*.
* **Status Bar System**: In VS Code's native bottom bar, an icon tracks and reports the total number of sites that are down during critical moments.

## 📊 10 Fine-Grained Telemetry Metrics
Unlike basic `"Ping (Online/Offline)"` checks, this extension measures the underlying response cycle in detail:
1. **Status Code HTTP** (200, 404, 500, etc)
2. **DNS Lookup Time** (Provider routing resolution)
3. **TCP Connection Time** (TCP handshake)
4. **SSL/TLS Handshake** (Secure negotiation speed)
5. **Time to First Byte (TTFB)** (Backend processing speed)
6. **Total Response Time / Latency** (End-to-end duration)
7. **Content Length** (Final processed body size)
8. **SSL Certificate Expiration** (Remaining days before HTTPS renewal)
9. **Downtime Count** (Down Count)
10. **Redirects** (3xx-based detection)

---

## 💻 How to Use (Installation Instructions)

### Local Installation (Via VSCE Package)
1. Make sure you have `vsce` installed in your Node.js environment:
   ```bash
   npm install -g @vscode/vsce
   ```
2. Navigate to the cloned project directory in your terminal and generate the package (VSIX):
   ```bash
   vsce package --no-yarn
   ```
3. This generates a final `.vsix` file in your folder.
4. In VS Code, open the **Extensions** sidebar, click the three dots `...` in the top corner, and select **"Install from VSIX..."**. Locate the generated file and you are done.

### Usage
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. Search for `Server Monitor: Open Dashboard` and press Enter.
3. Enter the URLs you want to monitor and let the extension do the rest.

---

## ⚙️ Exposed Settings (Workspace / Settings.json)
You can open the extension settings in the editor to customize how the root icon behaves in the VS Code Status Bar:
- `serverMonitor.dashboard.text`: "Servers"
- `serverMonitor.dashboard.tooltip`: "Access your online/offline dashboard"
- `serverMonitor.dashboard.icon`: "⚡"

---

## 💡 Directory Structure for DevOps / Future Contributors
The extension was built in TypeScript with high modularity to support future integrations:
- `src/monitors/HttpMonitor.ts` (Contains the native Node.js TLS/HTTP socket logic).
- `src/monitors/MonitorManager.ts` (Synchronizes `globalState` and manages cleanup, limiting history to 60 entries).
- `src/interface/` (Contains high-performance Vanilla JS front-end scripts and native CSS theme injections).

</br>

*[MIT License] - Built for maximum performance without heavy front-end build engines embedded in the IDE.*

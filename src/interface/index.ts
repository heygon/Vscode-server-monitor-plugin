import { Css } from "./css";

export function createInterface(): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Monitor Dashboard</title>
      <script type="module" src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit/dist/toolkit.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      ${Css()}
  </head>
  <body>
      <!-- VIEW: DASHBOARD -->
      <div id="view-dashboard" class="view-section active">
          <header class="global-header">
              <div class="summary-stats">
                  <div class="stat-item">
                      <span class="stat-label">Total de Sites</span>
                      <span class="stat-value" id="stat-total">0</span>
                  </div>
                  <div class="stat-item">
                      <span class="stat-label">Online</span>
                      <span class="stat-value online" id="stat-online">0</span>
                  </div>
                  <div class="stat-item">
                      <span class="stat-label">Offline</span>
                      <span class="stat-value offline" id="stat-offline">0</span>
                  </div>
              </div>

              <div class="actions-group">
                  <vscode-text-field type="url" id="serverUrl" placeholder="https://seudominio.com" style="min-width: 250px;"></vscode-text-field>
                  <vscode-button appearance="primary" onclick="addServer()">Adicionar Novo Site</vscode-button>
              </div>
          </header>

          <main class="cards-grid" id="cards-container">
              <!-- Cards will be injected here -->
          </main>
      </div>

      <!-- VIEW: DETAILS -->
      <div id="view-server" class="view-section">
          <vscode-button appearance="secondary" class="btn-back" onclick="showDashboard()" style="margin-bottom: 24px;">← Voltar ao Dashboard</vscode-button>
          
          <header style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="status-dot" id="detail-dot"></div>
                  <h2 id="detail-title" style="margin: 0; font-size: 24px; font-weight: 600;">URL</h2>
              </div>
              <vscode-button appearance="secondary" id="detail-delete" style="background: var(--danger); color: white; border: none;">Deletar Servidor</vscode-button>
          </header>

          <div style="height: 250px; width: 100%; margin-bottom: 24px;">
              <canvas id="detailChart"></canvas>
          </div>

          <h3 style="margin-bottom: 8px; font-size: 16px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">Histórico (Últimas 60 checagens)</h3>
          <div class="github-history-bar" id="detail-history-bar" style="margin-bottom: 32px; height: 32px;"></div>

          <h3 style="margin-bottom: 8px; font-size: 16px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">Métricas Detalhadas (Último Ping)</h3>
          <div class="server-details-grid" id="detail-metrics-grid">
              <!-- Injected via JS -->
          </div>
      </div>

      <script>
          const vscode = acquireVsCodeApi();
          let serversData = [];
           
          // Map to manage chart instances per server ID to avoid memory leaks
          const chartsRegistry = new Map();
          let detailChartInstance = null;
          let activeServerId = null;

          // Assumindo verificação a cada 60s pelo backend
          const CHECK_INTERVAL_SECONDS = 60; 

          // Setup generic chart styling
          Chart.defaults.color = 'var(--vscode-editor-foreground)';
          Chart.defaults.font.family = 'var(--vscode-font-family)';

          function calculateUptime(history) {
              if (!history || history.length === 0) return '100';
              const onlineCount = history.filter(h => h.status === 'online').length;
              return ((onlineCount / history.length) * 100).toFixed(2);
          }

          function destroyChart(id) {
              if (chartsRegistry.has(id)) {
                  chartsRegistry.get(id).destroy();
                  chartsRegistry.delete(id);
              }
          }

          function drawMiniChart(canvasId, serverId, history) {
              destroyChart(serverId);
              const ctx = document.getElementById(canvasId).getContext('2d');
              
              const labels = history.map(h => new Date(h.date).toLocaleTimeString());
              const dataPoints = history.map(h => h.responseTime || 0);

              const chart = new Chart(ctx, {
                  type: 'line',
                  data: {
                      labels: labels,
                      datasets: [{
                          data: dataPoints,
                          borderColor: '#10b981', // Success green by default
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          borderWidth: 2,
                          pointRadius: 0, 
                          fill: true,
                          tension: 0.4
                      }]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                      scales: {
                          x: { display: false },
                          y: { display: false, beginAtZero: true }
                      },
                      animation: { duration: 0 } 
                  }
              });

              if (history.length > 0) {
                  const lastStatus = history[history.length - 1].status;
                  if (lastStatus === 'offline') {
                       chart.data.datasets[0].borderColor = '#ef4444';
                       chart.data.datasets[0].backgroundColor = 'rgba(239, 68, 68, 0.15)';
                       chart.update();
                  }
              }

              chartsRegistry.set(serverId, chart);
          }

          function drawDetailChart(history) {
              if (detailChartInstance) {
                  detailChartInstance.destroy();
              }
              const ctx = document.getElementById('detailChart').getContext('2d');
              
              const labels = history.map(h => new Date(h.date).toLocaleTimeString());
              const dataPoints = history.map(h => h.responseTime || 0);

              detailChartInstance = new Chart(ctx, {
                  type: 'line',
                  data: {
                      labels: labels,
                      datasets: [{
                          label: 'Response Time (ms)',
                          data: dataPoints,
                          borderColor: 'var(--vscode-button-background)',
                          backgroundColor: 'rgba(14, 99, 156, 0.2)',
                          borderWidth: 2,
                          pointRadius: 2, 
                          fill: true,
                          tension: 0.3
                      }]
                  },
                  options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                      scales: {
                          x: { display: false },
                          y: { beginAtZero: true, grid: { color: 'var(--vscode-widget-border)' } }
                      },
                      animation: { duration: 300 } 
                  }
              });
          }

          function generateHistoryBarHtml(history, maxBlocks = 24) {
              let items = history ? history.slice(-maxBlocks) : [];
              let missingSquares = maxBlocks - items.length;
              if (missingSquares < 0) missingSquares = 0;

              let html = '';
              for(let i=0; i<missingSquares; i++) {
                 html += '<div class="history-square pending" title="Aguardando..."></div>';
              }
              items.forEach(h => {
                 let statusClass = h.status;
                 let tooltip = \`\${new Date(h.date).toLocaleTimeString()} - \${h.responseTime}ms\`;
                 html += \`<div class="history-square \${statusClass}" title="\${tooltip}"></div>\`;
              });
              return html;
          }

          function showDashboard() {
              document.getElementById('view-server').classList.remove('active');
              document.getElementById('view-dashboard').classList.add('active');
              activeServerId = null;
          }

          function showDetails(serverId) {
              const server = serversData.find(s => s.id === serverId);
              if (!server) return;
              
              activeServerId = serverId;
              
              // Base Details
              document.getElementById('detail-title').innerText = server.url;
              const dot = document.getElementById('detail-dot');
              dot.className = \`status-dot \${server.status}\`;
              if (server.status === 'online') dot.classList.add('pulse-green');

              // Delete button config
              document.getElementById('detail-delete').onclick = () => {
                  removeServer(server.id);
                  showDashboard();
              };

              // Charts and History Line
              drawDetailChart(server.history || []);
              document.getElementById('detail-history-bar').innerHTML = generateHistoryBarHtml(server.history, 60);

              // Grid Metrics
              let metricsHtml = '';
              if (server.lastPing) {
                  const p = server.lastPing;
                  const metrics = [
                     { l: 'Status Code', v: p.statusCode },
                     { l: 'TTFB', v: \`\${p.ttfb} ms\` },
                     { l: 'DNS Lookup', v: \`\${p.dnsLookup} ms\` },
                     { l: 'TCP Connection', v: \`\${p.tcpConnection} ms\` },
                     { l: 'SSL Handshake', v: \`\${p.sslHandshake} ms\` },
                     { l: 'Total Time', v: \`\${p.totalResponseTime} ms\` },
                     { l: 'SSL Expiry', v: p.sslExpiryDays !== undefined ? \`\${p.sslExpiryDays} dias\` : '-' },
                     { l: 'Content Length', v: \`\${p.contentLength} B\` },
                     { l: 'Redirects', v: p.redirectCount || 0 },
                     { l: 'Down Count', v: server.downCount || 0 },
                  ];

                  metrics.forEach(m => {
                      metricsHtml += \`<div class="detail-card"><span class="label">\${m.l}</span><span class="value">\${m.v}</span></div>\`;
                  });
              } else {
                  metricsHtml = '<div style="color:var(--muted)">Dados do ping ainda não estão disponíveis.</div>';
              }
              
              document.getElementById('detail-metrics-grid').innerHTML = metricsHtml;

              // Transition Views
              document.getElementById('view-dashboard').classList.remove('active');
              document.getElementById('view-server').classList.add('active');
          }

          function createSkeletonCard() {
              return \`
              <div class="server-card">
                  <div class="card-header">
                      <div class="card-title-group">
                          <div class="status-dot pending skeleton" style="box-shadow:none;"></div>
                          <div class="skeleton skeleton-title"></div>
                      </div>
                  </div>
                  <div class="card-body">
                      <div class="skeleton skeleton-chart"></div>
                      <div class="skeleton skeleton-bar"></div>
                  </div>
                  <div class="card-footer" style="opacity: 0.5;">
                      <div class="footer-metric"><div class="label skeleton skeleton-text"></div></div>
                      <div class="footer-metric"><div class="label skeleton skeleton-text"></div></div>
                      <div class="footer-metric"><div class="label skeleton skeleton-text"></div></div>
                  </div>
              </div>\`;
          }

          function renderDashboard() {
              const container = document.getElementById('cards-container');
              
              let total = serversData.length;
              let online = 0;
              let offline = 0;

              if (total === 0) {
                  container.innerHTML = '<div class="empty-state">Nenhum servidor monitorado.<br/>Por favor, adicione um site acima para começar.</div>';
                  document.getElementById('stat-total').innerText = '0';
                  document.getElementById('stat-online').innerText = '0';
                  document.getElementById('stat-offline').innerText = '0';
                  return;
              }

              let htmlStr = '';

              serversData.forEach(server => {
                  if (server.status === 'online') online++;
                  else if (server.status === 'offline') offline++;

                  if (server.status === 'pending') {
                      htmlStr += createSkeletonCard();
                      return;
                  }

                  const uptime = calculateUptime(server.history);
                  const isOnline = server.status === 'online';
                  
                  const dotAnimClass = isOnline ? 'pulse-green' : '';
                  const uptimeColor = isOnline ? 'var(--success)' : (server.status === 'offline' ? 'var(--danger)' : 'var(--pending)');

                  const canvasId = \`chart-\${server.id}\`;
                  const pingTime = server.lastPing ? \`\${server.lastPing.totalResponseTime}ms\` : '-';
                  
                  let checkedStr = '-';
                  if (server.lastChecked) {
                      const secondsAgo = Math.floor((Date.now() - server.lastChecked) / 1000);
                      checkedStr = secondsAgo < 60 ? \`\${secondsAgo}s atrás\` : \`\${Math.floor(secondsAgo/60)}m atrás\`;
                  }

                  htmlStr += \`
                  <div class="server-card" onclick="showDetails('\${server.id}')">
                      <!-- Action Overlay -->
                      <div class="card-actions" onclick="event.stopPropagation()">
                          <!-- Excluir Button -->
                          <div class="action-btn delete" onclick="removeServer('\${server.id}', event)" title="Excluir">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                 <path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/>
                              </svg>
                          </div>
                      </div>

                      <div class="card-header">
                          <div class="card-title-group" title="\${server.url}">
                              <div class="status-dot \${server.status} \${dotAnimClass}"></div>
                              <h3 class="card-title">\${server.url}</h3>
                          </div>
                          <div class="uptime-badge" style="color: \${uptimeColor}">\${uptime}%</div>
                      </div>
                      
                      <div class="card-body">
                          <div class="mini-chart-container">
                              <canvas id="\${canvasId}"></canvas>
                          </div>
                          <div class="github-history-bar" title="Últimas 24 verificações">
                              \${generateHistoryBarHtml(server.history)}
                          </div>
                      </div>

                      <div class="card-footer">
                          <div class="footer-metric">
                              <span class="label">Último Ping</span>
                              <span class="value">\${pingTime}</span>
                          </div>
                          <div class="footer-metric">
                              <span class="label">Última Check</span>
                              <span class="value">\${checkedStr}</span>
                          </div>
                          <div class="footer-metric">
                              <span class="label">Próxima Verificação</span>
                              <span class="value countdown-val" data-last="\${server.lastChecked || 0}">Aguardando...</span>
                          </div>
                      </div>
                  </div>
                  \`;
              });

              container.innerHTML = htmlStr;

              // Render charts
              serversData.forEach(server => {
                  if (server.status !== 'pending') {
                      drawMiniChart(\`chart-\${server.id}\`, server.id, server.history || []);
                  }
              });

              // Update Global Stats
              document.getElementById('stat-total').innerText = total;
              document.getElementById('stat-online').innerText = online;
              document.getElementById('stat-offline').innerText = offline;

              // Refresh details text if it's currently open
              if (activeServerId && document.getElementById('view-server').classList.contains('active')) {
                  showDetails(activeServerId);
              }
          }

          function addServer() {
              const input = document.getElementById('serverUrl');
              const url = input.value.trim();
              if (url) {
                  const formattedUrl = url.startsWith('http') ? url : 'https://' + url;
                  vscode.postMessage({ type: 'addServer', url: formattedUrl });
                  input.value = '';
                  
                  // Optimistic UI to show skeleton faster
                  serversData.push({ id: 'temp-'+Date.now(), url: formattedUrl, status: 'pending' });
                  renderDashboard(); 
              }
          }

          function removeServer(id, e) {
              if (e) e.stopPropagation(); 
              destroyChart(id);
              vscode.postMessage({ type: 'removeServer', id });
          }

          window.addEventListener('message', event => {
              const message = event.data;
              if (message.type === 'updateServers') {
                  serversData = message.servers;
                  renderDashboard();
              }
          });

          // Handle 'Enter' key press
          document.getElementById('serverUrl').addEventListener('keydown', function (e) {
              if (e.key === 'Enter') addServer();
          });

          // Countdown Timer functionality
          setInterval(() => {
              const now = Date.now();
              document.querySelectorAll('.countdown-val').forEach(el => {
                  const last = parseInt(el.getAttribute('data-last'), 10);
                  if (!last) return;
                  
                  const elapsedSeconds = Math.floor((now - last) / 1000);
                  const remaining = CHECK_INTERVAL_SECONDS - elapsedSeconds;
                  
                  if (remaining > 0) {
                      el.innerText = \`em \${remaining}s\`;
                  } else {
                      el.innerText = 'Checando agora...';
                  }
              });
          }, 1000);

      </script>
  </body>
  </html>
  `;
}

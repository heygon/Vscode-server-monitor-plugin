import { Css } from "./css";

export function createInterface(): string {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Monitor Dashboard</title>
      <script type="module" src="https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit/dist/toolkit.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      ${Css()}
  </head>
  <body>

      <!-- TAB NAVIGATION -->
      <nav class="tab-nav">
          <button class="tab-btn active" id="tab-http">🌐 Sites HTTP</button>
          <button class="tab-btn"        id="tab-ssh">💻 Servidores SSH</button>
          <button class="tab-btn"        id="tab-docker">🐳 Containers Docker</button>
      </nav>

      <!-- VIEW: HTTP DASHBOARD -->
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
                  <vscode-button appearance="primary" id="btn-add-server">Adicionar Novo Site</vscode-button>
              </div>
          </header>
          <main class="cards-grid" id="cards-container"></main>
      </div>

      <!-- VIEW: HTTP SERVER DETAILS -->
      <div id="view-server" class="view-section">
          <vscode-button appearance="secondary" class="btn-back" id="btn-back" style="margin-bottom: 24px;">&#8592; Voltar ao Dashboard</vscode-button>
          <header style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="status-dot" id="detail-dot"></div>
                  <h2 id="detail-title" style="margin: 0; font-size: 24px; font-weight: 600;">URL</h2>
              </div>
              <vscode-button appearance="secondary" id="detail-delete" style="background: var(--danger); color: white; border: none;">Deletar Servidor</vscode-button>
          </header>
          <div style="height: 250px; width: 100%; margin-bottom: 24px;"><canvas id="detailChart"></canvas></div>
          <h3 style="margin-bottom: 8px; font-size: 16px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">Hist&#243;rico (&#218;ltimas 60 checagens)</h3>
          <div class="github-history-bar" id="detail-history-bar" style="margin-bottom: 32px; height: 32px;"></div>
          <h3 style="margin-bottom: 8px; font-size: 16px; border-bottom: 1px solid var(--card-border); padding-bottom: 8px;">M&#233;tricas Detalhadas (&#218;ltimo Ping)</h3>
          <div class="server-details-grid" id="detail-metrics-grid"></div>
      </div>

      <!-- VIEW: SSH MONITOR -->
      <div id="view-ssh" class="view-section">
          <div class="ssh-add-form">
              <p class="ssh-form-title">Adicionar Servidor SSH</p>
              <div class="ssh-form-row">
                  <vscode-text-field id="ssh-label"    placeholder="Label (ex: Web Server)"></vscode-text-field>
                  <vscode-text-field id="ssh-host"     placeholder="Host / IP *"></vscode-text-field>
                  <vscode-text-field id="ssh-port"     placeholder="Porta (22)"></vscode-text-field>
                  <vscode-text-field id="ssh-user"     placeholder="Usu&#225;rio *"></vscode-text-field>
                  <vscode-text-field id="ssh-pass"     placeholder="Senha *" type="password"></vscode-text-field>
                  <vscode-dropdown id="ssh-os">
                      <vscode-option value="linux">Linux</vscode-option>
                      <vscode-option value="windows">Windows</vscode-option>
                  </vscode-dropdown>
                  <vscode-button appearance="primary" id="btn-add-ssh">Conectar</vscode-button>
              </div>
          </div>
          <div id="ssh-cards-container" class="ssh-cards-grid"></div>
      </div>

      <!-- VIEW: DOCKER CONTAINERS -->
      <div id="view-docker" class="view-section">
          <div class="ssh-add-form">
              <p class="ssh-form-title">Containers Docker (via SSH)</p>
              <div class="docker-diag-toolbar">
                  <div id="docker-summary" class="ssh-connecting-msg" style="margin-bottom:0;">Aguardando dados...</div>
                  <vscode-button id="btn-docker-diagnose" appearance="secondary">Diagnóstico Docker</vscode-button>
              </div>
              <div id="docker-diagnostics-panel" class="docker-diag-panel"></div>
          </div>
          <div id="docker-cards-container"></div>
      </div>

      <script>
          const vscode = acquireVsCodeApi();

          // HTTP state
          let serversData = [];
          const chartsRegistry = new Map();
          let detailChartInstance = null;
          let activeServerId = null;
          const HTTP_CHECK_INTERVAL_ONLINE_SECONDS = 90;
          const HTTP_CHECK_INTERVAL_OFFLINE_SECONDS = 10;
          const SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS = 6;
          const SSH_DOCKER_CHECK_INTERVAL_OFFLINE_SECONDS = 2;

          // SSH state
          let sshData = [];
          let dockerDiagRunning = false;
          const gaugeMap = new Map(); // canvasId -> { chart, valueRef }
          const hasChart = typeof Chart !== 'undefined';

          // Tab logic
          let currentTab = 'http';

          function showTab(tab) {
              currentTab = tab;
              var tabHttp = document.getElementById('tab-http');
              var tabSsh = document.getElementById('tab-ssh');
              var tabDocker = document.getElementById('tab-docker');
              var viewSsh = document.getElementById('view-ssh');
              var viewDocker = document.getElementById('view-docker');
              var viewDash = document.getElementById('view-dashboard');
              var viewServer = document.getElementById('view-server');
              
              if (!tabHttp || !tabSsh || !tabDocker || !viewSsh || !viewDocker || !viewDash || !viewServer) {
                  console.error('Tab elements not found');
                  return;
              }
              
              tabHttp.classList.toggle('active', tab === 'http');
              tabSsh.classList.toggle('active', tab === 'ssh');
              tabDocker.classList.toggle('active', tab === 'docker');
              viewSsh.classList.toggle('active', tab === 'ssh');
              viewDocker.classList.toggle('active', tab === 'docker');
              
              if (tab === 'ssh' || tab === 'docker') {
                  viewDash.classList.remove('active');
                  viewServer.classList.remove('active');
                  if (tab === 'docker') {
                      renderDockerDashboard(sshData);
                  }
              } else {
                  if (activeServerId) {
                      viewServer.classList.add('active');
                      viewDash.classList.remove('active');
                  } else {
                      viewDash.classList.add('active');
                      viewServer.classList.remove('active');
                  }
              }
          }

          if (hasChart) {
              Chart.defaults.color = 'var(--vscode-editor-foreground)';
              Chart.defaults.font.family = 'var(--vscode-font-family)';
          } else {
              console.warn('Chart.js not loaded. Charts and gauges are disabled.');
          }

          // ────────────────────────────────────────────────────────────────
          // HTTP DASHBOARD
          // ────────────────────────────────────────────────────────────────

          function calculateUptime(history) {
              if (!history || history.length === 0) return '100';
              return ((history.filter(h => h.status === 'online').length / history.length) * 100).toFixed(2);
          }

          function destroyChart(id) {
              if (chartsRegistry.has(id)) { chartsRegistry.get(id).destroy(); chartsRegistry.delete(id); }
          }

          function drawMiniChart(canvasId, serverId, history) {
              if (!hasChart) return;
              destroyChart(serverId);
              var canvas = document.getElementById(canvasId);
              if (!canvas) {
                  console.warn('Canvas element not found:', canvasId);
                  return;
              }
              var ctx = canvas.getContext('2d');
              if (!ctx) {
                  console.error('Failed to get 2D context for:', canvasId);
                  return;
              }
              var chart = new Chart(ctx, {
                  type: 'line',
                  data: { labels: history.map(h => new Date(h.date).toLocaleTimeString()), datasets: [{ data: history.map(h => h.responseTime || 0), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4 }] },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } }, animation: { duration: 0 } }
              });
              if (history.length > 0 && history[history.length - 1].status === 'offline') {
                  chart.data.datasets[0].borderColor = '#ef4444';
                  chart.data.datasets[0].backgroundColor = 'rgba(239,68,68,0.15)';
                  chart.update();
              }
              chartsRegistry.set(serverId, chart);
          }

          function drawDetailChart(history) {
              if (!hasChart) return;
              if (detailChartInstance) { detailChartInstance.destroy(); }
              var canvas = document.getElementById('detailChart');
              if (!canvas) {
                  console.warn('Detail chart canvas element not found');
                  return;
              }
              var ctx = canvas.getContext('2d');
              if (!ctx) {
                  console.error('Failed to get 2D context for detail chart');
                  return;
              }
              detailChartInstance = new Chart(ctx, {
                  type: 'line',
                  data: { labels: history.map(h => new Date(h.date).toLocaleTimeString()), datasets: [{ label: 'Response Time (ms)', data: history.map(h => h.responseTime || 0), borderColor: 'var(--vscode-button-background)', backgroundColor: 'rgba(14,99,156,0.2)', borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3 }] },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { x: { display: false }, y: { beginAtZero: true, grid: { color: 'var(--vscode-widget-border)' } } }, animation: { duration: 300 } }
              });
          }

          function generateHistoryBarHtml(history, maxBlocks) {
              maxBlocks = maxBlocks || 24;
              let items = history ? history.slice(-maxBlocks) : [];
              let html = '';
              for (let i = 0; i < maxBlocks - items.length; i++) html += '<div class="history-square pending" title="Aguardando..."></div>';
              items.forEach(h => { html += '<div class="history-square ' + h.status + '" title="' + new Date(h.date).toLocaleTimeString() + ' - ' + h.responseTime + 'ms"></div>'; });
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
              document.getElementById('detail-title').innerText = server.url;
              const dot = document.getElementById('detail-dot');
              dot.className = 'status-dot ' + server.status;
              if (server.status === 'online') dot.classList.add('pulse-green');
              document.getElementById('detail-delete').onclick = function() { removeServer(server.id); showDashboard(); };
              drawDetailChart(server.history || []);
              document.getElementById('detail-history-bar').innerHTML = generateHistoryBarHtml(server.history, 60);
              let metricsHtml = '';
              if (server.lastPing) {
                  const p = server.lastPing;
                  const metrics = [
                      { l: 'Status Code', v: p.statusCode },
                      { l: 'TTFB', v: p.ttfb + ' ms' },
                      { l: 'DNS Lookup', v: p.dnsLookup + ' ms' },
                      { l: 'TCP Connection', v: p.tcpConnection + ' ms' },
                      { l: 'SSL Handshake', v: p.sslHandshake + ' ms' },
                      { l: 'Total Time', v: p.totalResponseTime + ' ms' },
                      { l: 'SSL Expiry', v: p.sslExpiryDays !== undefined ? p.sslExpiryDays + ' dias' : '-' },
                      { l: 'Content Length', v: p.contentLength + ' B' },
                      { l: 'Redirects', v: p.redirectCount || 0 },
                      { l: 'Down Count', v: server.downCount || 0 }
                  ];
                  metrics.forEach(function(m) { metricsHtml += '<div class="detail-card"><span class="label">' + m.l + '</span><span class="value">' + m.v + '</span></div>'; });
              } else {
                  metricsHtml = '<div style="color:var(--muted)">Dados do ping ainda n\u00e3o est\u00e3o dispon\u00edveis.</div>';
              }
              document.getElementById('detail-metrics-grid').innerHTML = metricsHtml;
              document.getElementById('view-dashboard').classList.remove('active');
              document.getElementById('view-server').classList.add('active');
          }

          function createSkeletonCard() {
              return '<div class="server-card"><div class="card-header"><div class="card-title-group"><div class="status-dot pending skeleton" style="box-shadow:none;"></div><div class="skeleton skeleton-title"></div></div></div><div class="card-body"><div class="skeleton skeleton-chart"></div><div class="skeleton skeleton-bar"></div></div><div class="card-footer" style="opacity:0.5;"><div class="footer-metric"><div class="label skeleton skeleton-text"></div></div><div class="footer-metric"><div class="label skeleton skeleton-text"></div></div><div class="footer-metric"><div class="label skeleton skeleton-text"></div></div></div></div>';
          }

          function renderDashboard() {
              const container = document.getElementById('cards-container');
              if (!container) {
                  console.error('cards-container element not found');
                  return;
              }
              var total = serversData.length, online = 0, offline = 0;
              if (total === 0) {
                  container.innerHTML = '<div class="empty-state">Nenhum servidor monitorado.<br/>Por favor, adicione um site acima para come\u00e7ar.</div>';
                  var statTotal = document.getElementById('stat-total');
                  var statOnline = document.getElementById('stat-online');
                  var statOffline = document.getElementById('stat-offline');
                  if (statTotal) statTotal.innerText = '0';
                  if (statOnline) statOnline.innerText = '0';
                  if (statOffline) statOffline.innerText = '0';
                  return;
              }
              var html = '';
              serversData.forEach(function(server) {
                  if (server.status === 'online') online++;
                  else if (server.status === 'offline') offline++;
                  if (server.status === 'pending') { html += createSkeletonCard(); return; }
                  var uptime = calculateUptime(server.history);
                  var isOnline = server.status === 'online';
                  var dotAnimClass = isOnline ? 'pulse-green' : '';
                  var uptimeColor = isOnline ? 'var(--success)' : (server.status === 'offline' ? 'var(--danger)' : 'var(--pending)');
                  var canvasId = 'chart-' + server.id;
                  var pingTime = server.lastPing ? server.lastPing.totalResponseTime + 'ms' : '-';
                  var checkedStr = '-';
                  if (server.lastChecked) { var s = Math.floor((Date.now() - server.lastChecked) / 1000); checkedStr = s < 60 ? s + 's atr\u00e1s' : Math.floor(s / 60) + 'm atr\u00e1s'; }
                  html += '<div class="server-card" onclick="showDetails(\\\'' + server.id + '\\\')">'
                      + '<div class="card-actions" onclick="event.stopPropagation()"><div class="action-btn delete" onclick="removeServer(\\\'' + server.id + '\\\',event)" title="Excluir"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div></div>'
                      + '<div class="card-header"><div class="card-title-group" title="' + server.url + '"><div class="status-dot ' + server.status + ' ' + dotAnimClass + '"></div><h3 class="card-title">' + server.url + '</h3></div><div class="uptime-badge" style="color:' + uptimeColor + '">' + uptime + '%</div></div>'
                      + '<div class="card-body"><div class="mini-chart-container"><canvas id="' + canvasId + '"></canvas></div><div class="github-history-bar" title="' + '\u00daltimas 24 verifica\u00e7\u00f5es' + '">' + generateHistoryBarHtml(server.history) + '</div></div>'
                      + '<div class="card-footer"><div class="footer-metric"><span class="label">\u00daltimo Ping</span><span class="value">' + pingTime + '</span></div><div class="footer-metric"><span class="label">\u00daltima Check</span><span class="value">' + checkedStr + '</span></div><div class="footer-metric"><span class="label">Pr\u00f3xima Verifica\u00e7\u00e3o</span><span class="value countdown-val" data-last="' + (server.lastChecked || 0) + '" data-interval="' + (server.status === 'offline' ? HTTP_CHECK_INTERVAL_OFFLINE_SECONDS : HTTP_CHECK_INTERVAL_ONLINE_SECONDS) + '">' + _countdownText(server.lastChecked || 0, server.status === 'offline' ? HTTP_CHECK_INTERVAL_OFFLINE_SECONDS : HTTP_CHECK_INTERVAL_ONLINE_SECONDS) + '</span></div></div>'
                      + '</div>';
              });
              container.innerHTML = html;
              serversData.forEach(function(server) { if (server.status !== 'pending') drawMiniChart('chart-' + server.id, server.id, server.history || []); });
              var statTotal = document.getElementById('stat-total');
              var statOnline = document.getElementById('stat-online');
              var statOffline = document.getElementById('stat-offline');
              if (statTotal) statTotal.innerText = total;
              if (statOnline) statOnline.innerText = online;
              if (statOffline) statOffline.innerText = offline;
              var viewServer = document.getElementById('view-server');
              if (activeServerId && viewServer && viewServer.classList.contains('active')) showDetails(activeServerId);
          }

          function addServer() {
              var input = document.getElementById('serverUrl');
              if (!input) {
                  console.error('serverUrl input not found');
                  return;
              }
              var url = input.value.trim();
              if (url) {
                  var formattedUrl = url.startsWith('http') ? url : 'https://' + url;
                  vscode.postMessage({ type: 'addServer', url: formattedUrl });
                  input.value = '';
                  serversData.push({ id: 'temp-' + Date.now(), url: formattedUrl, status: 'pending' });
                  renderDashboard();
              }
          }

          function removeServer(id, e) {
              if (e) e.stopPropagation();
              destroyChart(id);
              vscode.postMessage({ type: 'removeServer', id: id });
          }

          // ────────────────────────────────────────────────────────────────
          // SSH DASHBOARD
          // ────────────────────────────────────────────────────────────────

          function _gaugeColor(pct) {
              if (pct < 50) return '#10b981';
              if (pct < 80) return '#f59e0b';
              return '#ef4444';
          }

          function _fmtBytes(bytes) {
              if (!bytes) return '0 B';
              if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
              if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
              return (bytes / 1e3).toFixed(0) + ' KB';
          }

          function _fmtRate(bytesPerSec) {
              return _fmtBytes(bytesPerSec || 0) + '/s';
          }

          function _fmtPct(value) {
              var n = Number(value || 0);
              return n.toFixed(1) + '%';
          }

          function _esc(str) {
              var d = document.createElement('div');
              d.textContent = String(str || '');
              return d.innerHTML;
          }

          function _countdownText(lastTimestamp, intervalSeconds) {
              if (!lastTimestamp) return 'Aguardando...';
              var remaining = intervalSeconds - Math.floor((Date.now() - lastTimestamp) / 1000);
              return remaining > 0 ? 'em ' + remaining + 's' : 'Checando agora...';
          }

          function _isContainerOffline(status) {
              var s = String(status || '').toLowerCase();
              return !(s.indexOf('up') === 0 || s.indexOf('running') >= 0);
          }

          function _dockerPollingIntervalSeconds(metricsList) {
              var hasOfflineSsh = (metricsList || []).some(function(m) { return m.status !== 'connected'; });
              var hasOfflineContainer = (metricsList || []).some(function(m) {
                  if (!m || m.status !== 'connected' || !m.docker || !m.docker.available) return false;
                  return (m.docker.containers || []).some(function(c) { return _isContainerOffline(c.status); });
              });
              return (hasOfflineSsh || hasOfflineContainer)
                  ? SSH_DOCKER_CHECK_INTERVAL_OFFLINE_SECONDS
                  : SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS;
          }

          function _dockerStatusClass(status) {
              var s = String(status || '').toLowerCase();
              if (s.indexOf('up') === 0 || s.indexOf('running') >= 0) return 'running';
              if (s.indexOf('paused') >= 0) return 'paused';
              return 'stopped';
          }

          function _fmtDockerPorts(ports) {
              var raw = String(ports || '').trim();
              if (!raw) return '-';

              var parts = raw.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
              var compact = parts.map(function(p) {
                  // Removes host bind prefixes like 0.0.0.0:8080-> and [::]:8080->
                  // while keeping the exposed container port info.
                  var out = p
                      .replace(/^0\.0\.0\.0:\d+->/, '')
                      .replace(/^\[::\]:\d+->/, '')
                      .replace(/,?\s*0\.0\.0\.0:/g, '')
                      .replace(/,?\s*\[::\]:/g, '')
                      .trim();
                  return out || p;
              });

              var dedup = Array.from(new Set(compact));
              return dedup.join(', ');
          }

          function _flattenDocker(metricsList) {
              var rows = [];
              (metricsList || []).forEach(function(m) {
                  if (!m || m.status !== 'connected' || !m.docker || !m.docker.available) return;
                  (m.docker.containers || []).forEach(function(c) {
                      rows.push({
                          serverId: m.id,
                          hostLabel: (m.config && (m.config.label || m.config.host)) || 'Host',
                          hostInfo: (m.config ? (m.config.username + '@' + m.config.host + ':' + m.config.port) : ''),
                          container: c,
                      });
                  });
              });
              return rows;
          }

          function renderDockerDashboard(metricsList) {
              var summaryEl = document.getElementById('docker-summary');
              var containerEl = document.getElementById('docker-cards-container');
              if (!summaryEl || !containerEl) return;

              var rows = _flattenDocker(metricsList);
              var connectedHosts = (metricsList || []).filter(function(m) { return m.status === 'connected'; }).length;
              var hostsWithDocker = (metricsList || []).filter(function(m) { return m.status === 'connected' && m.docker && m.docker.available; }).length;
              var dockerIntervalSeconds = _dockerPollingIntervalSeconds(metricsList);
              var latestDockerTimestamp = 0;
              (metricsList || []).forEach(function(m) {
                  if (m && m.status === 'connected' && m.timestamp && m.timestamp > latestDockerTimestamp) {
                      latestDockerTimestamp = m.timestamp;
                  }
              });
              var dockerIssues = (metricsList || []).filter(function(m) {
                  return m.status === 'connected' && m.docker && !m.docker.available;
              });

              summaryEl.className = 'ssh-connecting-msg';
              summaryEl.innerHTML = 'Hosts conectados: <strong>' + connectedHosts + '</strong> • Docker disponível: <strong>' + hostsWithDocker + '</strong> • Containers: <strong>' + rows.length + '</strong> • Próxima atualização: <strong class="countdown-docker" data-last="' + latestDockerTimestamp + '" data-interval="' + dockerIntervalSeconds + '">' + _countdownText(latestDockerTimestamp, dockerIntervalSeconds) + '</strong>';

              if (rows.length === 0) {
                  var issuesHtml = '';
                  if (dockerIssues.length > 0) {
                      issuesHtml = '<div class="ssh-error-msg" style="margin-top:12px;">' + dockerIssues.map(function(m) {
                          var host = (m.config && (m.config.label || m.config.host)) || m.id;
                          var err = (m.docker && m.docker.errorMessage) ? m.docker.errorMessage : 'Docker indisponível';
                          return _esc(host) + ': ' + _esc(err);
                      }).join('<br/>') + '</div>';
                  }
                  containerEl.innerHTML = '<div class="empty-state">Nenhum container encontrado nos hosts SSH conectados.</div>' + issuesHtml;
                  return;
              }

              var html = '<div class="docker-table-wrap">'+
                    '<table class="docker-table">'+
                        '<thead>'+
                            '<tr>' +
                                '<th class="td-docker">Container</th>'+
                                '<th class="td-docker">Imagem</th>'+
                                '<th class="td-docker">Status</th>'+
                                '<th class="td-docker">Portas</th>'+
                                '<th class="td-docker">CPU</th>'+
                                '<th class="td-docker">RAM</th>'+
                                '<th class="td-docker">Rede</th>'+
                                '<th class="td-docker">Disco</th>'+
                                '<th class="td-docker">Ações</th>' +
                            '</tr>'+
                        '</thead>'+
                    '<tbody>';

              rows.forEach(function(row) {
                  var c = row.container;
                  var statusClass = _dockerStatusClass(c.status);
                  var ramText = (c.memoryUsageBytes != null ? _fmtBytes(c.memoryUsageBytes) : '-') +
                      (c.memoryLimitBytes ? ' / ' + _fmtBytes(c.memoryLimitBytes) : '');
                  var netText = (c.networkRxBytes != null ? _fmtBytes(c.networkRxBytes) : '0 B') +
                      ' / ' + (c.networkTxBytes != null ? _fmtBytes(c.networkTxBytes) : '0 B');
                  var diskText = (c.blockReadBytes != null ? _fmtBytes(c.blockReadBytes) : '0 B') +
                      ' / ' + (c.blockWriteBytes != null ? _fmtBytes(c.blockWriteBytes) : '0 B');
                  var sizeText = c.size ? '<div class="docker-size">Size: ' + _esc(c.size) + '</div>' : '';
                  var portsText = _fmtDockerPorts(c.ports);

                  html += '<tr>'
                      + '<td class="td-docker"><div class="docker-name"></div><div class="docker-id">' + _esc(row.hostInfo) + '</div></td>'
                      + '<td class="td-docker"><div class="docker-name">' + _esc(c.name) + '</div><div class="docker-id">' + _esc(c.id.substring(0, 12)) + '</div></td>'
                      + '<td class="td-docker docker-image" title="' + _esc(c.image) + '">' + _esc(c.image) + '</td>'
                      + '<td class="td-docker"><span class="docker-status ' + statusClass + '">' + _esc(c.status) + '</span></td>'
                      + '<td class="td-docker docker-ports" title="' + _esc(c.ports || '-') + '">' + _esc(portsText) + '</td>'
                      + '<td class="td-docker">' + _fmtPct(c.cpuPercent || 0) + '</td>'
                      + '<td class="td-docker">' + ramText + '<div class="docker-sub">' + _fmtPct(c.memoryPercent || 0) + '</div></td>'
                      + '<td class="td-docker">' + netText + '<div class="docker-sub">RX / TX</div></td>'
                      + '<td class="td-docker">' + diskText + sizeText + '</td>'
                      + '<td class="td-docker"><div class="docker-actions">'
                          + '<div class="docker-btn" title="Play" onclick="dockerContainerAction(\\\'' + row.serverId + '\\\',\\\'' + c.id + '\\\',\\\'play\\\')">'
                          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>'
                          + '</div>'
                          + '<div class="docker-btn" title="Pause" onclick="dockerContainerAction(\\\'' + row.serverId + '\\\',\\\'' + c.id + '\\\',\\\'pause\\\')">'
                          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z"></path></svg>'
                          + '</div>'
                          + '<div class="docker-btn" title="Stop" onclick="dockerContainerAction(\\\'' + row.serverId + '\\\',\\\'' + c.id + '\\\',\\\'stop\\\')">'
                          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"></path></svg>'
                          + '</div>'
                          + '<div class="docker-btn danger" title="Recreate" onclick="dockerContainerAction(\\\'' + row.serverId + '\\\',\\\'' + c.id + '\\\',\\\'recreate\\\')">'
                          + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65z"></path></svg>'
                          + '</div>'
                      + '</div></td>'
                      + '</tr>';
              });

              html += '</tbody></table></div>';
              containerEl.innerHTML = html;
          }

          /**
           * Creates or updates a doughnut gauge chart.
           * Uses a shared valueRef so the center-text plugin always renders
           * the latest value without needing to recreate the chart instance.
           */
          function createOrUpdateGauge(canvasId, pct) {
              if (!hasChart) return null;
              pct = Math.max(0, Math.min(100, pct || 0));
              var color = _gaugeColor(pct);
              var remaining = 100 - pct;

              var existing = gaugeMap.get(canvasId);
              if (existing) {
                  existing.valueRef.value = pct;
                  existing.valueRef.color = color;
                  existing.chart.data.datasets[0].data[0] = pct;
                  existing.chart.data.datasets[0].data[1] = remaining;
                  existing.chart.data.datasets[0].backgroundColor[0] = color;
                  existing.chart.update('none');
                  return existing.chart;
              }

              var canvas = document.getElementById(canvasId);
              if (!canvas) return null;

              var valueRef = { value: pct, color: color };

              var centerPlugin = {
                  id: 'centerText_' + canvasId.replace(/[^a-z0-9]/gi, '_'),
                  afterDraw: function(chart) {
                      var ca = chart.chartArea;
                      if (!ca) return;
                      var ctx = chart.ctx;
                      var cx = (ca.left + ca.right) / 2;
                      var cy = (ca.top  + ca.bottom) / 2;
                      ctx.save();
                      ctx.textAlign    = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.font         = 'bold 13px var(--vscode-font-family, sans-serif)';
                      ctx.fillStyle    = valueRef.color;
                      ctx.fillText(valueRef.value.toFixed(1) + '%', cx, cy);
                      ctx.restore();
                  }
              };

              var chart = new Chart(canvas.getContext('2d'), {
                  type: 'doughnut',
                  data: {
                      datasets: [{
                          data: [pct, remaining],
                          backgroundColor: [color, 'rgba(128,128,128,0.12)'],
                          borderWidth: 0,
                          hoverOffset: 0
                      }]
                  },
                  options: {
                      cutout: '70%',
                      responsive: false,
                      maintainAspectRatio: false,
                      animation: { duration: 400 },
                      plugins: { legend: { display: false }, tooltip: { enabled: false } }
                  },
                  plugins: [centerPlugin]
              });

              gaugeMap.set(canvasId, { chart: chart, valueRef: valueRef });
              return chart;
          }

          function _destroyGaugesForCard(cardEl) {
              cardEl.querySelectorAll('canvas[id^="gauge-"]').forEach(function(canvas) {
                  var entry = gaugeMap.get(canvas.id);
                  if (entry) { entry.chart.destroy(); gaugeMap.delete(canvas.id); }
              });
          }

          function _sshCardHtml(m) {
              var labels = { connected: 'Conectado', connecting: 'Conectando...', error: 'Erro', disconnected: 'Desconectado' };
              var statusLabel = labels[m.status] || m.status;
              var dotClass = m.status === 'connected' ? 'online pulse-green' : m.status === 'connecting' ? 'pending' : 'offline';
              var hasMetrics = m.status === 'connected' && (m.cpu != null || m.ram || m.disks || m.network);
              var isLoadingMetrics = m.status === 'connected' && !hasMetrics;

              var gaugesHtml = '';
              if (hasMetrics) {
                  gaugesHtml = '<div class="ssh-gauges-row">';
                  if (m.cpu != null) gaugesHtml += '<div class="gauge-wrapper"><canvas id="gauge-cpu-' + m.id + '" width="110" height="110"></canvas><div class="gauge-label">CPU</div></div>';
                  if (m.ram) gaugesHtml += '<div class="gauge-wrapper"><canvas id="gauge-ram-' + m.id + '" width="110" height="110"></canvas><div class="gauge-label">RAM<br><small>' + _fmtBytes(m.ram.usedBytes) + ' / ' + _fmtBytes(m.ram.totalBytes) + '</small></div></div>';
                  (m.disks || []).slice(0, 4).forEach(function(d, i) {
                      gaugesHtml += '<div class="gauge-wrapper"><canvas id="gauge-disk-' + m.id + '-' + i + '" width="110" height="110"></canvas><div class="gauge-label">' + _esc(d.mountpoint) + '<br><small>' + _fmtBytes(d.usedBytes) + ' / ' + _fmtBytes(d.totalBytes) + '</small></div></div>';
                  });
                  if (m.energy) gaugesHtml += '<div class="gauge-wrapper energy-info"><div class="energy-icon">&#9889;</div><div class="gauge-label">Energia<br><strong>' + _esc(m.energy) + '</strong></div></div>';
                  gaugesHtml += '</div>';
              }

              var networkHtml = '';
              if (m.status === 'connected' && m.network) {
                  networkHtml = '<div class="ssh-network-row">'
                      + '<div class="ssh-network-pill"><span class="net-arrow down">&#8595;</span><span class="net-label">Download</span><strong id="net-down-' + m.id + '">' + _fmtRate(m.network.downloadBytesPerSec) + '</strong></div>'
                      + '<div class="ssh-network-pill"><span class="net-arrow up">&#8593;</span><span class="net-label">Upload</span><strong id="net-up-' + m.id + '">' + _fmtRate(m.network.uploadBytesPerSec) + '</strong></div>'
                      + '</div>';
              }


              var procsHtml = '';
              if (m.processes && m.processes.length) {
                  procsHtml = '<div class="ssh-procs-section"><div class="ssh-section-title">Top Processos (por CPU)</div><table class="proc-table"><thead><tr><th>PID</th><th>Usu\u00e1rio</th><th>CPU%</th><th>MEM%</th><th>Comando</th></tr></thead><tbody>';
                  m.processes.slice(0, 10).forEach(function(p) {
                      var cpuClass = p.cpuPercent > 50 ? 'high-usage' : p.cpuPercent > 20 ? 'mid-usage' : '';
                      procsHtml += '<tr><td>' + p.pid + '</td><td>' + _esc(p.user) + '</td><td class="' + cpuClass + '">' + p.cpuPercent.toFixed(1) + '</td><td>' + p.memPercent.toFixed(1) + '</td><td class="proc-cmd" title="' + _esc(p.command) + '">' + _esc(p.command) + '</td></tr>';
                  });
                  procsHtml += '</tbody></table></div>';
              }

              var tsHtml = m.timestamp ? '<div class="ssh-updated-at js-ssh-updated-at">Atualizado: ' + new Date(m.timestamp).toLocaleTimeString() + '</div>' : '';
              var sshIntervalSeconds = m.status === 'connected'
                  ? SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS
                  : SSH_DOCKER_CHECK_INTERVAL_OFFLINE_SECONDS;
              var nextCheckHtml = m.status === 'connected' || m.status === 'error' || m.status === 'disconnected'
                  ? '<div class="ssh-updated-at js-ssh-next-check">Próxima checagem: <strong class="countdown-ssh" data-last="' + (m.timestamp || 0) + '" data-interval="' + sshIntervalSeconds + '">' + _countdownText(m.timestamp || 0, sshIntervalSeconds) + '</strong></div>'
                  : '';
              var errHtml = m.status === 'error' ? '<div class="ssh-error-msg">&#9888;&#65039; ' + _esc(m.errorMessage || 'Erro de conex\u00e3o') + '</div>' : '';
              var connHtml = m.status === 'connecting' ? '<div class="ssh-connecting-msg">&#128260; Estabelecendo conex\u00e3o SSH...</div>' : '';
              var loadingHtml = isLoadingMetrics ? '<div class="ssh-loading-metrics"><span class="ssh-spinner"></span>Coletando m\u00e9tricas...</div>' : '';
              var deleteBtn = '<div class="action-btn delete" onclick="removeSshServer(\\\'' + m.id + '\\\')" title="Remover"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div>';

              return '<div class="ssh-server-card" data-id="' + m.id + '">'
                  + '<div class="ssh-card-header">'
                  + '<div class="ssh-title-group"><div class="status-dot ' + dotClass + '"></div><div><div class="ssh-server-name">' + _esc(m.config.label) + '</div><div class="ssh-server-host">' + _esc(m.config.username) + '@' + _esc(m.config.host) + ':' + m.config.port + '</div></div></div>'
                  + '<div style="display:flex;align-items:center;gap:8px;"><span class="ssh-status-badge ' + m.status + '">' + statusLabel + '</span>' + deleteBtn + '</div>'
                  + '</div>'
                  + errHtml + connHtml + loadingHtml
                  + gaugesHtml
                  + networkHtml
                  + procsHtml
                  + nextCheckHtml
                  + tsHtml
                  + '</div>';
          }

          function _initGauges(m) {
              if (m.status !== 'connected') return;
              requestAnimationFrame(function() {
                  if (m.cpu != null) createOrUpdateGauge('gauge-cpu-' + m.id, m.cpu.usagePercent);
                  if (m.ram)         createOrUpdateGauge('gauge-ram-' + m.id, m.ram.usagePercent);
                  (m.disks || []).slice(0, 4).forEach(function(d, i) { createOrUpdateGauge('gauge-disk-' + m.id + '-' + i, d.usagePercent); });
              });
          }

          function _updateGauges(m) {
              if (m.status !== 'connected') return;
              if (m.cpu != null) createOrUpdateGauge('gauge-cpu-' + m.id, m.cpu.usagePercent);
              if (m.ram)         createOrUpdateGauge('gauge-ram-' + m.id, m.ram.usagePercent);
              (m.disks || []).slice(0, 4).forEach(function(d, i) { createOrUpdateGauge('gauge-disk-' + m.id + '-' + i, d.usagePercent); });
          }

          function renderSshDashboard(metrics) {
              sshData = metrics || [];
              var container = document.getElementById('ssh-cards-container');
              if (!container) return;

              if (sshData.length === 0) {
                  container.innerHTML = '<div class="empty-state">Nenhum servidor SSH adicionado.<br/>Preencha o formul\u00e1rio acima para conectar ao primeiro servidor.</div>';
                  return;
              }

              var existingIds = Array.from(container.querySelectorAll('.ssh-server-card')).map(function(el) { return el.dataset.id; });
              var newIds      = sshData.map(function(m) { return m.id; });
              var needsRebuild = JSON.stringify(existingIds) !== JSON.stringify(newIds);

              // Also rebuild if a connected card now has metrics but gauge canvases don't exist yet
              if (!needsRebuild) {
                  needsRebuild = sshData.some(function(m) {
                      if (m.status !== 'connected') return false;
                      if (!m.cpu && !m.ram && !(m.disks && m.disks.length) && !m.network) return false;
                      return !document.getElementById('gauge-cpu-' + m.id) &&
                             !document.getElementById('gauge-ram-' + m.id);
                  });
              }

              if (needsRebuild) {
                  container.querySelectorAll('.ssh-server-card').forEach(function(card) { _destroyGaugesForCard(card); });
                  var html = sshData.map(_sshCardHtml).join('');
                  container.innerHTML = html;
                  sshData.forEach(function(m) {
                      _initGauges(m);
                  });
              } else {
                  sshData.forEach(function(m) {
                      _updateGauges(m);
                      var card = container.querySelector('[data-id="' + m.id + '"]');
                      if (!card) return;
                      if (m.timestamp) {
                          var tsEl = card.querySelector('.js-ssh-updated-at');
                          if (tsEl) tsEl.textContent = 'Atualizado: ' + new Date(m.timestamp).toLocaleTimeString();
                      }
                      var nextEl = card.querySelector('.countdown-ssh');
                      if (nextEl) {
                          var sshInterval = m.status === 'connected'
                              ? SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS
                              : SSH_DOCKER_CHECK_INTERVAL_OFFLINE_SECONDS;
                          nextEl.setAttribute('data-last', String(m.timestamp || 0));
                          nextEl.setAttribute('data-interval', String(sshInterval));
                          nextEl.textContent = _countdownText(m.timestamp || 0, sshInterval);
                      }
                      if (m.ram) {
                          var ramCanvas = card.querySelector('#gauge-ram-' + m.id);
                          if (ramCanvas) {
                              var lbl = ramCanvas.parentElement.querySelector('.gauge-label');
                              if (lbl) lbl.innerHTML = 'RAM<br><small>' + _fmtBytes(m.ram.usedBytes) + ' / ' + _fmtBytes(m.ram.totalBytes) + '</small>';
                          }
                      }
                      if (m.network) {
                          var downEl = card.querySelector('#net-down-' + m.id);
                          var upEl = card.querySelector('#net-up-' + m.id);
                          if (downEl) downEl.textContent = _fmtRate(m.network.downloadBytesPerSec);
                          if (upEl) upEl.textContent = _fmtRate(m.network.uploadBytesPerSec);
                      }
                  });
              }
          }

          function addSshServer() {
              var labelEl    = document.getElementById('ssh-label');
              var hostEl     = document.getElementById('ssh-host');
              var portEl     = document.getElementById('ssh-port');
              var userEl     = document.getElementById('ssh-user');
              var passEl     = document.getElementById('ssh-pass');
              var osEl       = document.getElementById('ssh-os');
              
              if (!labelEl || !hostEl || !portEl || !userEl || !passEl) {
                  console.error('SSH form elements not found');
                  return;
              }
              
              var label    = labelEl.value.trim();
              var host     = hostEl.value.trim();
              var port     = portEl.value.trim();
              var username = userEl.value.trim();
              var password = passEl.value;
              var osType   = osEl ? osEl.value : 'linux';
              if (!host || !username || !password) { alert('Host, Usu\u00e1rio e Senha s\u00e3o obrigat\u00f3rios.'); return; }
              vscode.postMessage({ type: 'addSshServer', label: label, host: host, port: port || '22', username: username, password: password, osType: osType });
              labelEl.value = '';
              hostEl.value  = '';
              portEl.value  = '';
              userEl.value  = '';
              passEl.value  = '';
          }

          function removeSshServer(id) {
              var card = document.querySelector('[data-id="' + id + '"]');
              if (card) { _destroyGaugesForCard(card); card.remove(); }
              vscode.postMessage({ type: 'removeSshServer', id: id });
          }

          function dockerContainerAction(serverId, containerId, action) {
              if (action === 'recreate') {
                  var ok = confirm('Recreate fará restart do container. Continuar?');
                  if (!ok) return;
              }
              vscode.postMessage({
                  type: 'dockerContainerAction',
                  serverId: serverId,
                  containerId: containerId,
                  action: action,
              });
          }

          function runDockerDiagnostics() {
              if (dockerDiagRunning) return;
              dockerDiagRunning = true;
              var btn = document.getElementById('btn-docker-diagnose');
              var panel = document.getElementById('docker-diagnostics-panel');
              if (btn) {
                  btn.textContent = 'Diagnosticando...';
                  btn.setAttribute('disabled', 'true');
              }
              if (panel) {
                  panel.innerHTML = '<div class="ssh-connecting-msg" style="margin:0;">Executando diagnóstico nos hosts conectados...</div>';
              }
              vscode.postMessage({ type: 'dockerDiagnosticsRequest' });
          }

          function renderDockerDiagnostics(results) {
              dockerDiagRunning = false;
              var btn = document.getElementById('btn-docker-diagnose');
              var panel = document.getElementById('docker-diagnostics-panel');
              if (btn) {
                  btn.textContent = 'Diagnóstico Docker';
                  btn.removeAttribute('disabled');
              }
              if (!panel) return;

              if (!results || results.length === 0) {
                  panel.innerHTML = '<div class="ssh-error-msg" style="margin:0;">Nenhum host SSH configurado para diagnóstico.</div>';
                  return;
              }

              var html = '<div class="docker-diag-results">';
              results.forEach(function(r) {
                  var cls = r.ok ? 'ok' : 'err';
                  html += '<details class="docker-diag-item ' + cls + '">'
                      + '<summary><span class="docker-diag-badge ' + cls + '">' + (r.ok ? 'OK' : 'ERRO') + '</span> ' + _esc(r.hostLabel || r.serverId) + '</summary>'
                      + '<pre>' + _esc(r.output || '') + '</pre>'
                      + '</details>';
              });
              html += '</div>';
              panel.innerHTML = html;
          }

          // Message bus
          window.addEventListener('message', function(event) {
              var msg = event.data;
              if (msg.type === 'updateServers') {
                  serversData = msg.servers;
                  renderDashboard();
              } else if (msg.type === 'updateSshMetrics') {
                  renderSshDashboard(msg.metrics);
                  renderDockerDashboard(msg.metrics);
              } else if (msg.type === 'dockerDiagnosticsResult') {
                  renderDockerDiagnostics(msg.results);
              }
          });

          // Setup event listeners for buttons
          var tabHttpBtn = document.getElementById('tab-http');
          var tabSshBtn = document.getElementById('tab-ssh');
          var tabDockerBtn = document.getElementById('tab-docker');
          var btnAddServer = document.getElementById('btn-add-server');
          var btnBack = document.getElementById('btn-back');
          var btnAddSsh = document.getElementById('btn-add-ssh');
          var btnDockerDiagnose = document.getElementById('btn-docker-diagnose');

          if (tabHttpBtn) tabHttpBtn.addEventListener('click', function() { showTab('http'); });
          if (tabSshBtn) tabSshBtn.addEventListener('click', function() { showTab('ssh'); });
          if (tabDockerBtn) tabDockerBtn.addEventListener('click', function() { showTab('docker'); });
          if (btnAddServer) btnAddServer.addEventListener('click', addServer);
          if (btnBack) btnBack.addEventListener('click', showDashboard);
          if (btnAddSsh) btnAddSsh.addEventListener('click', addSshServer);
          if (btnDockerDiagnose) btnDockerDiagnose.addEventListener('click', runDockerDiagnostics);

          // HTTP Enter key
          var serverUrlInput = document.getElementById('serverUrl');
          if (serverUrlInput) {
              serverUrlInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') addServer(); });
          }

          // Countdown timers for HTTP, SSH and Docker polling
          setInterval(function() {
              document.querySelectorAll('.countdown-val').forEach(function(el) {
                  var last = parseInt(el.getAttribute('data-last'), 10);
                  var interval = parseInt(el.getAttribute('data-interval'), 10) || HTTP_CHECK_INTERVAL_ONLINE_SECONDS;
                  el.innerText = _countdownText(last, interval);
              });
              document.querySelectorAll('.countdown-ssh').forEach(function(el) {
                  var last = parseInt(el.getAttribute('data-last'), 10);
                  var interval = parseInt(el.getAttribute('data-interval'), 10) || SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS;
                  el.innerText = _countdownText(last, interval);
              });
              document.querySelectorAll('.countdown-docker').forEach(function(el) {
                  var last = parseInt(el.getAttribute('data-last'), 10);
                  var interval = parseInt(el.getAttribute('data-interval'), 10) || SSH_DOCKER_CHECK_INTERVAL_ONLINE_SECONDS;
                  el.innerText = _countdownText(last, interval);
              });
          }, 1000);

          // Expose functions globally for dynamic HTML
          window.showTab = showTab;
          window.addServer = addServer;
          window.removeServer = removeServer;
          window.showDashboard = showDashboard;
          window.showDetails = showDetails;
          window.addSshServer = addSshServer;
          window.removeSshServer = removeSshServer;
          window.dockerContainerAction = dockerContainerAction;
          window.runDockerDiagnostics = runDockerDiagnostics;

      </script>
  </body>
  </html>
  `;
}

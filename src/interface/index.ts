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
          <button class="tab-btn active" id="tab-http" onclick="showTab('http')">🌐 Sites HTTP</button>
          <button class="tab-btn"        id="tab-ssh"  onclick="showTab('ssh')">💻 Servidores SSH</button>
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
                  <vscode-button appearance="primary" onclick="addServer()">Adicionar Novo Site</vscode-button>
              </div>
          </header>
          <main class="cards-grid" id="cards-container"></main>
      </div>

      <!-- VIEW: HTTP SERVER DETAILS -->
      <div id="view-server" class="view-section">
          <vscode-button appearance="secondary" class="btn-back" onclick="showDashboard()" style="margin-bottom: 24px;">&#8592; Voltar ao Dashboard</vscode-button>
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
                  <vscode-button appearance="primary"  onclick="addSshServer()">Conectar</vscode-button>
              </div>
          </div>
          <div id="ssh-cards-container" class="ssh-cards-grid"></div>
      </div>

      <script>
          const vscode = acquireVsCodeApi();

          // HTTP state
          let serversData = [];
          const chartsRegistry = new Map();
          let detailChartInstance = null;
          let activeServerId = null;
          const CHECK_INTERVAL_SECONDS = 60;

          // SSH state
          let sshData = [];
          const gaugeMap = new Map(); // canvasId -> { chart, valueRef }

          // Tab logic
          let currentTab = 'http';

          function showTab(tab) {
              currentTab = tab;
              document.getElementById('tab-http').classList.toggle('active', tab === 'http');
              document.getElementById('tab-ssh').classList.toggle('active',  tab === 'ssh');
              document.getElementById('view-ssh').classList.toggle('active', tab === 'ssh');
              if (tab === 'ssh') {
                  document.getElementById('view-dashboard').classList.remove('active');
                  document.getElementById('view-server').classList.remove('active');
              } else {
                  if (activeServerId) {
                      document.getElementById('view-server').classList.add('active');
                  } else {
                      document.getElementById('view-dashboard').classList.add('active');
                  }
              }
          }

          Chart.defaults.color = 'var(--vscode-editor-foreground)';
          Chart.defaults.font.family = 'var(--vscode-font-family)';

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
              destroyChart(serverId);
              const ctx = document.getElementById(canvasId).getContext('2d');
              const chart = new Chart(ctx, {
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
              if (detailChartInstance) { detailChartInstance.destroy(); }
              const ctx = document.getElementById('detailChart').getContext('2d');
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
              var total = serversData.length, online = 0, offline = 0;
              if (total === 0) {
                  container.innerHTML = '<div class="empty-state">Nenhum servidor monitorado.<br/>Por favor, adicione um site acima para come\u00e7ar.</div>';
                  document.getElementById('stat-total').innerText = '0';
                  document.getElementById('stat-online').innerText = '0';
                  document.getElementById('stat-offline').innerText = '0';
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
                  html += '<div class="server-card" onclick="showDetails(\'' + server.id + '\')">'
                      + '<div class="card-actions" onclick="event.stopPropagation()"><div class="action-btn delete" onclick="removeServer(\'' + server.id + '\',event)" title="Excluir"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div></div>'
                      + '<div class="card-header"><div class="card-title-group" title="' + server.url + '"><div class="status-dot ' + server.status + ' ' + dotAnimClass + '"></div><h3 class="card-title">' + server.url + '</h3></div><div class="uptime-badge" style="color:' + uptimeColor + '">' + uptime + '%</div></div>'
                      + '<div class="card-body"><div class="mini-chart-container"><canvas id="' + canvasId + '"></canvas></div><div class="github-history-bar" title="' + '\u00daltimas 24 verifica\u00e7\u00f5es' + '">' + generateHistoryBarHtml(server.history) + '</div></div>'
                      + '<div class="card-footer"><div class="footer-metric"><span class="label">\u00daltimo Ping</span><span class="value">' + pingTime + '</span></div><div class="footer-metric"><span class="label">\u00daltima Check</span><span class="value">' + checkedStr + '</span></div><div class="footer-metric"><span class="label">Pr\u00f3xima Verifica\u00e7\u00e3o</span><span class="value countdown-val" data-last="' + (server.lastChecked || 0) + '">Aguardando...</span></div></div>'
                      + '</div>';
              });
              container.innerHTML = html;
              serversData.forEach(function(server) { if (server.status !== 'pending') drawMiniChart('chart-' + server.id, server.id, server.history || []); });
              document.getElementById('stat-total').innerText = total;
              document.getElementById('stat-online').innerText = online;
              document.getElementById('stat-offline').innerText = offline;
              if (activeServerId && document.getElementById('view-server').classList.contains('active')) showDetails(activeServerId);
          }

          function addServer() {
              var input = document.getElementById('serverUrl');
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

          function _esc(str) {
              var d = document.createElement('div');
              d.textContent = String(str || '');
              return d.innerHTML;
          }

          /**
           * Creates or updates a doughnut gauge chart.
           * Uses a shared valueRef so the center-text plugin always renders
           * the latest value without needing to recreate the chart instance.
           */
          function createOrUpdateGauge(canvasId, pct) {
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
                  id: 'cp_' + canvasId.replace(/[^a-z0-9]/gi, '_'),
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
              var hasMetrics = m.status === 'connected' && (m.cpu != null || m.ram || m.disks);

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

              var procsHtml = '';
              if (m.processes && m.processes.length) {
                  procsHtml = '<div class="ssh-procs-section"><div class="ssh-section-title">Top Processos (por CPU)</div><table class="proc-table"><thead><tr><th>PID</th><th>Usu\u00e1rio</th><th>CPU%</th><th>MEM%</th><th>Comando</th></tr></thead><tbody>';
                  m.processes.slice(0, 10).forEach(function(p) {
                      var cpuClass = p.cpuPercent > 50 ? 'high-usage' : p.cpuPercent > 20 ? 'mid-usage' : '';
                      procsHtml += '<tr><td>' + p.pid + '</td><td>' + _esc(p.user) + '</td><td class="' + cpuClass + '">' + p.cpuPercent.toFixed(1) + '</td><td>' + p.memPercent.toFixed(1) + '</td><td class="proc-cmd" title="' + _esc(p.command) + '">' + _esc(p.command) + '</td></tr>';
                  });
                  procsHtml += '</tbody></table></div>';
              }

              var tsHtml = m.timestamp ? '<div class="ssh-updated-at">Atualizado: ' + new Date(m.timestamp).toLocaleTimeString() + '</div>' : '';
              var errHtml = m.status === 'error' ? '<div class="ssh-error-msg">&#9888;&#65039; ' + _esc(m.errorMessage || 'Erro de conex\u00e3o') + '</div>' : '';
              var connHtml = m.status === 'connecting' ? '<div class="ssh-connecting-msg">&#128260; Estabelecendo conex\u00e3o SSH...</div>' : '';
              var deleteBtn = '<div class="action-btn delete" onclick="removeSshServer(\'' + m.id + '\')" title="Remover"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div>';

              return '<div class="ssh-server-card" data-id="' + m.id + '">'
                  + '<div class="ssh-card-header">'
                  + '<div class="ssh-title-group"><div class="status-dot ' + dotClass + '"></div><div><div class="ssh-server-name">' + _esc(m.config.label) + '</div><div class="ssh-server-host">' + _esc(m.config.username) + '@' + _esc(m.config.host) + ':' + m.config.port + '</div></div></div>'
                  + '<div style="display:flex;align-items:center;gap:8px;"><span class="ssh-status-badge ' + m.status + '">' + statusLabel + '</span>' + deleteBtn + '</div>'
                  + '</div>'
                  + errHtml + connHtml
                  + gaugesHtml
                  + procsHtml
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

              if (needsRebuild) {
                  container.querySelectorAll('.ssh-server-card').forEach(function(card) { _destroyGaugesForCard(card); });
                  container.innerHTML = sshData.map(_sshCardHtml).join('');
                  sshData.forEach(_initGauges);
              } else {
                  sshData.forEach(function(m) {
                      _updateGauges(m);
                      var card = container.querySelector('[data-id="' + m.id + '"]');
                      if (!card) return;
                      if (m.timestamp) {
                          var tsEl = card.querySelector('.ssh-updated-at');
                          if (tsEl) tsEl.textContent = 'Atualizado: ' + new Date(m.timestamp).toLocaleTimeString();
                      }
                      if (m.ram) {
                          var ramCanvas = card.querySelector('#gauge-ram-' + m.id);
                          if (ramCanvas) {
                              var lbl = ramCanvas.parentElement.querySelector('.gauge-label');
                              if (lbl) lbl.innerHTML = 'RAM<br><small>' + _fmtBytes(m.ram.usedBytes) + ' / ' + _fmtBytes(m.ram.totalBytes) + '</small>';
                          }
                      }
                  });
              }
          }

          function addSshServer() {
              var label    = document.getElementById('ssh-label').value.trim();
              var host     = document.getElementById('ssh-host').value.trim();
              var port     = document.getElementById('ssh-port').value.trim();
              var username = document.getElementById('ssh-user').value.trim();
              var password = document.getElementById('ssh-pass').value;
              if (!host || !username || !password) { alert('Host, Usu\u00e1rio e Senha s\u00e3o obrigat\u00f3rios.'); return; }
              vscode.postMessage({ type: 'addSshServer', label: label, host: host, port: port || '22', username: username, password: password });
              document.getElementById('ssh-label').value = '';
              document.getElementById('ssh-host').value  = '';
              document.getElementById('ssh-port').value  = '';
              document.getElementById('ssh-user').value  = '';
              document.getElementById('ssh-pass').value  = '';
          }

          function removeSshServer(id) {
              var card = document.querySelector('[data-id="' + id + '"]');
              if (card) { _destroyGaugesForCard(card); card.remove(); }
              vscode.postMessage({ type: 'removeSshServer', id: id });
          }

          // Message bus
          window.addEventListener('message', function(event) {
              var msg = event.data;
              if (msg.type === 'updateServers') {
                  serversData = msg.servers;
                  renderDashboard();
              } else if (msg.type === 'updateSshMetrics') {
                  renderSshDashboard(msg.metrics);
              }
          });

          // HTTP Enter key
          document.getElementById('serverUrl').addEventListener('keydown', function(e) { if (e.key === 'Enter') addServer(); });

          // HTTP countdown timer
          setInterval(function() {
              var now = Date.now();
              document.querySelectorAll('.countdown-val').forEach(function(el) {
                  var last = parseInt(el.getAttribute('data-last'), 10);
                  if (!last) return;
                  var remaining = CHECK_INTERVAL_SECONDS - Math.floor((now - last) / 1000);
                  el.innerText = remaining > 0 ? 'em ' + remaining + 's' : 'Checando agora...';
              });
          }, 1000);

      </script>
  </body>
  </html>
  `;
}

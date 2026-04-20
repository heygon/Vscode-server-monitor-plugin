
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
          let dockerSearchQuery = '';
          let selectedDockerContainerKey = null;
          // Modal / Terminal state
          let modalCurrentServerId = null;
          let modalCurrentContainerId = null;
          let modalActiveTab = 'details';
          let modalLogsRunning = false;
          let modalTerminalInstance = null;
          let modalTerminalKey = null;
          let modalTerminalRunning = false;
          let modalLogsAutoScroll = true;
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
                  metricsHtml = '<div style="color:var(--muted)">Dados do ping ainda não estão disponíveis.</div>';
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
                  container.innerHTML = '<div class="empty-state">Nenhum servidor monitorado.<br/>Por favor, adicione um site acima para começar.</div>';
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
                  if (server.lastChecked) { var s = Math.floor((Date.now() - server.lastChecked) / 1000); checkedStr = s < 60 ? s + 's atrás' : Math.floor(s / 60) + 'm atrás'; }
                  html += '<div class="server-card" onclick="showDetails(\'' + server.id + '\')">'
                      + '<div class="card-actions" onclick="event.stopPropagation()"><div class="action-btn delete" onclick="removeServer(\'' + server.id + '\',event)" title="Excluir"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div></div>'
                      + '<div class="card-header"><div class="card-title-group" title="' + server.url + '"><div class="status-dot ' + server.status + ' ' + dotAnimClass + '"></div><h3 class="card-title">' + server.url + '</h3></div><div class="uptime-badge" style="color:' + uptimeColor + '">' + uptime + '%</div></div>'
                      + '<div class="card-body"><div class="mini-chart-container"><canvas id="' + canvasId + '"></canvas></div><div class="github-history-bar" title="' + 'Últimas 24 verificações' + '">' + generateHistoryBarHtml(server.history) + '</div></div>'
                      + '<div class="card-footer"><div class="footer-metric"><span class="label">Último Ping</span><span class="value">' + pingTime + '</span></div><div class="footer-metric"><span class="label">Última Check</span><span class="value">' + checkedStr + '</span></div><div class="footer-metric"><span class="label">Próxima Verificação</span><span class="value countdown-val" data-last="' + (server.lastChecked || 0) + '" data-interval="' + (server.status === 'offline' ? HTTP_CHECK_INTERVAL_OFFLINE_SECONDS : HTTP_CHECK_INTERVAL_ONLINE_SECONDS) + '">' + _countdownText(server.lastChecked || 0, server.status === 'offline' ? HTTP_CHECK_INTERVAL_OFFLINE_SECONDS : HTTP_CHECK_INTERVAL_ONLINE_SECONDS) + '</span></div></div>'
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
                      .replace(/^0.0.0.0:d+->/, '')
                      .replace(/^[::]:d+->/, '')
                      .replace(/,?s*0.0.0.0:/g, '')
                      .replace(/,?s*[::]:/g, '')
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
                          stack: c.stack || '',
                          container: c,
                      });
                  });
              });
              return rows;
          }

          function _containerKey(row) {
              return row.serverId + ':' + row.container.id;
          }

          function _dockerMatchesSearch(row, query) {
              if (!query) return true;
              var q = query.toLowerCase();
              var c = row.container;
              var source = [
                  row.hostLabel,
                  row.hostInfo,
                  row.stack,
                  c.name,
                  c.id,
                  c.image,
                  c.status,
                  c.ports,
              ].join(' ').toLowerCase();
              return source.indexOf(q) >= 0;
          }

          function selectDockerContainer(serverId, containerId) {
              selectedDockerContainerKey = serverId + ':' + containerId;
              _renderModalContent();
              document.getElementById('docker-modal').classList.add('show');
          }

          function _renderModalContent() {
              var modal = document.getElementById('docker-modal-content');
              if (!modal) return;

              if (!selectedDockerContainerKey) {
                  modal.innerHTML = '<div class="empty-state">Nenhum container selecionado.</div>';
                  return;
              }

              var rows = _flattenDocker(sshData);
              var selected = rows.find(function(r) { return _containerKey(r) === selectedDockerContainerKey; });
              if (!selected) {
                  modal.innerHTML = '<div class="empty-state">Container não encontrado.</div>';
                  return;
              }

              var c = selected.container;
              var ramText = (c.memoryUsageBytes != null ? _fmtBytes(c.memoryUsageBytes) : '-') +
                  (c.memoryLimitBytes ? ' / ' + _fmtBytes(c.memoryLimitBytes) : '');
              var netText = (c.networkRxBytes != null ? _fmtBytes(c.networkRxBytes) : '0 B') +
                  ' / ' + (c.networkTxBytes != null ? _fmtBytes(c.networkTxBytes) : '0 B');
              var diskText = (c.blockReadBytes != null ? _fmtBytes(c.blockReadBytes) : '0 B') +
                  ' / ' + (c.blockWriteBytes != null ? _fmtBytes(c.blockWriteBytes) : '0 B');

              // Build modal with tabs: Details | Logs | Terminal
              modal.innerHTML = '<div class="docker-modal-container">'
                  + '<div class="docker-modal-header">'
                      + '<h2>' + _esc(c.name) + '</h2>'
                      + '<div class="docker-modal-sub">' + _esc(selected.hostInfo) + ' • Stack: ' + _esc(_dockerStackLabel(selected)) + '</div>'
                      + '<span class="docker-status ' + _dockerStatusClass(c.status) + '">' + _esc(c.status) + '</span>'
                  + '</div>'
                  + '<div class="docker-modal-tabs">'
                      + '<button class="docker-modal-tab docker-modal-tab-button active" data-tab="details">Detalhes</button>'
                      + '<button class="docker-modal-tab docker-modal-tab-button" data-tab="logs">Logs</button>'
                      + '<button class="docker-modal-tab docker-modal-tab-button" data-tab="terminal">Terminal</button>'
                  + '</div>'
                  + '<div class="docker-modal-body">'
                      + '<div class="modal-tab-panel" id="modal-tab-details">'
                          + '<div class="docker-modal-grid">'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">ID</div><div class="docker-modal-value">' + _esc(c.id) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">Imagem</div><div class="docker-modal-value">' + _esc(c.image) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">Portas</div><div class="docker-modal-value">' + _esc(_fmtDockerPorts(c.ports)) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">CPU</div><div class="docker-modal-value">' + _fmtPct(c.cpuPercent || 0) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">RAM</div><div class="docker-modal-value">' + _esc(ramText) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">Rede (RX/TX)</div><div class="docker-modal-value">' + _esc(netText) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">Disco (R/W)</div><div class="docker-modal-value">' + _esc(diskText) + '</div></div>'
                              + '<div class="docker-modal-card"><div class="docker-modal-label">Size</div><div class="docker-modal-value">' + _esc(c.size || '-') + '</div></div>'
                          + '</div>'
                      + '</div>'
                      + '<div class="modal-tab-panel" id="modal-tab-logs" style="display:none;">'
                          + '<div id="docker-logs" class="docker-logs">Aguardando logs...</div>'
                      + '</div>'
                      + '<div class="modal-tab-panel" id="modal-tab-terminal" style="display:none;">'
                          + '<div id="docker-terminal" class="docker-terminal"></div>'
                      + '</div>'
                  + '</div>'
                  + '<div class="docker-modal-actions">' + _dockerActionButtons(selected.serverId, c.id) + '</div>'
              + '</div>';

              // Set modal current context
              modalCurrentServerId = selected.serverId;
              modalCurrentContainerId = c.id;

              // Wire tab buttons
              var tabBtns = modal.querySelectorAll('.docker-modal-tab-button');
              tabBtns.forEach(function(btn) {
                  btn.addEventListener('click', function(e) {
                      var t = btn.getAttribute('data-tab');
                      _showModalTab(t, modalCurrentServerId, modalCurrentContainerId);
                  });
              });

              // Show details by default
              _showModalTab('details', modalCurrentServerId, modalCurrentContainerId);
          }

          function _dockerStackLabel(row) {
              return row.stack || 'Sem Stack identificada';
          }

          /* Modal tab and streaming helpers */
          function _showModalTab(tab, serverId, containerId) {
              modalActiveTab = tab;
              var modalRoot = document.getElementById('docker-modal-content');
              if (!modalRoot) return;
              modalRoot.querySelectorAll('.docker-modal-tab-button').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
              modalRoot.querySelectorAll('.modal-tab-panel').forEach(function(p) { p.style.display = 'none'; });
              var panel = modalRoot.querySelector('#modal-tab-' + tab);
              if (panel) panel.style.display = 'flex';

              if (tab === 'logs') {
                  _startFetchingLogs(serverId, containerId);
              } else {
                  _stopFetchingLogs();
              }

              if (tab === 'terminal') {
                  _initTerminal(serverId, containerId);
              } else {
                  _disposeTerminal();
              }
          }

          function _startFetchingLogs(serverId, containerId) {
              modalLogsRunning = true;
              modalLogsAutoScroll = true;
              modalCurrentServerId = serverId;
              modalCurrentContainerId = containerId;
              var el = document.getElementById('docker-logs');
              if (el) {
                  el.textContent = '';
                  el.onscroll = function() {
                      var nearBottom = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 12);
                      modalLogsAutoScroll = nearBottom;
                  };
              }
              vscode.postMessage({ type: 'requestContainerLogs', serverId: serverId, containerId: containerId, tail: 500 });
          }

          function _stopFetchingLogs() {
              if (!modalLogsRunning) return;
              modalLogsRunning = false;
              if (modalCurrentServerId && modalCurrentContainerId) {
                  vscode.postMessage({ type: 'stopContainerLogs', serverId: modalCurrentServerId, containerId: modalCurrentContainerId });
              }
          }

          function _appendLogChunk(text) {
              var el = document.getElementById('docker-logs');
              if (!el) return;
              var atBottom = (el.scrollTop + el.clientHeight) >= (el.scrollHeight - 10);
              el.textContent += text;
              if (atBottom || modalLogsAutoScroll) {
                  el.scrollTop = el.scrollHeight;
              }
          }

          function _initTerminal(serverId, containerId) {
              modalCurrentServerId = serverId;
              modalCurrentContainerId = containerId;
              if (!window.Terminal) {
                  var el = document.getElementById('docker-terminal');
                  if (el) el.innerHTML = '<div class="empty-state">Terminal não disponível (xterm.js não carregado)</div>';
                  return;
              }
              var key = serverId + ':' + containerId;
              if (modalTerminalInstance && modalTerminalKey === key && modalTerminalRunning) return;
              _disposeTerminal(false);
              var termEl = document.getElementById('docker-terminal');
              if (!termEl) return;
              termEl.innerHTML = '';
              modalTerminalInstance = new Terminal({ cursorBlink: true });
              modalTerminalInstance.open(termEl);
              modalTerminalInstance.focus();
              modalTerminalInstance.onData(function(data) {
                  vscode.postMessage({ type: 'containerTerminalInput', serverId: serverId, containerId: containerId, data: data });
              });
              modalTerminalKey = key;
              modalTerminalRunning = true;
              vscode.postMessage({ type: 'startContainerTerminal', serverId: serverId, containerId: containerId });
          }

          function _disposeTerminal(notifyBackend) {
              if (notifyBackend === undefined) notifyBackend = true;
              var terminalKey = modalTerminalKey;
              if (modalTerminalInstance) {
                  try { modalTerminalInstance.dispose(); } catch (e) { /* ignore */ }
                  modalTerminalInstance = null;
              }
              modalTerminalRunning = false;
              if (notifyBackend && terminalKey) {
                  var parts = terminalKey.split(':');
                  if (parts.length === 2) {
                      vscode.postMessage({ type: 'stopContainerTerminal', serverId: parts[0], containerId: parts[1] });
                  }
              }
              modalTerminalKey = null;
          }

          function _handleTerminalClosed(serverId, containerId) {
              var closedKey = serverId + ':' + containerId;
              if (modalTerminalKey && modalTerminalKey !== closedKey) return;
              modalTerminalRunning = false;
              if (modalTerminalInstance) {
                  try {
                      modalTerminalInstance.write('\r\n\r\n[Sessão encerrada]\r\n');
                  } catch (e) { /* ignore */ }
              }
              modalTerminalKey = null;
          }

          function _dockerActionButtons(serverId, containerId) {
              return '<div class="docker-actions" onclick="event.stopPropagation();">'
                  + '<div class="docker-btn" title="Play" onclick="dockerContainerAction(\'' + serverId + '\',\'' + containerId + '\',\'play\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></div>'
                  + '<div class="docker-btn" title="Pause" onclick="dockerContainerAction(\'' + serverId + '\',\'' + containerId + '\',\'pause\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z"></path></svg></div>'
                  + '<div class="docker-btn" title="Stop" onclick="dockerContainerAction(\'' + serverId + '\',\'' + containerId + '\',\'stop\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"></path></svg></div>'
                  + '<div class="docker-btn danger" title="Recreate" onclick="dockerContainerAction(\'' + serverId + '\',\'' + containerId + '\',\'recreate\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65z"></path></svg></div>'
              + '</div>';
          }

          function _renderDockerContainerCard(row) {
              var c = row.container;
              var key = _containerKey(row);
              var isSelected = selectedDockerContainerKey === key;
              var ramText = (c.memoryUsageBytes != null ? _fmtBytes(c.memoryUsageBytes) : '-') +
                  (c.memoryLimitBytes ? ' / ' + _fmtBytes(c.memoryLimitBytes) : '');
              var portsText = _fmtDockerPorts(c.ports);
              var networkText = (c.networkRxBytes != null ? _fmtBytes(c.networkRxBytes) : '0 B') + ' / ' +
                  (c.networkTxBytes != null ? _fmtBytes(c.networkTxBytes) : '0 B');

              return '<div class="docker-container-card ' + (isSelected ? 'selected' : '') + '" onclick="selectDockerContainer(\'' + row.serverId + '\',\'' + c.id + '\')">'
                  + '<div class="docker-container-card-header">'
                      + '<div>'
                          + '<div class="docker-container-name">' + _esc(c.name) + '</div>'
                          + '<div class="docker-container-id">' + _esc(c.id.substring(0, 12)) + '</div>'
                      + '</div>'
                      + '<span class="docker-status ' + _dockerStatusClass(c.status) + '">' + _esc(c.status) + '</span>'
                  + '</div>'
                  + '<div class="docker-container-meta">'
                      + '<div class="docker-meta-row"><span class="docker-meta-label">Imagem</span><span class="docker-meta-value">' + _esc(c.image) + '</span></div>'
                      + '<div class="docker-meta-row"><span class="docker-meta-label">Portas</span><span class="docker-meta-value">' + _esc(portsText) + '</span></div>'
                      + '<div class="docker-meta-row"><span class="docker-meta-label">CPU</span><span class="docker-meta-value">' + _fmtPct(c.cpuPercent || 0) + '</span></div>'
                      + '<div class="docker-meta-row"><span class="docker-meta-label">RAM</span><span class="docker-meta-value">' + _esc(ramText) + '</span></div>'
                      + '<div class="docker-meta-row"><span class="docker-meta-label">Rede</span><span class="docker-meta-value">' + _esc(networkText) + '</span></div>'
                  + '</div>'
                  + _dockerActionButtons(row.serverId, c.id)
              + '</div>';
          }

          function renderDockerDashboard(metricsList) {
              var summaryEl = document.getElementById('docker-summary');
              var containerEl = document.getElementById('docker-cards-container');
              if (!summaryEl || !containerEl) return;

              var rows = _flattenDocker(metricsList);
              var filteredRows = rows.filter(function(r) { return _dockerMatchesSearch(r, dockerSearchQuery); });
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
              summaryEl.innerHTML = 'Hosts conectados: <strong>' + connectedHosts + '</strong> • Docker disponível: <strong>' + hostsWithDocker + '</strong> • Containers: <strong>' + filteredRows.length + '</strong> / ' + rows.length + ' • Próxima atualização: <strong class="countdown-docker" data-last="' + latestDockerTimestamp + '" data-interval="' + dockerIntervalSeconds + '">' + _countdownText(latestDockerTimestamp, dockerIntervalSeconds) + '</strong>';

              // Group hosts first so Linux/Windows boxes still appear even when Docker is unavailable.
              var grouped = {};
              (metricsList || []).forEach(function(m) {
                  if (!m || m.status !== 'connected') return;
                  var osVal = (m && m.config && m.config.osType) ? String(m.config.osType).toLowerCase() : (m && m.osType ? String(m.osType).toLowerCase() : '');
                  var osType = osVal === 'windows' ? 'windows' : 'linux';
                  grouped[m.id] = {
                      hostLabel: (m.config && (m.config.label || m.config.host)) || m.id,
                      hostInfo: (m.config ? (m.config.username + '@' + m.config.host + ':' + m.config.port) : ''),
                      osType: osType,
                      rows: [],
                      dockerAvailable: !!(m.docker && m.docker.available),
                      dockerError: (m.docker && m.docker.errorMessage) ? String(m.docker.errorMessage) : '',
                  };
              });

              // Attach filtered containers to each host.
              filteredRows.forEach(function(row) {
                  if (!grouped[row.serverId]) {
                      grouped[row.serverId] = {
                          hostLabel: row.hostLabel,
                          hostInfo: row.hostInfo,
                          osType: 'linux',
                          rows: [],
                          dockerAvailable: true,
                          dockerError: '',
                      };
                  }
                  grouped[row.serverId].rows.push(row);
              });

              var hostIdsWithContent = Object.keys(grouped).filter(function(h) {
                  return grouped[h].rows.length > 0 || grouped[h].dockerAvailable === false;
              });

              if (hostIdsWithContent.length === 0) {
                  var issuesHtml = '';
                  if (dockerIssues.length > 0) {
                      issuesHtml = '<div class="ssh-error-msg" style="margin-top:12px;">' + dockerIssues.map(function(m) {
                          var host = (m.config && (m.config.label || m.config.host)) || m.id;
                          var err = (m.docker && m.docker.errorMessage) ? m.docker.errorMessage : 'Docker indisponível';
                          return _esc(host) + ': ' + _esc(err);
                      }).join('<br/>') + '</div>';
                  }
                  containerEl.innerHTML = '<div class="empty-state">Nenhum container encontrado para o filtro atual.</div>' + issuesHtml;
                  return;
              }

              var hostIds = hostIdsWithContent.sort(function(a, b) {
                  var ah = (grouped[a].hostLabel || '').toLowerCase();
                  var bh = (grouped[b].hostLabel || '').toLowerCase();
                  return ah.localeCompare(bh);
              });

              var linuxHosts = hostIds.filter(function(h) { return grouped[h].osType !== 'windows'; });
              var windowsHosts = hostIds.filter(function(h) { return grouped[h].osType === 'windows'; });

              function renderHostTable(hostId) {
                  var host = grouped[hostId];
                  var out = '';
                  out += '<section class="docker-host-box">'
                      + '<div class="docker-host-box-header">'
                          + '<div class="docker-host-box-title">' + _esc(host.hostLabel) + '</div>'
                          + '<div class="docker-host-info">' + _esc(host.hostInfo) + '</div>'
                      + '</div>'
                      + '<div class="docker-host-box-body tile-grid">';

                  if (!host.dockerAvailable && host.rows.length === 0) {
                      out += '<div class="ssh-error-msg" style="margin:0;grid-column:1 / -1;">' + _esc(host.dockerError || 'Docker indisponível para este host') + '</div>';
                  }

                  host.rows.forEach(function(row) {
                      var c = row.container;
                      var key = _containerKey(row);
                      var isSelected = selectedDockerContainerKey === key;
                      var statusClass = _dockerStatusClass(c.status);
                      var name = _esc(c.name || c.id || '');
                      var shortId = _esc((c.id || '').substring(0, 12));
                      var img = _esc(c.image || '-');
                      var portsText = _esc(_fmtDockerPorts(c.ports));

                      out += '<div class="docker-tile ' + statusClass + (isSelected ? ' selected' : '') + '" onclick="selectDockerContainer(\'' + row.serverId + '\',\'' + c.id + '\')" title="' + name + '">'
                          + '<div class="tile-top"><div class="tile-name">' + name + '</div><div class="tile-id">' + shortId + '</div></div>'
                          + '<div class="tile-mid">' + img + '</div>'
                          + '<div class="tile-bottom"><span class="tile-ports">' + portsText + '</span></div>'
                          + _dockerActionButtons(row.serverId, c.id)
                      + '</div>';
                  });

                  out += '</div></section>';
                  return out;
              }

              var html = '';
              if (linuxHosts.length) {
                  html += '<div class="docker-os-group linux"><div class="docker-os-title">Linux Hosts</div>';
                  linuxHosts.forEach(function(h) { html += renderHostTable(h); });
                  html += '</div>';
              }
              if (windowsHosts.length) {
                  html += '<div class="docker-os-group windows"><div class="docker-os-title">Windows Hosts</div>';
                  windowsHosts.forEach(function(h) { html += renderHostTable(h); });
                  html += '</div>';
              }

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
                  procsHtml = '<div class="ssh-procs-section"><div class="ssh-section-title">Top Processos (por CPU)</div><table class="proc-table"><thead><tr><th>PID</th><th>Usuário</th><th>CPU%</th><th>MEM%</th><th>Comando</th></tr></thead><tbody>';
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
              var errHtml = m.status === 'error' ? '<div class="ssh-error-msg">&#9888;&#65039; ' + _esc(m.errorMessage || 'Erro de conexão') + '</div>' : '';
              var connHtml = m.status === 'connecting' ? '<div class="ssh-connecting-msg">&#128260; Estabelecendo conexão SSH...</div>' : '';
              var loadingHtml = isLoadingMetrics ? '<div class="ssh-loading-metrics"><span class="ssh-spinner"></span>Coletando métricas...</div>' : '';
              var terminalBtn = '<vscode-button appearance="secondary" onclick="openSshTerminal(\'' + m.id + '\')">Abrir Terminal SSH</vscode-button>';
              var deleteBtn = '<div class="action-btn delete" onclick="removeSshServer(\'' + m.id + '\')" title="Remover"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 3H11V2C11 1.447 10.553 1 10 1H6C5.447 1 5 1.447 5 2V3H2V4H3V14C3 14.553 3.447 15 4 15H12C12.553 15 13 14.553 13 14V4H14V3ZM6 2H10V3H6V2ZM12 14H4V4H12V14ZM6 6H7V12H6V6ZM9 6H10V12H9V6Z"/></svg></div>';

              return '<div class="ssh-server-card" data-id="' + m.id + '">'
                  + '<div class="ssh-card-header">'
                  + '<div class="ssh-title-group"><div class="status-dot ' + dotClass + '"></div><div><div class="ssh-server-name">' + _esc(m.config.label) + '</div><div class="ssh-server-host">' + _esc(m.config.username) + '@' + _esc(m.config.host) + ':' + m.config.port + '</div></div></div>'
                  + '<div style="display:flex;align-items:center;gap:8px;">' + terminalBtn + '<span class="ssh-status-badge ' + m.status + '">' + statusLabel + '</span>' + deleteBtn + '</div>'
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
                  container.innerHTML = '<div class="empty-state">Nenhum servidor SSH adicionado.<br/>Preencha o formulário acima para conectar ao primeiro servidor.</div>';
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
              if (!host || !username || !password) { alert('Host, Usuário e Senha são obrigatórios.'); return; }
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

          function openSshTerminal(serverId) {
              vscode.postMessage({
                  type: 'openSshTerminal',
                  serverId: serverId,
              });
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
              } else if (msg.type === 'containerLogsChunk') {
                  // Append logs chunk to modal if it matches current container
                  if (msg.serverId && msg.containerId && (modalCurrentServerId + ':' + modalCurrentContainerId) === (msg.serverId + ':' + msg.containerId)) {
                      _appendLogChunk(msg.chunk || msg.data || '');
                  }
              } else if (msg.type === 'containerLogsEnd') {
                  if (msg.serverId && msg.containerId && (modalCurrentServerId + ':' + modalCurrentContainerId) === (msg.serverId + ':' + msg.containerId)) {
                      modalLogsRunning = false;
                  }
              } else if (msg.type === 'containerTerminalData') {
                  if (modalTerminalInstance && msg.data) {
                      try { modalTerminalInstance.write(msg.data); } catch (e) { /* ignore write errors */ }
                  }
              } else if (msg.type === 'containerTerminalClosed') {
                  _handleTerminalClosed(msg.serverId, msg.containerId);
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
          var dockerSearch = document.getElementById('docker-search');

          if (tabHttpBtn) tabHttpBtn.addEventListener('click', function() { showTab('http'); });
          if (tabSshBtn) tabSshBtn.addEventListener('click', function() { showTab('ssh'); });
          if (tabDockerBtn) tabDockerBtn.addEventListener('click', function() { showTab('docker'); });
          if (btnAddServer) btnAddServer.addEventListener('click', addServer);
          if (btnBack) btnBack.addEventListener('click', showDashboard);
          if (btnAddSsh) btnAddSsh.addEventListener('click', addSshServer);
          if (btnDockerDiagnose) btnDockerDiagnose.addEventListener('click', runDockerDiagnostics);
          if (dockerSearch) {
              dockerSearch.addEventListener('input', function() {
                  dockerSearchQuery = dockerSearch.value || '';
                  renderDockerDashboard(sshData);
              });
          }

          // Modal close event
          var modalClose = document.getElementById('docker-modal-close');
          if (modalClose) {
              modalClose.addEventListener('click', function() {
                  _stopFetchingLogs();
                  _disposeTerminal(true);
                  document.getElementById('docker-modal').classList.remove('show');
              });
          }
          // Close modal when clicking outside
          window.addEventListener('click', function(event) {
              var modal = document.getElementById('docker-modal');
              if (event.target === modal) {
                  _stopFetchingLogs();
                  _disposeTerminal(true);
                  modal.classList.remove('show');
              }
          });

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
          window.openSshTerminal = openSshTerminal;
          window.dockerContainerAction = dockerContainerAction;
          window.selectDockerContainer = selectDockerContainer;
          window.runDockerDiagnostics = runDockerDiagnostics;

      
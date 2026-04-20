export function Css(): string {
    return `
    <style>
        :root {
            --bg-color: var(--vscode-editor-background);
            --fg-color: var(--vscode-editor-foreground);
            --card-bg: var(--vscode-editorWidget-background);
            --card-border: var(--vscode-widget-border, var(--vscode-panel-border));
            --card-hover-border: var(--vscode-focusBorder);
            --success: #10b981;
            --danger: var(--vscode-editorError-foreground, #ef4444);
            --pending: var(--vscode-editorWarning-foreground, #f59e0b);
            --muted: var(--vscode-descriptionForeground);
            --radius-md: 6px;
            --radius-lg: 10px;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        body {
            background-color: var(--bg-color);
            color: var(--fg-color);
            margin: 0;
            padding: 24px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            overflow-y: auto;
        }

        /* VIEWS */
        .view-section {
            display: none;
            animation: fadeIn 0.3s ease-out;
            max-width: 1200px;
            margin: 0 auto;
        }

        .view-section.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* GLOBAL HEADER */
        .global-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .summary-stats {
            display: flex;
            gap: 24px;
            font-size: 14px;
            background: var(--card-bg);
            padding: 12px 24px;
            border-radius: var(--radius-lg);
            border: 1px solid var(--card-border);
            box-shadow: var(--shadow);
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .stat-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--muted);
            font-weight: 600;
        }

        .stat-value {
            font-size: 20px;
            font-weight: 700;
        }

        .stat-value.online { color: var(--success); }
        .stat-value.offline { color: var(--danger); }

        .actions-group {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        /* GRID LAYOUT */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 24px;
        }

        /* CARD COMPONENT */
        .server-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: relative;
            transition: var(--transition);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            cursor: pointer;
        }

        .server-card:hover {
            border-color: var(--card-hover-border);
            transform: translateY(-2px);
            box-shadow: var(--shadow);
            z-index: 10;
        }

        /* Hover Actions */
        .card-actions {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: var(--transition);
            z-index: 20;
        }

        .server-card:hover .card-actions {
            opacity: 1;
        }

        .action-btn {
            background: var(--bg-color);
            color: var(--fg-color);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition);
        }

        .action-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .action-btn.delete:hover {
            background: var(--danger);
            color: white;
            border-color: var(--danger);
        }

        /* Card Header */
        .card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
        }

        .card-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 70%;
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .status-dot.online { background: var(--success); }
        .status-dot.offline { background: var(--danger); }
        .status-dot.pending { background: var(--pending); }

        @keyframes pulse-green {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        
        div.pulse-green { animation: pulse-green 2s infinite; }

        .card-title {
            font-size: 16px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin: 0;
        }

        .uptime-badge {
            font-size: 16px;
            font-weight: 700;
            color: var(--success);
        }

        /* Card Body (Charts) */
        .card-body {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .mini-chart-container {
            width: 100%;
            height: 80px;
            position: relative;
            pointer-events: none;
        }

        .github-history-bar {
            display: flex;
            gap: 3px;
            width: 100%;
            height: 24px;
            background: rgba(0,0,0,0.1);
            border-radius: 4px;
            padding: 3px;
        }

        .history-square {
            flex: 1;
            height: 100%;
            border-radius: 2px;
            background: var(--card-border);
            opacity: 0.8;
            transition: var(--transition);
        }

        .history-square.online { background: var(--success); }
        .history-square.offline { background: var(--danger); }
        .history-square:hover { transform: scale(1.2); opacity: 1; }

        /* Card Footer */
        .card-footer {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            border-top: 1px solid var(--card-border);
            padding-top: 12px;
            margin-top: 4px;
        }

        .footer-metric {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .footer-metric .label {
            font-size: 10px;
            color: var(--muted);
            text-transform: uppercase;
        }

        .footer-metric .value {
            font-size: 12px;
            font-weight: 600;
        }

        /* Skeleton Animation */
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }

        .skeleton {
            background: linear-gradient(90deg, 
                var(--card-bg) 25%, 
                var(--card-border) 50%, 
                var(--card-bg) 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        }
        
        .skeleton-title { width: 60%; height: 20px; }
        .skeleton-chart { width: 100%; height: 80px; border-radius: 8px; }
        .skeleton-bar { width: 100%; height: 24px; }
        .skeleton-text { width: 80%; height: 12px; }

        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 64px 20px;
            color: var(--muted);
            background: var(--card-bg);
            border: 1px dashed var(--card-border);
            border-radius: var(--radius-lg);
        }

        /* DETAILS SCREEN GRID */
        .server-details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }

        .detail-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .detail-card .label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--muted);
        }

        .detail-card .value {
            font-size: 18px;
            font-weight: 500;
        }

        /* ── Tab Navigation ───────────────────────────────────────────── */
        .tab-nav {
            display: flex;
            gap: 4px;
            margin-bottom: 28px;
            border-bottom: 1px solid var(--card-border);
            padding-bottom: 0;
        }

        .tab-btn {
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            color: var(--muted);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            font-weight: 600;
            padding: 8px 16px;
            margin-bottom: -1px;
            transition: var(--transition);
        }

        .tab-btn:hover { color: var(--fg-color); }

        .tab-btn.active {
            color: var(--fg-color);
            border-bottom-color: var(--vscode-button-background, #0e639c);
        }

        /* ── SSH View ─────────────────────────────────────────────────── */
        .ssh-add-form {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            padding: 20px 24px;
            margin-bottom: 28px;
            box-shadow: var(--shadow);
        }

        .ssh-form-title {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
            margin: 0 0 14px;
        }

        .ssh-form-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: flex-end;
        }

        .ssh-form-row vscode-text-field {
            flex: 1 1 160px;
        }

        /* SSH server cards grid */
        .ssh-cards-grid {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .ssh-server-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            padding: 20px 24px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: var(--transition);
        }

        .ssh-server-card:hover {
            border-color: var(--card-hover-border);
            box-shadow: var(--shadow);
        }

        /* Card header */
        .ssh-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 18px;
        }

        .ssh-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .ssh-server-name {
            font-size: 16px;
            font-weight: 600;
        }

        .ssh-server-host {
            font-size: 12px;
            color: var(--muted);
            margin-top: 2px;
        }

        .ssh-status-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 20px;
            text-transform: uppercase;
        }

        .ssh-status-badge.connected   { background: rgba(16,185,129,0.15); color: var(--success); }
        .ssh-status-badge.connecting  { background: rgba(245,158,11,0.15);  color: var(--pending); }
        .ssh-status-badge.error,
        .ssh-status-badge.disconnected{ background: rgba(239,68,68,0.15);   color: var(--danger);  }

        .ssh-error-msg, .ssh-connecting-msg {
            font-size: 13px;
            padding: 8px 12px;
            border-radius: var(--radius-md);
            margin-bottom: 14px;
        }

        .ssh-error-msg       { background: rgba(239,68,68,0.1);   color: var(--danger);  }
        .ssh-connecting-msg  { background: rgba(245,158,11,0.1);  color: var(--pending); }

        .ssh-loading-metrics {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: var(--muted);
            padding: 16px 4px;
        }
        .ssh-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.15);
            border-top-color: var(--accent);
            border-radius: 50%;
            flex-shrink: 0;
            animation: ssh-spin 0.8s linear infinite;
        }
        @keyframes ssh-spin { to { transform: rotate(360deg); } }

        /* Donut gauges row */
        .ssh-gauges-row {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: flex-start;
            margin-bottom: 20px;
        }

        .gauge-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-width: 110px;
        }

        .gauge-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--muted);
            text-align: center;
            line-height: 1.4;
        }

        .gauge-label small { font-weight: 400; display: block; }

        .energy-info {
            justify-content: center;
            padding: 10px 14px;
            background: rgba(245,158,11,0.08);
            border: 1px solid rgba(245,158,11,0.25);
            border-radius: var(--radius-md);
        }

        .energy-icon { font-size: 28px; line-height: 1; }

        .ssh-network-row {
            display: flex;
            gap: 10px;
            margin-top: -4px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }

        .ssh-network-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            border: 1px solid var(--card-border);
            background: rgba(128,128,128,0.08);
            font-size: 12px;
        }

        .ssh-network-pill strong {
            color: var(--fg);
            font-size: 12px;
        }

        .net-label {
            color: var(--muted);
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.04em;
        }

        .net-arrow {
            font-weight: 700;
            font-size: 13px;
            width: 14px;
            text-align: center;
        }

        .net-arrow.down { color: var(--success); }
        .net-arrow.up { color: var(--pending); }

        .ssh-docker-section { margin-bottom: 14px; }

        .ssh-docker-empty {
            font-size: 12px;
            color: var(--muted);
            padding: 10px 0;
        }

        .docker-table-wrap {
            overflow-x: auto;
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
        }

        .docker-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1320px;
            table-layout: fixed;
            font-size: 12px;
        }

        .docker-table th:nth-child(1), .docker-table td:nth-child(1) { width: 150px; }
        .docker-table th:nth-child(2), .docker-table td:nth-child(2) { width: 150px; }
        .docker-table th:nth-child(3), .docker-table td:nth-child(3) { width: 170px; }
        .docker-table th:nth-child(4), .docker-table td:nth-child(4) { width: 110px; }

        .docker-table th:nth-child(5), .docker-table td:nth-child(5) { width: 180px; }
        .docker-table th:nth-child(6), .docker-table td:nth-child(6) { width: 80px; }
        .docker-table th:nth-child(7), .docker-table td:nth-child(7) { width: 150px; }
        .docker-table th:nth-child(8), .docker-table td:nth-child(8) { width: 150px; }
        .docker-table th:nth-child(9), .docker-table td:nth-child(9) { width: 170px; }
        .docker-table th:nth-child(10), .docker-table td:nth-child(10) { width: 140px; }

        .docker-table th,
        .docker-table td {
            padding: 8px;
            border-bottom: 1px solid rgba(128,128,128,0.08);
            vertical-align: top;
        }

        .docker-table th {
            text-align: left;
            color: var(--muted);
            font-weight: 600;
            position: sticky;
            top: 0;
            background: var(--bg-elev-1);
        }

        .docker-table tbody tr:hover td {
            background: rgba(128,128,128,0.06);
        }

        .docker-name {
            font-weight: 600;
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .docker-id,
        .docker-sub,
        .docker-size {
            color: var(--muted);
            font-size: 11px;
            margin-top: 3px;
        }

        .docker-image,
        .docker-ports {
            max-width: 220px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .docker-status {
            display: inline-flex;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .docker-status.running { background: rgba(16,185,129,0.15); color: var(--success); }
        .docker-status.paused  { background: rgba(245,158,11,0.15); color: var(--pending); }
        .docker-status.stopped { background: rgba(239,68,68,0.15); color: var(--danger); }

        /* Tile grid for compact container view */
        .docker-host-box-body.tile-grid {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
            padding: 12px;
        }

        .docker-tile {
            width: 260px;
            height: 140px;
            box-sizing: border-box;
            border-radius: 10px;
            /* reserve extra bottom padding so action buttons don't overlap content */
            padding: 12px 12px 48px 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1px solid var(--card-border);
            background: var(--bg-elev-2);
            cursor: pointer;
            transition: transform .14s ease, box-shadow .14s ease;
            position: relative;
            overflow: hidden;
        }

        .docker-tile:hover {
            transform: translateY(-8px);
            box-shadow: 0 14px 36px rgba(0,0,0,0.16);
        }

        /* Status-based backgrounds */
        .docker-tile.running { background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.22); }
        .docker-tile.paused  { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.18); }
        .docker-tile.stopped { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.18); }

        .tile-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
        .tile-name { font-size:15px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px; }
        .tile-id { font-size:12px; color:var(--muted); }
        .tile-mid { font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tile-bottom { font-size:12px; color:var(--muted); display:flex; justify-content:space-between; align-items:center; }

        /* Show action buttons in corner of tile */
        .docker-tile .docker-actions {
            display: flex;
            gap: 6px;
            position: absolute;
            left: 12px;
            bottom: 12px;
            z-index: 3;
            background: transparent;
            padding: 0;
        }

        .docker-tile .docker-actions .docker-btn {
            width: 22px;
            height: 22px;
            border-radius: 6px;
            padding: 0;
            font-size: 11px;
        }

        .docker-tile .docker-actions .docker-btn svg { width: 12px; height: 12px; }

        .docker-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .docker-btn {
            border: 1px solid var(--card-border);
            background: var(--bg-elev-2);
            color: var(--fg);
            border-radius: 6px;
            width: 30px;
            height: 30px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            cursor: pointer;
        }

        .docker-btn svg {
            width: 16px;
            height: 16px;
            display: block;
            fill: currentColor;
            stroke: none;
        }

        .docker-btn:hover { filter: brightness(1.1); }

        .docker-btn.danger {
            border-color: rgba(239,68,68,0.4);
            color: var(--danger);
        }

        .docker-diag-toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }

        .docker-diag-toolbar vscode-text-field {
            min-width: 280px;
            flex: 1;
        }

        .docker-diag-toolbar #docker-summary {
            flex: 1;
            min-width: 280px;
        }

        .docker-diag-panel {
            margin-top: 10px;
        }

        .docker-host-groups {
            display: grid;
            gap: 16px;
        }

        .docker-host-box,
        .docker-stack-group {
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            background: rgba(128,128,128,0.03);
            overflow: hidden;
        }

        .docker-host-box-header {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(128,128,128,0.08);
            background: rgba(128,128,128,0.06);
        }

        .docker-host-box-title {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .docker-host-box-body {
            display: grid;
            gap: 12px;
            padding: 14px;
        }

        .docker-stack-group > summary {
            cursor: pointer;
            list-style: none;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-size: 12px;
            font-weight: 600;
            border-bottom: 1px solid rgba(128,128,128,0.08);
            background: rgba(128,128,128,0.06);
        }

        .docker-stack-group > summary::-webkit-details-marker {
            display: none;
        }

        .docker-host-info,
        .docker-stack-count {
            color: var(--muted);
            font-size: 11px;
            font-weight: 500;
        }

        .docker-container-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 12px;
            padding: 12px;
        }

        .docker-container-card {
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            background: var(--card-bg);
            padding: 12px;
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .docker-container-card:hover {
            border-color: var(--card-hover-border);
            transform: translateY(-1px);
        }

        .docker-container-card.selected {
            border-color: rgba(16,185,129,0.65);
            box-shadow: inset 0 0 0 1px rgba(16,185,129,0.25);
            background: rgba(16,185,129,0.06);
        }

        .docker-container-card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
        }

        .docker-container-name {
            font-size: 14px;
            font-weight: 700;
            word-break: break-word;
        }

        .docker-container-id {
            color: var(--muted);
            font-size: 11px;
            margin-top: 4px;
        }

        .docker-container-meta {
            display: grid;
            gap: 8px;
        }

        .docker-meta-row {
            display: grid;
            gap: 4px;
        }

        .docker-meta-label {
            color: var(--muted);
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.04em;
        }

        .docker-meta-value {
            font-size: 12px;
            line-height: 1.4;
            word-break: break-word;
        }

        .docker-selected-panel {
            margin-top: 16px;
        }

        .docker-selected-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            padding: 14px;
        }

        .docker-selected-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
        }

        .docker-selected-title {
            font-size: 16px;
            font-weight: 700;
        }

        .docker-selected-sub {
            color: var(--muted);
            font-size: 12px;
            margin-top: 4px;
        }

        .docker-selected-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 10px;
        }

        .docker-selected-grid .detail-card {
            padding: 10px;
        }

        .docker-selected-grid .detail-card .value {
            font-size: 12px;
            line-height: 1.4;
            word-break: break-word;
        }

        .docker-selected-actions {
            margin-top: 12px;
        }

        .docker-selected-actions .docker-actions {
            justify-content: flex-end;
        }

        .docker-diag-results {
            display: grid;
            gap: 8px;
        }

        .docker-diag-item {
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            background: var(--bg-elev-1);
            overflow: hidden;
        }

        .docker-diag-item summary {
            cursor: pointer;
            list-style: none;
            padding: 9px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 600;
        }

        .docker-diag-item summary::-webkit-details-marker { display: none; }

        .docker-diag-badge {
            display: inline-flex;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.03em;
        }

        .docker-diag-badge.ok { background: rgba(16,185,129,0.18); color: var(--success); }
        .docker-diag-badge.err { background: rgba(239,68,68,0.18); color: var(--danger); }

        .docker-diag-item pre {
            margin: 0;
            padding: 10px 12px;
            border-top: 1px solid var(--card-border);
            background: var(--bg);
            max-height: 320px;
            overflow: auto;
            font-size: 11px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-word;
        }

        /* Process table */
        .ssh-procs-section { margin-top: 4px; }

        .ssh-section-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--card-border);
        }

        .proc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        .proc-table th {
            text-align: left;
            color: var(--muted);
            font-weight: 600;
            padding: 4px 8px;
            border-bottom: 1px solid var(--card-border);
        }

        .proc-table td {
            padding: 4px 8px;
            border-bottom: 1px solid rgba(128,128,128,0.08);
        }

        .proc-table tr:last-child td { border-bottom: none; }

        .proc-table tr:hover td { background: rgba(128,128,128,0.05); }

        .proc-cmd { color: var(--muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        td.high-usage { color: var(--danger);  font-weight: 700; }
        td.mid-usage  { color: var(--pending); font-weight: 600; }

        .ssh-updated-at {
            font-size: 11px;
            color: var(--muted);
            text-align: right;
            margin-top: 14px;
            opacity: 0.7;
        }


        .td-docker{
            width:100px !important;
            word-wrap: break-word;
        }
        .docker-name{
            font-size: 13px !important;
        }
        .docker-id{
            font-size: 10px !important;
        }

        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s ease-out;
        }

        .modal-content {
            background-color: var(--bg-color);
            margin: 3% auto;
            padding: 20px;
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            width: 90%;
            max-width: 1100px;
            height: 80vh;
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .docker-modal-container {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
        }

        .modal-close {
            color: var(--muted);
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            position: absolute;
            top: 10px;
            right: 20px;
        }

        .modal-close:hover,
        .modal-close:focus {
            color: var(--fg-color);
        }

        .modal.show {
            display: block;
        }

        .docker-modal-actions {
            flex-shrink: 0;
            margin-top: 12px;
        }

        .docker-modal-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 20px;
        }

        /* Modal tabs */
        .docker-modal-tabs {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .docker-modal-tab {
            padding: 8px 12px;
            border-radius: 6px;
            background: transparent;
            border: 1px solid transparent;
            cursor: pointer;
            color: var(--muted);
        }

        .docker-modal-tab-button.active {
            background: var(--card-bg);
            border-color: var(--card-border);
            color: var(--fg-color);
        }

        .docker-modal-body {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            overflow: hidden;
            min-height: 0;
        }

        .modal-tab-panel {
            display: flex;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
        }

        .docker-logs {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 6px;
            padding: 12px;
            box-sizing: border-box;
            width: 100%;
            height: 500px;
            overflow: scroll;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            overscroll-behavior: contain;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            color: var(--fg-color);
        }

        .docker-terminal {
            width: 100%;
            height: 500px;
            border: 1px solid var(--card-border);
            border-radius: 6px;
            overflow: hidden;
            min-height: 320px;
            box-sizing: border-box;
        }

        .docker-modal-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            padding: 12px;
        }

        .docker-modal-label {
            font-size: 12px;
            color: var(--muted);
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .docker-modal-value {
            font-size: 14px;
            color: var(--fg-color);
        }

        /* Docker List Styles */
        .docker-list-header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--fg-color);
        }

        .docker-host-list-block {
            margin-top: 14px;
        }

        .docker-host-list-block:first-child {
            margin-top: 0;
        }

        .docker-list-subheader {
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 8px;
        }

        .docker-os-group {
            margin-bottom: 16px;
        }

        .docker-os-title {
            font-size: 14px;
            font-weight: 700;
            margin: 8px 0 12px 2px;
            color: var(--fg-color);
        }

        .docker-list {
            list-style: none;
            padding: 0;
            margin: 0;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            overflow: hidden;
        }

        .docker-list-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--card-border);
            cursor: pointer;
            transition: var(--transition);
        }

        .docker-list-item:last-child {
            border-bottom: none;
        }

        .docker-list-item:hover {
            background: rgba(128, 128, 128, 0.05);
        }

        .docker-list-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .docker-list-name {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .docker-list-info {
            font-size: 12px;
            color: var(--muted);
        }

        /* Docker Table Styles */
        .docker-table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
            overflow: hidden;
        }

        .docker-table th {
            background: var(--vscode-titleBar-activeBackground, var(--card-bg));
            color: var(--vscode-titleBar-activeForeground, var(--fg-color));
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            border-bottom: 1px solid var(--card-border);
        }

        .docker-table td {
            padding: 12px 8px;
            border-bottom: 1px solid rgba(128,128,128,0.1);
            vertical-align: top;
        }

        .docker-table tr:hover td {
            background: rgba(128, 128, 128, 0.05);
        }

        .docker-table tr.selected td {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .docker-table tr:last-child td {
            border-bottom: none;
        }

        .docker-table-name {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .docker-table-id {
            font-size: 11px;
            color: var(--muted);
            font-family: monospace;
        }
    </style>
    `;
}
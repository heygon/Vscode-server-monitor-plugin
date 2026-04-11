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

        .docker-diag-toolbar #docker-summary {
            flex: 1;
            min-width: 280px;
        }

        .docker-diag-panel {
            margin-top: 10px;
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
    </style>
    `;
}
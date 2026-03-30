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
    </style>
    `;
}
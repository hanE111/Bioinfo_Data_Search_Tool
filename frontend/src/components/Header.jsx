import './Header.css';

function Header({ serverStatus, onToggleSidebar }) {
  const statusConfig = {
    connected: { text: 'Connected', color: '#10a37f' },
    disconnected: { text: 'Disconnected', color: '#ef4444' },
    checking: { text: 'Checking...', color: '#6b7280' },
    error: { text: 'Error', color: '#ef4444' },
  };

  const status = statusConfig[serverStatus] || statusConfig.error;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar} title="Toggle sidebar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 4L4 10L16 16L28 10L16 4Z"
                fill="#10a37f"
                opacity="0.8"
              />
              <path
                d="M4 16L16 22L28 16"
                stroke="#10a37f"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M4 22L16 28L28 22"
                stroke="#10a37f"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1>GEO Dataset Search</h1>
            <p className="subtitle">AI-Powered Genomic Data Discovery</p>
          </div>
        </div>

        <div className="header-right">
          <div className="status-indicator">
            <div
              className="status-dot"
              style={{ backgroundColor: status.color }}
            />
            <span>{status.text}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

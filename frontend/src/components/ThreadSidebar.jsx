import './ThreadSidebar.css';

function ThreadSidebar({ threads, currentThreadId, onSelectThread, onDeleteThread, isOpen }) {
  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={`thread-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2>Threads</h2>
      </div>

      <div className="thread-list">
        {threads.map(thread => (
          <div
            key={thread.id}
            className={`thread-item ${currentThreadId === thread.id ? 'active' : ''}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className="thread-info">
              <div className="thread-title">
                {thread.type === 'dataset' && (
                  <span className="thread-icon">🧬</span>
                )}
                {thread.type === 'general' && (
                  <span className="thread-icon">💬</span>
                )}
                <span className="thread-name">{thread.title}</span>
              </div>
              <div className="thread-meta">
                <span className="thread-time">{formatDate(thread.updatedAt)}</span>
                {thread.datasetId && (
                  <span className="thread-dataset-id">{thread.datasetId}</span>
                )}
              </div>
            </div>

            {thread.id !== 'general' && (
              <button
                className="thread-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete thread "${thread.title}"?`)) {
                    onDeleteThread(thread.id);
                  }
                }}
                title="Delete thread"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {threads.length === 0 && (
          <div className="no-threads">
            <p>No threads yet.</p>
            <p className="hint">Search for datasets to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ThreadSidebar;

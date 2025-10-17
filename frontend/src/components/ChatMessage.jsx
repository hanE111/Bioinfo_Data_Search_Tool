import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatMessage.css';

function ChatMessage({ message, onDatasetClick }) {
  const { role, content, timestamp, isError, metadata } = message;

  const handleDatasetClick = (datasetId) => {
    if (onDatasetClick) {
      onDatasetClick(datasetId);
    }
  };

  // Format timestamp
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message ${role} ${isError ? 'error' : ''}`}>
      <div className="message-header">
        <span className="message-role">
          {role === 'user' ? 'You' : 'GEO Assistant'}
        </span>
        <span className="message-time">
          {formatTime(timestamp)}
        </span>
      </div>

      <div className="message-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>

        {metadata?.datasets && metadata.datasets.length > 0 && (
          <div className="dataset-list">
            {metadata.datasets.slice(0, 5).map((dataset, idx) => (
              <div
                key={idx}
                className="dataset-card clickable"
                onClick={() => handleDatasetClick(dataset.id)}
                title={`Click to create thread for ${dataset.id}`}
              >
                <strong>{dataset.id}</strong>
                <p>{dataset.description || dataset.title}</p>
                <button className="create-thread-btn">
                  Open in new thread →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;

import './DownloadProgress.css';

function DownloadProgress({ progress }) {
  if (!progress) return null;

  const { stage, fileName, fileIndex, totalFiles, percent, receivedBytes, totalBytes } = progress;

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="download-progress">
      <div className="progress-header">
        <span className="progress-status">
          {stage === 'downloading' && '⬇️ Downloading'}
          {stage === 'decompressing' && '📦 Decompressing'}
          {stage === 'complete' && '✅ Complete'}
        </span>
        <span className="progress-file">
          {fileName} ({fileIndex}/{totalFiles})
        </span>
      </div>

      {stage === 'downloading' && percent !== undefined && (
        <>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="progress-details">
            <span>{percent}%</span>
            {receivedBytes && totalBytes && (
              <span>{formatBytes(receivedBytes)} / {formatBytes(totalBytes)}</span>
            )}
          </div>
        </>
      )}

      {stage === 'decompressing' && (
        <div className="progress-bar">
          <div className="progress-fill indeterminate" />
        </div>
      )}

      {stage === 'complete' && (
        <div className="progress-summary">
          Downloaded and decompressed {progress.downloadedFiles} file(s)
        </div>
      )}
    </div>
  );
}

export default DownloadProgress;

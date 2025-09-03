<script>
  import { onMount, onDestroy } from 'svelte';
  import { getDownloadQueueObservable, getRecordingsObservable } from './database.js';
  import downloadManager from './downloadManager.js';

  let downloadQueue = [];
  let recordings = [];
  let downloadStatus = {};
  let unsubscribeQueue;
  let unsubscribeRecordings;

  onMount(async () => {
    // Subscribe to download queue updates
    unsubscribeQueue = await getDownloadQueueObservable();
    unsubscribeQueue.subscribe(queue => {
      downloadQueue = queue;
    });

    // Subscribe to recordings updates
    unsubscribeRecordings = await getRecordingsObservable();
    unsubscribeRecordings.subscribe(recs => {
      recordings = recs;
    });

    // Update status periodically
    const statusInterval = setInterval(() => {
      downloadStatus = downloadManager.getDownloadStatus();
    }, 1000);

    return () => {
      clearInterval(statusInterval);
    };
  });

  onDestroy(() => {
    if (unsubscribeQueue) unsubscribeQueue.unsubscribe();
    if (unsubscribeRecordings) unsubscribeRecordings.unsubscribe();
  });

  function getRecordingById(id) {
    return recordings.find(r => r.id === id);
  }

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'downloading': return 'text-blue-600';
      case 'queued': return 'text-yellow-600';
      case 'paused': return 'text-orange-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'completed': return '✓';
      case 'downloading': return '⬇';
      case 'queued': return '⏳';
      case 'paused': return '⏸';
      case 'failed': return '✗';
      default: return '?';
    }
  }

  function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  async function pauseDownload(downloadId) {
    await downloadManager.pauseDownload(downloadId);
  }

  async function resumeDownload(downloadId) {
    await downloadManager.resumeDownload(downloadId);
  }

  async function cancelDownload(downloadId) {
    await downloadManager.cancelDownload(downloadId);
  }

  async function retryDownload(downloadId) {
    const download = downloadQueue.find(d => d.id === downloadId);
    if (download) {
      await downloadManager.addDownload(download.recordingId, download.priority);
    }
  }
</script>

<div class="download-manager">
  <div class="manager-header">
    <h3 class="manager-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download Manager
    </h3>
    <div class="status-indicators">
      <div class="status-item">
        <span class="status-label">Network:</span>
        <span class="status-value {downloadStatus.networkStatus === 'online' ? 'text-green-600' : 'text-red-600'}">
          {downloadStatus.networkStatus}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Active:</span>
        <span class="status-value">{downloadStatus.activeDownloads}/{downloadStatus.maxConcurrent}</span>
      </div>
    </div>
  </div>

  {#if downloadQueue.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <p>No downloads in queue</p>
      <span>Recordings will appear here when you start downloading</span>
    </div>
  {:else}
    <div class="download-list">
      {#each downloadQueue as download}
        {@const recording = getRecordingById(download.recordingId)}
        <div class="download-item">
          <div class="download-info">
            <div class="download-header">
              <h4 class="download-title">{recording?.title || 'Unknown Recording'}</h4>
              <div class="download-status {getStatusColor(download.status)}">
                <span class="status-icon">{getStatusIcon(download.status)}</span>
                <span class="status-text">{download.status}</span>
              </div>
            </div>
            
            {#if recording}
              <div class="recording-details">
                <span class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polygon points="10,8 16,12 10,16"/>
                  </svg>
                  {formatDuration(recording.duration)}
                </span>
                <span class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                  </svg>
                  {formatFileSize(recording.fileSize)}
                </span>
                <span class="detail-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  Priority: {download.priority}
                </span>
              </div>
            {/if}

            {#if download.progress > 0}
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {download.progress}%"></div>
                </div>
                <span class="progress-text">{download.progress}%</span>
              </div>
            {/if}

            {#if download.error}
              <div class="error-message">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {download.error}
              </div>
            {/if}
          </div>

          <div class="download-actions">
            {#if download.status === 'downloading'}
              <button class="action-btn pause-btn" on:click={() => pauseDownload(download.id)} title="Pause">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              </button>
            {:else if download.status === 'paused'}
              <button class="action-btn resume-btn" on:click={() => resumeDownload(download.id)} title="Resume">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </button>
            {:else if download.status === 'failed'}
              <button class="action-btn retry-btn" on:click={() => retryDownload(download.id)} title="Retry">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1,4 1,10 7,10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </button>
            {/if}
            
            <button class="action-btn cancel-btn" on:click={() => cancelDownload(download.id)} title="Cancel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .download-manager {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .manager-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .manager-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .manager-title svg {
    width: 1.25rem;
    height: 1.25rem;
    color: #667eea;
  }

  .status-indicators {
    display: flex;
    gap: 1rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
  }

  .status-label {
    color: #6b7280;
  }

  .status-value {
    font-weight: 600;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #94a3b8;
    text-align: center;
  }

  .empty-state svg {
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .empty-state span {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .download-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .download-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
    transition: all 0.2s ease;
  }

  .download-item:hover {
    border-color: #d1d5db;
    background: #f3f4f6;
  }

  .download-info {
    flex: 1;
    min-width: 0;
  }

  .download-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }

  .download-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .download-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .status-icon {
    font-size: 0.875rem;
  }

  .recording-details {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .detail-item svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #667eea;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    min-width: 3rem;
    text-align: right;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #ef4444;
    margin-top: 0.5rem;
  }

  .error-message svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .download-actions {
    display: flex;
    gap: 0.25rem;
    margin-left: 1rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .pause-btn {
    background: #f59e0b;
    color: white;
  }

  .pause-btn:hover {
    background: #d97706;
  }

  .resume-btn {
    background: #10b981;
    color: white;
  }

  .resume-btn:hover {
    background: #059669;
  }

  .retry-btn {
    background: #3b82f6;
    color: white;
  }

  .retry-btn:hover {
    background: #2563eb;
  }

  .cancel-btn {
    background: #ef4444;
    color: white;
  }

  .cancel-btn:hover {
    background: #dc2626;
  }

  @media (max-width: 768px) {
    .manager-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }
    
    .status-indicators {
      width: 100%;
      justify-content: space-between;
    }
    
    .download-item {
      flex-direction: column;
      gap: 1rem;
    }
    
    .download-actions {
      margin-left: 0;
      justify-content: flex-end;
    }
    
    .recording-details {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  }
</style>


import { 
  addToDownloadQueue, 
  updateDownloadProgress, 
  getDownloadQueueObservable,
  getDatabase,
  updateRecordingStatus
} from './database.js';

class DownloadManager {
  constructor() {
    this.isProcessing = false;
    this.maxConcurrentDownloads = 2;
    this.activeDownloads = new Map();
    this.retryDelays = [1000, 5000, 15000, 30000]; // Retry delays in ms
    this.networkStatus = 'online';
    
    this.init();
  }

  async init() {
    // Listen for network status changes
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
      this.pauseAllDownloads();
    });

    // Start processing queue
    this.processQueue();
  }

  async addDownload(recordingId, priority = 5) {
    try {
      const download = await addToDownloadQueue(recordingId, priority);
      console.log(`Added download to queue: ${recordingId}`);
      
      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      return download;
    } catch (error) {
      console.error('Error adding download to queue:', error);
      throw error;
    }
  }

  async processQueue() {
    if (this.isProcessing || this.networkStatus === 'offline') {
      return;
    }

    this.isProcessing = true;

    try {
      const db = await getDatabase();
      const allQueue = await db.getDownloadQueue();
      const queue = allQueue
        .filter(download => ['queued', 'failed'].includes(download.status))
        .sort((a, b) => {
          // Sort by priority (desc) then by creation time (asc)
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

      for (const download of queue) {
        if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
          break;
        }

        if (download.status === 'queued' || 
            (download.status === 'failed' && download.retryCount < download.maxRetries)) {
          this.startDownload(download);
        }
      }
    } catch (error) {
      console.error('Error processing download queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async startDownload(download) {
    if (this.activeDownloads.has(download.id)) {
      return;
    }

    this.activeDownloads.set(download.id, download);
    
    try {
      // Update status to downloading
      await updateDownloadProgress(download.id, 0, 'downloading');
      await updateRecordingStatus(download.recordingId, 'downloading', 0);

      // Get recording details
      const db = await getDatabase();
      const recording = await db.getRecordingById(download.recordingId);
      
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Start the actual download
      await this.performDownload(download, recording);

    } catch (error) {
      console.error(`Download failed for ${download.recordingId}:`, error);
      await this.handleDownloadError(download, error);
    } finally {
      this.activeDownloads.delete(download.id);
      // Continue processing queue
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  async performDownload(download, recording) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastProgressUpdate = 0;

      xhr.open('GET', recording.url, true);
      xhr.responseType = 'blob';

      // Progress tracking
      xhr.onprogress = async (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          
          // Update progress every 5% or at least every 2 seconds
          const now = Date.now();
          if (progress - lastProgressUpdate >= 5 || now - lastProgressUpdate >= 2000) {
            await updateDownloadProgress(download.id, progress);
            await updateRecordingStatus(download.recordingId, 'downloading', progress);
            lastProgressUpdate = progress;
          }
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          try {
            // Save the file using the File System Access API or download it
            await this.saveFile(recording, xhr.response);
            
            // Update status to completed
            await updateDownloadProgress(download.id, 100, 'completed');
            await updateRecordingStatus(download.recordingId, 'completed', 100);
            
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during download'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Download timeout'));
      };

      xhr.timeout = 300000; // 5 minutes timeout
      xhr.send();
    });
  }

  async saveFile(recording, blob) {
    try {
      // Try to use File System Access API if available
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${recording.title}.mp4`,
          types: [{
            description: 'Video files',
            accept: { 'video/*': ['.mp4', '.webm', '.mkv'] }
          }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Update recording with local path
        const db = await getDatabase();
        await db.updateRecordingStatus(recording.id, recording.status, recording.downloadProgress);
        
      } else {
        // Fallback to traditional download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recording.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  async handleDownloadError(download, error) {
    const newRetryCount = download.retryCount + 1;
    
    if (newRetryCount >= download.maxRetries) {
      // Max retries reached, mark as failed
      await updateDownloadProgress(download.id, 0, 'failed');
      await updateRecordingStatus(download.recordingId, 'failed', 0);
    } else {
      // Schedule retry
      const delay = this.retryDelays[Math.min(newRetryCount - 1, this.retryDelays.length - 1)];
      
      await updateDownloadProgress(download.id, 0, 'queued');
      await updateRecordingStatus(download.recordingId, 'pending', 0);
      
      setTimeout(() => {
        this.processQueue();
      }, delay);
    }
  }

  pauseAllDownloads() {
    this.activeDownloads.forEach(async (download) => {
      try {
        await updateDownloadProgress(download.id, download.progress || 0, 'paused');
        await updateRecordingStatus(download.recordingId, 'pending', download.progress || 0);
      } catch (error) {
        console.error('Error pausing download:', error);
      }
    });
    
    this.activeDownloads.clear();
  }

  async pauseDownload(downloadId) {
    const download = this.activeDownloads.get(downloadId);
    if (download) {
      await updateDownloadProgress(downloadId, download.progress || 0, 'paused');
      await updateRecordingStatus(download.recordingId, 'pending', download.progress || 0);
      this.activeDownloads.delete(downloadId);
    }
  }

  async resumeDownload(downloadId) {
    try {
      const db = await getDatabase();
      const allQueue = await db.getDownloadQueue();
      const download = allQueue.find(d => d.id === downloadId);
      
      if (download && download.status === 'paused') {
        await updateDownloadProgress(downloadId, download.progress, 'queued');
        this.processQueue();
      }
    } catch (error) {
      console.error('Error resuming download:', error);
    }
  }

  async cancelDownload(downloadId) {
    try {
      const db = await getDatabase();
      const allQueue = await db.getDownloadQueue();
      const download = allQueue.find(d => d.id === downloadId);
      
      if (download) {
        await db.removeFromDownloadQueue(downloadId);
        await updateRecordingStatus(download.recordingId, 'pending', 0);
      }
      
      this.activeDownloads.delete(downloadId);
    } catch (error) {
      console.error('Error canceling download:', error);
    }
  }

  getDownloadStatus() {
    return {
      isProcessing: this.isProcessing,
      activeDownloads: this.activeDownloads.size,
      maxConcurrent: this.maxConcurrentDownloads,
      networkStatus: this.networkStatus
    };
  }

  // Get observable for real-time updates
  getDownloadQueueObservable() {
    return getDownloadQueueObservable();
  }
}

// Create singleton instance
const downloadManager = new DownloadManager();

export default downloadManager;

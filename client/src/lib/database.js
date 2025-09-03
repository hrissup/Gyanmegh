// Simple localStorage-based database implementation
class LocalDatabase {
  constructor() {
    this.storageKey = 'virtual-classroom-db';
    this.data = this.loadData();
  }

  loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {
        courses: [],
        userProfiles: [],
        recordings: [],
        downloadQueue: []
      };
    } catch (error) {
      console.error('Error loading data:', error);
      return {
        courses: [],
        userProfiles: [],
        recordings: [],
        downloadQueue: []
      };
    }
  }

  saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  // Course operations
  async addCourse(courseData) {
    const course = {
      ...courseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };
    this.data.courses.push(course);
    this.saveData();
    return course;
  }

  async updateCourse(id, updates) {
    const courseIndex = this.data.courses.findIndex(c => c.id === id);
    if (courseIndex !== -1) {
      this.data.courses[courseIndex] = {
        ...this.data.courses[courseIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveData();
      return this.data.courses[courseIndex];
    }
    return null;
  }

  async getCourses() {
    return this.data.courses;
  }

  async getCourseById(id) {
    return this.data.courses.find(c => c.id === id) || null;
  }

  // User profile operations
  async getUserProfile(userId) {
    return this.data.userProfiles.find(p => p.id === userId) || null;
  }

  async updateUserProfile(userId, updates) {
    const profileIndex = this.data.userProfiles.findIndex(p => p.id === userId);
    if (profileIndex !== -1) {
      this.data.userProfiles[profileIndex] = {
        ...this.data.userProfiles[profileIndex],
        ...updates,
        lastActive: new Date().toISOString()
      };
      this.saveData();
      return this.data.userProfiles[profileIndex];
    }
    return null;
  }

  async createUserProfile(userData) {
    const profile = {
      ...userData,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      preferences: {
        theme: 'auto',
        notifications: true,
        autoJoin: false
      }
    };
    this.data.userProfiles.push(profile);
    this.saveData();
    return profile;
  }

  // Recording operations
  async addRecording(recordingData) {
    const recording = {
      ...recordingData,
      createdAt: new Date().toISOString(),
      downloadProgress: 0
    };
    this.data.recordings.push(recording);
    this.saveData();
    return recording;
  }

  async updateRecordingStatus(id, status, progress = null) {
    const recordingIndex = this.data.recordings.findIndex(r => r.id === id);
    if (recordingIndex !== -1) {
      const updates = { status };
      if (progress !== null) {
        updates.downloadProgress = progress;
      }
      this.data.recordings[recordingIndex] = {
        ...this.data.recordings[recordingIndex],
        ...updates
      };
      this.saveData();
      return this.data.recordings[recordingIndex];
    }
    return null;
  }

  async getRecordings(courseId = null) {
    if (courseId) {
      return this.data.recordings.filter(r => r.courseId === courseId);
    }
    return this.data.recordings;
  }

  async getRecordingById(id) {
    return this.data.recordings.find(r => r.id === id) || null;
  }

  // Download queue operations
  async addToDownloadQueue(recordingId, priority = 5) {
    const download = {
      id: `${recordingId}-${Date.now()}`,
      recordingId,
      priority,
      status: 'queued',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString()
    };
    this.data.downloadQueue.push(download);
    this.saveData();
    return download;
  }

  async updateDownloadProgress(id, progress, status = null) {
    const downloadIndex = this.data.downloadQueue.findIndex(d => d.id === id);
    if (downloadIndex !== -1) {
      const updates = { progress };
      if (status) {
        updates.status = status;
        if (status === 'completed') {
          updates.completedAt = new Date().toISOString();
        } else if (status === 'downloading' && !this.data.downloadQueue[downloadIndex].startedAt) {
          updates.startedAt = new Date().toISOString();
        }
      }
      this.data.downloadQueue[downloadIndex] = {
        ...this.data.downloadQueue[downloadIndex],
        ...updates
      };
      this.saveData();
      return this.data.downloadQueue[downloadIndex];
    }
    return null;
  }

  async getDownloadQueue() {
    return this.data.downloadQueue;
  }

  async removeFromDownloadQueue(id) {
    const index = this.data.downloadQueue.findIndex(d => d.id === id);
    if (index !== -1) {
      this.data.downloadQueue.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  // Observable-like functionality using events
  createObservable(collectionName) {
    return {
      subscribe: (callback) => {
        const interval = setInterval(() => {
          callback(this.data[collectionName]);
        }, 1000);
        return {
          unsubscribe: () => clearInterval(interval)
        };
      }
    };
  }
}

// Create singleton instance
const database = new LocalDatabase();

// Export functions that match the original API
export async function createDatabase() {
  return database;
}

export async function getDatabase() {
  return database;
}

export async function addCourse(courseData) {
  return await database.addCourse(courseData);
}

export async function updateCourse(id, updates) {
  return await database.updateCourse(id, updates);
}

export async function getUserProfile(userId) {
  return await database.getUserProfile(userId);
}

export async function updateUserProfile(userId, updates) {
  return await database.updateUserProfile(userId, updates);
}

export async function addRecording(recordingData) {
  return await database.addRecording(recordingData);
}

export async function updateRecordingStatus(id, status, progress = null) {
  return await database.updateRecordingStatus(id, status, progress);
}

export async function addToDownloadQueue(recordingId, priority = 5) {
  return await database.addToDownloadQueue(recordingId, priority);
}

export async function updateDownloadProgress(id, progress, status = null) {
  return await database.updateDownloadProgress(id, progress, status);
}

// Observable queries
export function getCoursesObservable() {
  return Promise.resolve(database.createObservable('courses'));
}

export function getRecordingsObservable(courseId = null) {
  return Promise.resolve(database.createObservable('recordings'));
}

export function getDownloadQueueObservable() {
  return Promise.resolve(database.createObservable('downloadQueue'));
}

export function getUserProfileObservable(userId) {
  return Promise.resolve(database.createObservable('userProfiles'));
}

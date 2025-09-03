import { createDatabase, addCourse, addRecording, getUserProfile, updateUserProfile } from './database.js';
import downloadManager from './downloadManager.js';

class StorageManager {
  constructor() {
    this.isInitialized = false;
    this.db = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Initializing storage manager...');
      
      // Initialize database
      this.db = await createDatabase();
      
      // Initialize service worker
      await this.initializeServiceWorker();
      
      // Load initial data
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('Storage manager initialized successfully');
      
    } catch (error) {
      console.error('Error initializing storage manager:', error);
      throw error;
    }
  }

  async initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              this.showUpdateNotification();
            }
          });
        });
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  showUpdateNotification() {
    if (confirm('A new version of Virtual Classroom is available. Would you like to update?')) {
      // Reload the page to activate the new service worker
      window.location.reload();
    }
  }

  async loadInitialData() {
    // Check if this is the first time loading
    const isFirstTime = !localStorage.getItem('virtual-classroom-initialized');
    
    if (isFirstTime) {
      await this.createSampleData();
      localStorage.setItem('virtual-classroom-initialized', 'true');
    }
  }

  async createSampleData() {
    try {
      // Create sample courses
      const sampleCourses = [
        {
          id: 'math101',
          title: 'Introduction to Mathematics',
          description: 'Basic mathematical concepts and problem-solving techniques',
          instructor: 'Dr. Sarah Johnson',
          roomId: 'math101',
          tags: ['mathematics', 'beginner', 'foundation']
        },
        {
          id: 'physics201',
          title: 'Advanced Physics',
          description: 'Advanced concepts in classical and modern physics',
          instructor: 'Prof. Michael Chen',
          roomId: 'physics201',
          tags: ['physics', 'advanced', 'science']
        },
        {
          id: 'cs101',
          title: 'Computer Science Fundamentals',
          description: 'Introduction to programming and computer science concepts',
          instructor: 'Dr. Emily Rodriguez',
          roomId: 'cs101',
          tags: ['programming', 'computer-science', 'beginner']
        }
      ];

      for (const course of sampleCourses) {
        await addCourse(course);
      }

      // Create sample recordings
      const sampleRecordings = [
        {
          id: 'recording-1',
          courseId: 'math101',
          title: 'Algebra Basics - Part 1',
          description: 'Introduction to algebraic expressions and equations',
          duration: 3600, // 1 hour
          fileSize: 150 * 1024 * 1024, // 150MB
          url: 'https://example.com/recordings/algebra-basics-1.mp4',
          status: 'pending',
          recordedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          tags: ['algebra', 'basics', 'equations']
        },
        {
          id: 'recording-2',
          courseId: 'physics201',
          title: 'Quantum Mechanics Overview',
          description: 'Understanding the fundamentals of quantum physics',
          duration: 5400, // 1.5 hours
          fileSize: 250 * 1024 * 1024, // 250MB
          url: 'https://example.com/recordings/quantum-mechanics.mp4',
          status: 'pending',
          recordedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          tags: ['quantum', 'physics', 'advanced']
        }
      ];

      for (const recording of sampleRecordings) {
        await addRecording(recording);
      }

      console.log('Sample data created successfully');
      
    } catch (error) {
      console.error('Error creating sample data:', error);
    }
  }

  // User profile management
  async createUserProfile(userData) {
    try {
      const profile = await getUserProfile(userData.id);
      if (!profile) {
        await this.db.createUserProfile(userData);
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async updateUserPreferences(userId, preferences) {
    try {
      await updateUserProfile(userId, { preferences });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // Course management
  async getCourses() {
    try {
      return await this.db.getCourses();
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  }

  async getCourseById(courseId) {
    try {
      return await this.db.getCourseById(courseId);
    } catch (error) {
      console.error('Error fetching course:', error);
      return null;
    }
  }

  // Recording management
  async getRecordings(courseId = null) {
    try {
      return await this.db.getRecordings(courseId);
    } catch (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }
  }

  async getRecordingById(recordingId) {
    try {
      return await this.db.getRecordingById(recordingId);
    } catch (error) {
      console.error('Error fetching recording:', error);
      return null;
    }
  }

  // Download management
  async startDownload(recordingId, priority = 5) {
    try {
      return await downloadManager.addDownload(recordingId, priority);
    } catch (error) {
      console.error('Error starting download:', error);
      throw error;
    }
  }

  async getDownloadQueue() {
    try {
      return await this.db.getDownloadQueue();
    } catch (error) {
      console.error('Error fetching download queue:', error);
      return [];
    }
  }

  // Offline data management
  async saveOfflineData(key, data) {
    try {
      localStorage.setItem(`offline-${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }

  async getOfflineData(key) {
    try {
      const stored = localStorage.getItem(`offline-${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if data is not too old (24 hours)
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error retrieving offline data:', error);
      return null;
    }
  }

  async clearOfflineData(key) {
    try {
      localStorage.removeItem(`offline-${key}`);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }

  // Cache management
  async clearCache() {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Cache cleared successfully');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async getStorageUsage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return null;
    }
  }

  // Export/Import functionality
  async exportData() {
    try {
      const courses = await this.getCourses();
      const recordings = await this.getRecordings();
      const downloadQueue = await this.getDownloadQueue();
      
      const exportData = {
        courses,
        recordings,
        downloadQueue,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `virtual-classroom-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  async importData(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data
      if (!importData.version || !importData.courses || !importData.recordings) {
        throw new Error('Invalid backup file format');
      }
      
      // Import courses
      for (const course of importData.courses) {
        await addCourse(course);
      }
      
      // Import recordings
      for (const recording of importData.recordings) {
        await addRecording(recording);
      }
      
      console.log('Data imported successfully');
      
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;

/**
 * Local storage manager for student names
 * Names are stored locally and never sent to Firestore
 */

const NAMES_STORAGE_KEY = 'student_names';

export interface LocalNameData {
  [deviceId: string]: {
    name: string;
    lastUsed: string;
  };
}

class LocalNameStorage {
  // Store a name locally for a device ID
  storeName(deviceId: string, name: string): void {
    try {
      const existingData = this.getAllNames();
      existingData[deviceId] = {
        name,
        lastUsed: new Date().toISOString()
      };
      
      localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(existingData));
      console.log('Name stored locally for device:', deviceId);
    } catch (error) {
      console.error('Error storing name locally:', error);
    }
  }

  // Get a name for a device ID
  getName(deviceId: string): string | null {
    try {
      const data = this.getAllNames();
      return data[deviceId]?.name || null;
    } catch (error) {
      console.error('Error getting name:', error);
      return null;
    }
  }

  // Get all stored names
  getAllNames(): LocalNameData {
    try {
      const stored = localStorage.getItem(NAMES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error getting all names:', error);
      return {};
    }
  }

  // Clear all stored names
  clearAllNames(): void {
    try {
      localStorage.removeItem(NAMES_STORAGE_KEY);
      console.log('All names cleared from local storage');
    } catch (error) {
      console.error('Error clearing names:', error);
    }
  }

  // Clean up old names (older than 30 days)
  cleanupOldNames(): void {
    try {
      const data = this.getAllNames();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const cleanedData: LocalNameData = {};
      Object.entries(data).forEach(([deviceId, nameData]) => {
        const lastUsed = new Date(nameData.lastUsed);
        if (lastUsed > thirtyDaysAgo) {
          cleanedData[deviceId] = nameData;
        }
      });
      
      localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(cleanedData));
      console.log('Old names cleaned up');
    } catch (error) {
      console.error('Error cleaning up old names:', error);
    }
  }
}

// Create singleton instance
export const localNameStorage = new LocalNameStorage();

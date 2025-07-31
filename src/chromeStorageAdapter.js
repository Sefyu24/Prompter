/**
 * Custom storage adapter for Supabase Chrome extension integration
 * 
 * This adapter provides a Supabase-compatible storage interface that uses
 * Chrome's extension storage API instead of browser localStorage.
 * 
 * Supabase expects storage to implement: getItem, setItem, removeItem
 * All methods return Promises to handle Chrome's async storage API.
 */

/**
 * Chrome Storage Adapter for Supabase Auth
 * Provides persistent session storage using chrome.storage.local
 */
export const chromeStorageAdapter = {
  /**
   * Retrieve an item from Chrome storage
   * @param {string} key - The storage key to retrieve
   * @returns {Promise<string|null>} The stored value or null if not found
   */
  async getItem(key) {
    try {
      console.log(`ChromeStorageAdapter: Getting item "${key}"`);
      const result = await chrome.storage.local.get(key);
      const value = result[key] || null;
      console.log(`ChromeStorageAdapter: Retrieved "${key}":`, value !== null ? '(data present)' : 'null');
      return value;
    } catch (error) {
      console.error(`ChromeStorageAdapter: Error getting item "${key}":`, error);
      return null;
    }
  },

  /**
   * Store an item in Chrome storage
   * @param {string} key - The storage key
   * @param {string} value - The value to store
   * @returns {Promise<void>}
   */
  async setItem(key, value) {
    try {
      console.log(`ChromeStorageAdapter: Setting item "${key}"`);
      await chrome.storage.local.set({ [key]: value });
      console.log(`ChromeStorageAdapter: Successfully stored "${key}"`);
    } catch (error) {
      console.error(`ChromeStorageAdapter: Error setting item "${key}":`, error);
      throw error;
    }
  },

  /**
   * Remove an item from Chrome storage
   * @param {string} key - The storage key to remove
   * @returns {Promise<void>}
   */
  async removeItem(key) {
    try {
      console.log(`ChromeStorageAdapter: Removing item "${key}"`);
      await chrome.storage.local.remove(key);
      console.log(`ChromeStorageAdapter: Successfully removed "${key}"`);
    } catch (error) {
      console.error(`ChromeStorageAdapter: Error removing item "${key}":`, error);
      throw error;
    }
  }
};

/**
 * Helper function to get session data directly from Chrome storage
 * This can be used for debugging or migration purposes
 * @returns {Promise<Object|null>} The stored session data or null
 */
export async function getStoredSession() {
  try {
    const result = await chrome.storage.local.get(['sb-audlasqcnqqtfednxmdo-auth-token']);
    return result['sb-audlasqcnqqtfednxmdo-auth-token'] || null;
  } catch (error) {
    console.error('Error getting stored session:', error);
    return null;
  }
}

/**
 * Helper function to clear all Supabase auth data from Chrome storage
 * Useful for debugging or implementing logout functionality
 * @returns {Promise<void>}
 */
export async function clearStoredAuth() {
  try {
    console.log('ChromeStorageAdapter: Clearing all Supabase auth data');
    
    // Get all storage keys
    const allData = await chrome.storage.local.get(null);
    const authKeys = Object.keys(allData).filter(key => 
      key.startsWith('sb-') || key === 'session'
    );
    
    if (authKeys.length > 0) {
      await chrome.storage.local.remove(authKeys);
      console.log('ChromeStorageAdapter: Cleared auth keys:', authKeys);
    } else {
      console.log('ChromeStorageAdapter: No auth data found to clear');
    }
  } catch (error) {
    console.error('ChromeStorageAdapter: Error clearing stored auth:', error);
    throw error;
  }
}

/**
 * Helper function to debug storage contents
 * @returns {Promise<Object>} All stored data
 */
export async function debugStorageContents() {
  try {
    const allData = await chrome.storage.local.get(null);
    console.log('ChromeStorageAdapter: All storage contents:', allData);
    return allData;
  } catch (error) {
    console.error('ChromeStorageAdapter: Error debugging storage:', error);
    return {};
  }
}
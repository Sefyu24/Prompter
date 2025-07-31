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
      console.log(`ChromeStorageAdapter: Value type:`, typeof value);
      console.log(`ChromeStorageAdapter: Value preview:`, value ? (typeof value === 'string' ? value.substring(0, 100) + '...' : 'object') : 'null');
      
      await chrome.storage.local.set({ [key]: value });
      console.log(`ChromeStorageAdapter: Successfully stored "${key}"`);
      
      // Verify the storage immediately after setting
      const verification = await chrome.storage.local.get([key]);
      console.log(`ChromeStorageAdapter: Verification - item exists:`, !!verification[key]);
      
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
 * Helper function to get the access token directly from Chrome storage
 * This bypasses Supabase's getSession() call for faster token access
 * @returns {Promise<string>} The access token
 * @throws {Error} If no valid token is found
 */
export async function getStoredAccessToken() {
  try {
    console.log('ChromeStorageAdapter: Getting stored access token directly');
    const result = await chrome.storage.local.get(['sb-audlasqcnqqtfednxmdo-auth-token']);
    const sessionData = result['sb-audlasqcnqqtfednxmdo-auth-token'];
    
    console.log('ChromeStorageAdapter: Raw session data:', sessionData ? 'present' : 'null');
    console.log('ChromeStorageAdapter: Session data type:', typeof sessionData);
    
    if (!sessionData) {
      // Let's also check what's actually in storage
      const allData = await chrome.storage.local.get(null);
      const authKeys = Object.keys(allData).filter(key => key.startsWith('sb-'));
      console.log('ChromeStorageAdapter: Found storage keys starting with sb-:', authKeys);
      throw new Error('No authentication session found');
    }

    // Parse the session data if it's a string
    let parsedSession;
    try {
      parsedSession = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
    } catch (parseError) {
      console.error('ChromeStorageAdapter: Error parsing session data:', parseError);
      throw new Error('Invalid session data format');
    }

    const accessToken = parsedSession?.access_token;
    if (!accessToken) {
      throw new Error('No access token found in session');
    }

    console.log('ChromeStorageAdapter: Access token retrieved successfully');
    return accessToken;
  } catch (error) {
    console.error('ChromeStorageAdapter: Error getting stored access token:', error);
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

/**
 * Helper function to check if user appears to be authenticated
 * @returns {Promise<boolean>} True if auth data exists
 */
export async function checkAuthStatus() {
  try {
    const allData = await chrome.storage.local.get(null);
    const authKeys = Object.keys(allData).filter(key => key.startsWith('sb-'));
    console.log('ChromeStorageAdapter: Auth status check - found keys:', authKeys);
    
    // Check if we have the main session token
    const hasMainSession = !!allData['sb-audlasqcnqqtfednxmdo-auth-token'];
    console.log('ChromeStorageAdapter: Has main session token:', hasMainSession);
    
    return hasMainSession;
  } catch (error) {
    console.error('ChromeStorageAdapter: Error checking auth status:', error);
    return false;
  }
}
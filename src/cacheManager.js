/**
 * @fileoverview Advanced caching system for Chrome extension
 * @author Promptr Extension
 * @since 1.0.0
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry  
 * @property {any} data - Cached data
 * @property {number} timestamp - When data was cached
 * @property {number} ttl - Time to live in milliseconds
 * @property {string} lastModified - Server last-modified timestamp (optional)
 */

/**
 * Advanced cache manager with TTL and conditional fetching support
 * @class CacheManager
 */
export class CacheManager {
  constructor() {
    /** @type {Map<string, CacheEntry>} */
    this.memoryCache = new Map();
    
    /** @type {string} */
    this.storagePrefix = 'prompter_cache_';
    
    // Default TTLs in milliseconds
    this.defaultTTLs = {
      templates: 5 * 60 * 1000,    // 5 minutes
      stats: 1 * 60 * 1000,       // 1 minute  
      membership: 10 * 60 * 1000, // 10 minutes
      default: 5 * 60 * 1000      // 5 minutes
    };
  }

  /**
   * Gets cache key with user prefix for multi-user support
   * @param {string} key - Base cache key
   * @param {string} userId - User ID (optional)
   * @returns {string} Full cache key
   * @private
   */
  getCacheKey(key, userId = null) {
    const userPrefix = userId ? `${userId}_` : '';
    return `${this.storagePrefix}${userPrefix}${key}`;
  }

  /**
   * Gets default TTL for a cache type
   * @param {string} key - Cache key
   * @returns {number} TTL in milliseconds
   * @private
   */
  getDefaultTTL(key) {
    if (key.includes('templates')) return this.defaultTTLs.templates;
    if (key.includes('stats')) return this.defaultTTLs.stats;
    if (key.includes('membership')) return this.defaultTTLs.membership;
    return this.defaultTTLs.default;
  }

  /**
   * Retrieves data from cache with TTL validation
   * @param {string} key - Cache key
   * @param {string} userId - User ID (optional)
   * @param {number} customTTL - Custom TTL override (optional)
   * @returns {Promise<any|null>} Cached data or null if expired/missing
   */
  async get(key, userId = null, customTTL = null) {
    const cacheKey = this.getCacheKey(key, userId);
    
    try {
      // First check memory cache
      const memoryCached = this.memoryCache.get(cacheKey);
      if (memoryCached && this.isValidEntry(memoryCached, customTTL)) {
        return memoryCached.data;
      }

      // Check Chrome storage cache
      const result = await chrome.storage.local.get([cacheKey]);
      const storageCached = result[cacheKey];
      
      if (storageCached && this.isValidEntry(storageCached, customTTL)) {
        // Promote to memory cache
        this.memoryCache.set(cacheKey, storageCached);
        return storageCached.data;
      }

      return null;
    } catch (error) {
      console.warn(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Stores data in cache with TTL
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {string} userId - User ID (optional)
   * @param {number} customTTL - Custom TTL override (optional)
   * @param {string} lastModified - Server last-modified timestamp (optional)
   * @returns {Promise<void>}
   */
  async set(key, data, userId = null, customTTL = null, lastModified = null) {
    const cacheKey = this.getCacheKey(key, userId);
    const ttl = customTTL || this.getDefaultTTL(key);
    
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      lastModified
    };

    try {
      // Store in both memory and Chrome storage
      this.memoryCache.set(cacheKey, entry);
      await chrome.storage.local.set({ [cacheKey]: entry });
    } catch (error) {
      console.warn(`Cache set error for ${key}:`, error);
    }
  }

  /**
   * Checks if cached data is fresh compared to server timestamp
   * @param {string} key - Cache key
   * @param {string} serverLastModified - Server's last-modified timestamp
   * @param {string} userId - User ID (optional)
   * @returns {Promise<boolean>} True if cache is fresh
   */
  async isFresh(key, serverLastModified, userId = null) {
    if (!serverLastModified) return false;
    
    const cacheKey = this.getCacheKey(key, userId);
    
    try {
      // Check memory first
      const memoryCached = this.memoryCache.get(cacheKey);
      if (memoryCached && memoryCached.lastModified) {
        const isFresh = memoryCached.lastModified >= serverLastModified;
        return isFresh;
      }

      // Check storage
      const result = await chrome.storage.local.get([cacheKey]);
      const storageCached = result[cacheKey];
      
      if (storageCached && storageCached.lastModified) {
        const isFresh = storageCached.lastModified >= serverLastModified;
        return isFresh;
      }

      return false;
    } catch (error) {
      console.warn(`Cache freshness check error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidates cache entry
   * @param {string} key - Cache key
   * @param {string} userId - User ID (optional)
   * @returns {Promise<void>}
   */
  async invalidate(key, userId = null) {
    const cacheKey = this.getCacheKey(key, userId);
    
    try {
      // Remove from both memory and storage
      this.memoryCache.delete(cacheKey);
      await chrome.storage.local.remove([cacheKey]);
    } catch (error) {
      console.warn(`Cache invalidation error for ${key}:`, error);
    }
  }

  /**
   * Invalidates all cache entries for a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async invalidateUser(userId) {
    try {
      // Get all keys from storage
      const allStorage = await chrome.storage.local.get(null);
      const userPrefix = `${this.storagePrefix}${userId}_`;
      
      const keysToRemove = Object.keys(allStorage).filter(key => 
        key.startsWith(userPrefix)
      );

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      // Clear memory cache entries for this user
      for (const [key] of this.memoryCache) {
        if (key.startsWith(userPrefix)) {
          this.memoryCache.delete(key);
        }
      }

      // User cache invalidated silently
    } catch (error) {
      console.warn(`Cache user invalidation error for ${userId}:`, error);
    }
  }

  /**
   * Clears all expired entries
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      const allStorage = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const [key, entry] of Object.entries(allStorage)) {
        if (key.startsWith(this.storagePrefix) && !this.isValidEntry(entry)) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      // Clean memory cache
      for (const [key, entry] of this.memoryCache) {
        if (!this.isValidEntry(entry)) {
          this.memoryCache.delete(key);
        }
      }

      // Cache cleanup completed silently
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  /**
   * Checks if cache entry is valid (not expired)
   * @param {CacheEntry} entry - Cache entry
   * @param {number} customTTL - Custom TTL override (optional)  
   * @returns {boolean} True if valid
   * @private
   */
  isValidEntry(entry, customTTL = null) {
    if (!entry || typeof entry !== 'object') return false;
    
    const ttl = customTTL || entry.ttl || this.defaultTTLs.default;
    const age = Date.now() - entry.timestamp;
    
    return age < ttl;
  }

  /**
   * Gets cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    try {
      const allStorage = await chrome.storage.local.get(null);
      const cacheEntries = Object.entries(allStorage).filter(([key]) => 
        key.startsWith(this.storagePrefix)
      );

      const stats = {
        totalEntries: cacheEntries.length,
        memoryEntries: this.memoryCache.size,
        validEntries: 0,
        expiredEntries: 0,
        totalSize: 0
      };

      for (const [key, entry] of cacheEntries) {
        if (this.isValidEntry(entry)) {
          stats.validEntries++;
        } else {
          stats.expiredEntries++;
        }
        
        // Rough size estimation
        stats.totalSize += JSON.stringify(entry).length;
      }

      return stats;
    } catch (error) {
      console.warn('Cache stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Helper method for conditional GET requests with cache support
   * @param {string} url - API URL
   * @param {Object} options - Fetch options
   * @param {string} cacheKey - Cache key
   * @param {string} userId - User ID (optional)
   * @param {number} ttl - Custom TTL (optional)
   * @returns {Promise<{data: any, fromCache: boolean}>} Response data and cache status
   */
  async fetchWithCache(url, options = {}, cacheKey, userId = null, ttl = null) {
    try {
      // First try to get from cache
      const cached = await this.get(cacheKey, userId, ttl);
      if (cached) {
        return { data: cached, fromCache: true };
      }

      // Check if we have cached data with last-modified info for conditional request
      const cacheKeyFull = this.getCacheKey(cacheKey, userId);
      const result = await chrome.storage.local.get([cacheKeyFull]);
      const cachedEntry = result[cacheKeyFull];

      // Add conditional headers if we have last-modified info
      const headers = { ...options.headers };
      if (cachedEntry && cachedEntry.lastModified) {
        headers['If-Modified-Since'] = cachedEntry.lastModified;
      }

      // Make the request
      const response = await fetch(url, { ...options, headers });

      // If 304 Not Modified, use cached data
      if (response.status === 304 && cachedEntry) {
        // Update timestamp but keep data
        await this.set(cacheKey, cachedEntry.data, userId, ttl, cachedEntry.lastModified);
        return { data: cachedEntry.data, fromCache: true };
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const lastModified = response.headers.get('Last-Modified') || new Date().toISOString();

      // Cache the new data
      await this.set(cacheKey, data, userId, ttl, lastModified);

      return { data, fromCache: false };
    } catch (error) {
      console.warn(`Fetch with cache error for ${cacheKey}:`, error);
      
      // Try to return stale cache data as fallback
      const staleCache = await this.get(cacheKey, userId, Number.MAX_SAFE_INTEGER);
      if (staleCache) {
        return { data: staleCache, fromCache: true };
      }
      
      throw error;
    }
  }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Setup periodic cleanup (every 30 minutes)
if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'prompter-cache-cleanup') {
      cacheManager.cleanup();
    }
  });

  // Create cleanup alarm
  chrome.alarms.create('prompter-cache-cleanup', { 
    delayInMinutes: 30, 
    periodInMinutes: 30 
  });
}
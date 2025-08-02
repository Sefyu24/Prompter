/**
 * @fileoverview Configuration for API endpoints and environment settings
 * @author Promptr Extension
 * @since 1.0.0
 */

// Get environment variables injected by Vite at build time
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';

// API Configuration
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  WEBSITE_URL: API_BASE_URL, // Website is hosted on the same domain as API
  
  ENDPOINTS: {
    FORMAT: '/api/format',
    TEMPLATES: '/api/extension/templates',
    PROMPTR_TEMPLATES: '/api/extension/promptr-templates',
    STATS: '/api/extension/stats',
    USER: '/api/extension/user'
  },
  
  // Request configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds - increased for longer LLM requests
  
  // Get full URL for an endpoint
  getUrl(endpoint) {
    const path = this.ENDPOINTS[endpoint];
    if (!path) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    const fullUrl = `${this.BASE_URL}${path}`;
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log(`🌐 API_CONFIG.getUrl('${endpoint}'):`, {
        endpoint,
        path,
        baseUrl: this.BASE_URL,
        fullUrl
      });
    }
    return fullUrl;
  },
  
  // Get request headers with auth
  getHeaders(accessToken) {
    return {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` })
    };
  }
};

// Environment configuration
export const ENV_CONFIG = {
  ENVIRONMENT,
  IS_DEVELOPMENT: ENVIRONMENT === 'development',
  IS_PRODUCTION: ENVIRONMENT === 'production',
  
  // Feature flags based on environment
  FEATURES: {
    DEBUG_LOGGING: ENVIRONMENT === 'development',
    VERBOSE_ERRORS: ENVIRONMENT === 'development'
  }
};

// OAuth Configuration
export const OAUTH_CONFIG = {
  // Use Chrome identity API redirect URL
  getRedirectUrl() {
    return chrome.identity.getRedirectURL();
  }
};

// Development utilities
export const DEV_UTILS = {
  log(...args) {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log('[Prompter Dev]', ...args);
    }
  },
  
  warn(...args) {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.warn('[Prompter Dev]', ...args);
    }
  },
  
  error(...args) {
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.error('[Prompter Dev]', ...args);
    }
  }
};

// Development-only configuration logging
if (ENV_CONFIG.IS_DEVELOPMENT) {
  console.log('🔧 Prompter Configuration:', {
    environment: ENVIRONMENT,
    apiBaseUrl: API_BASE_URL,
    isDevelopment: ENV_CONFIG.IS_DEVELOPMENT,
    features: ENV_CONFIG.FEATURES
  });
}
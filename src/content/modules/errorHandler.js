/**
 * @fileoverview Central error handling and recovery utilities
 * @author Promptr Extension
 * @since 1.0.0
 */

/**
 * Provides centralized error handling with recovery mechanisms
 * @class ErrorHandler
 */
export class ErrorHandler {
  constructor() {
    /** @type {Map<string, number>} */
    this.errorCounts = new Map();
    
    /** @type {Array<{timestamp: number, error: Error, context: string}>} */
    this.errorHistory = [];
    
    /** @type {number} */
    this.maxHistorySize = 100;
    
    /** @type {Set<Function>} */
    this.errorListeners = new Set();
    
    this.setupGlobalErrorHandling();
  }

  /**
   * Sets up global error handling
   * @private
   */
  setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandledRejection', {
        promise: event.promise,
        reason: event.reason
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'globalError', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  /**
   * Handles an error with context and recovery attempts
   * @param {Error|string} error - Error to handle
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   * @returns {void}
   */
  handleError(error, context, metadata = {}) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorKey = `${context}:${errorObj.message}`;
    
    // Update error count
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);
    
    // Add to history
    this.addToHistory(errorObj, context, metadata);
    
    // Log error with context
    console.error(`[${context}] Error occurred:`, {
      error: errorObj,
      context,
      count,
      metadata,
      stack: errorObj.stack
    });
    
    // Notify listeners
    this.notifyListeners(errorObj, context, metadata);
    
    // Attempt recovery if possible
    this.attemptRecovery(errorObj, context, metadata);
  }

  /**
   * Wraps a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {string} context - Context for error reporting
   * @param {Object} options - Wrap options
   * @returns {Function} Wrapped function
   */
  wrapFunction(fn, context, options = {}) {
    const {
      fallback = null,
      retries = 0,
      timeout = null,
      suppressErrors = false
    } = options;

    return async (...args) => {
      let lastError;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Apply timeout if specified
          if (timeout) {
            return await this.withTimeout(fn.apply(this, args), timeout);
          } else {
            return await fn.apply(this, args);
          }
        } catch (error) {
          lastError = error;
          
          if (!suppressErrors) {
            this.handleError(error, `${context}:attempt${attempt + 1}`, {
              attempt: attempt + 1,
              maxRetries: retries + 1,
              args: args.map(arg => typeof arg)
            });
          }
          
          // Don't retry on the last attempt
          if (attempt < retries) {
            await this.wait(Math.min(1000 * Math.pow(2, attempt), 5000));
          }
        }
      }
      
      // All retries failed, try fallback
      if (fallback && typeof fallback === 'function') {
        try {
          return await fallback(...args);
        } catch (fallbackError) {
          this.handleError(fallbackError, `${context}:fallback`, {
            originalError: lastError?.message,
            fallbackError: fallbackError?.message
          });
        }
      }
      
      // No fallback or fallback failed, throw original error
      throw lastError;
    };
  }

  /**
   * Wraps a promise with timeout
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise with timeout
   */
  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout);
      })
    ]);
  }

  /**
   * Adds error to history
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} metadata - Error metadata
   * @private
   */
  addToHistory(error, context, metadata) {
    this.errorHistory.push({
      timestamp: Date.now(),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      context,
      metadata
    });
    
    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Notifies error listeners
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} metadata - Error metadata
   * @private
   */
  notifyListeners(error, context, metadata) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error, context, metadata);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });
  }

  /**
   * Attempts recovery based on error type and context
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} metadata - Error metadata
   * @private
   */
  attemptRecovery(error, context, metadata) {
    try {
      // DOM-related recovery
      if (context.includes('DOM') || error.message.includes('not found')) {
        this.attemptDOMRecovery(error, context);
      }
      
      // Message passing recovery
      if (context.includes('message') || error.message.includes('runtime')) {
        this.attemptMessageRecovery(error, context);
      }
      
      // Modal recovery
      if (context.includes('modal')) {
        this.attemptModalRecovery(error, context);
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
    }
  }

  /**
   * Attempts DOM-related recovery
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  attemptDOMRecovery(error, context) {
    
    // Check if document is ready
    if (document.readyState !== 'complete') {
      document.addEventListener('DOMContentLoaded', () => {
        // DOM ready after error, recovery possible
      }, { once: true });
    }
    
    // Clean up any orphaned elements
    this.cleanupOrphanedElements();
  }

  /**
   * Attempts message passing recovery
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  attemptMessageRecovery(error, context) {
    
    // Check if runtime is available
    if (!chrome?.runtime?.id) {
      console.warn('Chrome runtime not available, extension may be reloading');
      return;
    }
    
    // Clear any pending message handlers
    this.clearPendingMessages();
  }

  /**
   * Attempts modal recovery
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  attemptModalRecovery(error, context) {
    
    // Clean up any stuck modals
    const modals = document.querySelectorAll('.prompter-modal-overlay');
    modals.forEach(modal => {
      try {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup modal:', cleanupError);
      }
    });
  }

  /**
   * Cleans up orphaned DOM elements
   * @private
   */
  cleanupOrphanedElements() {
    try {
      // Remove any orphaned prompter elements
      const orphanedElements = document.querySelectorAll('[class*="prompter-"]:not([data-prompter-managed])');
      let cleanedCount = 0;
      
      orphanedElements.forEach(element => {
        try {
          if (!element.isConnected || !element.parentNode) {
            element.remove();
            cleanedCount++;
          }
        } catch (e) {
          // Ignore cleanup errors for individual elements
        }
      });
      
    } catch (error) {
      console.warn('Element cleanup failed:', error);
    }
  }

  /**
   * Clears pending messages
   * @private
   */
  clearPendingMessages() {
    // This would be implemented based on the specific message handling system
  }

  /**
   * Adds an error listener
   * @param {Function} listener - Error listener function
   * @returns {Function} Cleanup function
   */
  addErrorListener(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Gets error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const recentErrors = this.errorHistory.filter(
      entry => Date.now() - entry.timestamp < 60000 // Last minute
    );
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      mostCommonErrors: this.getMostCommonErrors(5)
    };
  }

  /**
   * Gets most common errors
   * @param {number} limit - Number of errors to return
   * @returns {Array} Most common errors
   * @private
   */
  getMostCommonErrors(limit = 5) {
    return Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Clears error history and counts
   * @returns {void}
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Creates a safe execution context
   * @param {Function} fn - Function to execute safely
   * @param {string} context - Execution context
   * @param {*} fallbackValue - Value to return on error
   * @returns {*} Function result or fallback value
   */
  safeExecute(fn, context, fallbackValue = null) {
    try {
      return fn();
    } catch (error) {
      this.handleError(error, context);
      return fallbackValue;
    }
  }

  /**
   * Utility wait function
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   * @private
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * User-friendly error messages for different error types
 */
export const ERROR_MESSAGES = {
  DOM_NOT_FOUND: "The page element could not be found. Please try refreshing the page.",
  DOM_NOT_ACCESSIBLE: "The page element is not accessible. Please try selecting text in a different area.",
  NETWORK_ERROR: "Connection error. Please check your internet connection and try again.",
  AUTHENTICATION_ERROR: "Authentication failed. Please sign in again through the extension popup.",
  TEMPLATE_ERROR: "Template processing failed. Please try selecting a different template.",
  PERMISSION_ERROR: "Permission denied. Please check extension permissions.",
  TIMEOUT_ERROR: "The operation took too long. Please try again.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again or contact support."
};

/**
 * Maps error types to user-friendly messages
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyErrorMessage(error) {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('not found') || message.includes('null')) {
    return ERROR_MESSAGES.DOM_NOT_FOUND;
  }
  
  if (message.includes('not accessible') || message.includes('disabled')) {
    return ERROR_MESSAGES.DOM_NOT_ACCESSIBLE;
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  if (message.includes('auth') || message.includes('token')) {
    return ERROR_MESSAGES.AUTHENTICATION_ERROR;
  }
  
  if (message.includes('template')) {
    return ERROR_MESSAGES.TEMPLATE_ERROR;
  }
  
  if (message.includes('permission')) {
    return ERROR_MESSAGES.PERMISSION_ERROR;
  }
  
  if (message.includes('timeout')) {
    return ERROR_MESSAGES.TIMEOUT_ERROR;
  }
  
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}

// Create singleton instance
export const errorHandler = new ErrorHandler();
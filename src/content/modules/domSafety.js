/**
 * @fileoverview DOM safety utilities for robust element operations
 * @author Prompter Extension
 * @since 1.0.0
 */

/**
 * Provides safe DOM operations with comprehensive error handling
 * @class DOMSafetyManager
 */
export class DOMSafetyManager {
  constructor() {
    /** @type {Set<HTMLElement>} */
    this.validatedElements = new Set();
  }

  /**
   * Safely checks if an element exists and is valid
   * @param {HTMLElement|null} element - Element to validate
   * @param {boolean} requireAttached - Whether element must be attached to DOM
   * @returns {boolean} True if element is valid
   */
  isValidElement(element, requireAttached = false) {
    try {
      if (!element) return false;
      if (!(element instanceof HTMLElement)) return false;
      
      // For newly created elements, we don't require them to be attached yet
      if (requireAttached && !element.parentNode && !document.contains(element)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.warn("Element validation failed:", error);
      return false;
    }
  }

  /**
   * Checks if element is valid and attached to DOM
   * @param {HTMLElement|null} element - Element to validate
   * @returns {boolean} True if element is valid and attached
   */
  isValidAttachedElement(element) {
    return this.isValidElement(element, true);
  }

  /**
   * Safely queries for an element with timeout and retries
   * @param {string} selector - CSS selector
   * @param {Object} options - Query options
   * @param {number} options.timeout - Maximum wait time in ms
   * @param {number} options.retries - Number of retry attempts
   * @param {HTMLElement} options.context - Context element to search within
   * @returns {Promise<HTMLElement|null>} Found element or null
   */
  async safeQuerySelector(selector, options = {}) {
    const {
      timeout = 5000,
      retries = 3,
      context = document
    } = options;

    if (!selector || typeof selector !== 'string') {
      console.warn("Invalid selector provided:", selector);
      return null;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (!this.isValidElement(context) && context !== document) {
          console.warn("Invalid context element");
          return null;
        }

        const element = context.querySelector(selector);
        if (this.isValidElement(element)) {
          this.validatedElements.add(element);
          return element;
        }

        if (attempt < retries) {
          await this.wait(Math.min(100 * Math.pow(2, attempt), 1000));
        }
      } catch (error) {
        console.warn(`Query attempt ${attempt + 1} failed:`, error);
        if (attempt === retries) {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Safely queries for multiple elements
   * @param {string} selector - CSS selector
   * @param {Object} options - Query options
   * @returns {Promise<HTMLElement[]>} Array of found elements
   */
  async safeQuerySelectorAll(selector, options = {}) {
    const { context = document } = options;

    try {
      if (!selector || typeof selector !== 'string') {
        console.warn("Invalid selector provided:", selector);
        return [];
      }

      if (!this.isValidElement(context) && context !== document) {
        console.warn("Invalid context element");
        return [];
      }

      const elements = Array.from(context.querySelectorAll(selector));
      return elements.filter(el => this.isValidElement(el));
    } catch (error) {
      console.warn("Query all failed:", error);
      return [];
    }
  }

  /**
   * Safely adds event listener with automatic cleanup
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object|boolean} options - Event options
   * @returns {Function|null} Cleanup function or null if failed
   */
  safeAddEventListener(element, event, handler, options = {}) {
    try {
      if (!this.isValidElement(element)) {
        console.warn("Cannot add event listener to invalid element");
        return null;
      }

      if (typeof handler !== 'function') {
        console.warn("Event handler must be a function");
        return null;
      }

      const wrappedHandler = (e) => {
        try {
          handler(e);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      };

      element.addEventListener(event, wrappedHandler, options);

      return () => {
        try {
          if (this.isValidElement(element)) {
            element.removeEventListener(event, wrappedHandler, options);
          }
        } catch (error) {
          console.warn("Failed to remove event listener:", error);
        }
      };
    } catch (error) {
      console.warn("Failed to add event listener:", error);
      return null;
    }
  }

  /**
   * Safely modifies element content with validation
   * @param {HTMLElement} element - Target element
   * @param {string} content - Content to set
   * @param {string} method - Method to use ('textContent', 'innerHTML', 'innerText')
   * @returns {boolean} True if successful
   */
  safeSetContent(element, content, method = 'textContent') {
    try {
      if (!this.isValidElement(element)) {
        console.warn("Cannot set content on invalid element");
        return false;
      }

      if (typeof content !== 'string') {
        console.warn("Content must be a string");
        return false;
      }

      switch (method) {
        case 'textContent':
          element.textContent = content;
          break;
        case 'innerHTML':
          element.innerHTML = this.sanitizeHTML(content);
          break;
        case 'innerText':
          element.innerText = content;
          break;
        default:
          console.warn(`Unknown content method: ${method}`);
          return false;
      }

      return true;
    } catch (error) {
      console.warn(`Failed to set content using ${method}:`, error);
      return false;
    }
  }

  /**
   * Safely modifies element attributes
   * @param {HTMLElement} element - Target element
   * @param {string} attribute - Attribute name
   * @param {string} value - Attribute value
   * @returns {boolean} True if successful
   */
  safeSetAttribute(element, attribute, value) {
    try {
      if (!this.isValidElement(element)) {
        console.warn("Cannot set attribute on invalid element");
        return false;
      }

      if (typeof attribute !== 'string' || typeof value !== 'string') {
        console.warn("Attribute name and value must be strings");
        return false;
      }

      element.setAttribute(attribute, value);
      return true;
    } catch (error) {
      console.warn(`Failed to set attribute ${attribute}:`, error);
      return false;
    }
  }

  /**
   * Safely removes element from DOM
   * @param {HTMLElement} element - Element to remove
   * @returns {boolean} True if successful
   */
  safeRemoveElement(element) {
    try {
      if (!this.isValidAttachedElement(element)) {
        return false;
      }

      if (element.parentNode) {
        element.parentNode.removeChild(element);
      } else {
        element.remove();
      }

      this.validatedElements.delete(element);
      return true;
    } catch (error) {
      console.warn("Failed to remove element:", error);
      return false;
    }
  }

  /**
   * Safely focuses an element with validation
   * @param {HTMLElement} element - Element to focus
   * @param {Object} options - Focus options
   * @returns {boolean} True if successful
   */
  safeFocus(element, options = {}) {
    try {
      if (!this.isValidElement(element)) {
        console.warn("Cannot focus invalid element");
        return false;
      }

      if (typeof element.focus !== 'function') {
        console.warn("Element is not focusable");
        return false;
      }

      element.focus(options);
      return true;
    } catch (error) {
      console.warn("Failed to focus element:", error);
      return false;
    }
  }

  /**
   * Safely checks element visibility
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if element is visible
   */
  isElementVisible(element) {
    try {
      if (!this.isValidElement(element)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      return !!(
        element.offsetWidth ||
        element.offsetHeight ||
        element.getClientRects().length
      ) && style.visibility !== 'hidden' && style.display !== 'none';
    } catch (error) {
      console.warn("Failed to check element visibility:", error);
      return false;
    }
  }

  /**
   * Safely gets element bounds
   * @param {HTMLElement} element - Element to measure
   * @returns {DOMRect|null} Element bounds or null if failed
   */
  safeGetBounds(element) {
    try {
      if (!this.isValidElement(element)) {
        return null;
      }

      return element.getBoundingClientRect();
    } catch (error) {
      console.warn("Failed to get element bounds:", error);
      return null;
    }
  }

  /**
   * Basic HTML sanitization to prevent XSS
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   * @private
   */
  sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
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

  /**
   * Cleans up tracked elements
   * @returns {void}
   */
  cleanup() {
    this.validatedElements.clear();
  }

  /**
   * Gets statistics about DOM operations
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      validatedElements: this.validatedElements.size,
      isDocumentReady: document.readyState === 'complete'
    };
  }
}

/**
 * DOM mutation observer wrapper with error handling
 * @class SafeMutationObserver
 */
export class SafeMutationObserver {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.options = options;
    this.observer = null;
    this.isObserving = false;
  }

  /**
   * Starts observing with error handling
   * @param {HTMLElement} target - Element to observe
   * @param {Object} config - Observer configuration
   * @returns {boolean} True if successful
   */
  observe(target, config = {}) {
    try {
      if (!target || !(target instanceof HTMLElement)) {
        console.warn("Invalid target for mutation observer");
        return false;
      }

      const wrappedCallback = (mutations, observer) => {
        try {
          this.callback(mutations, observer);
        } catch (error) {
          console.error("Mutation observer callback error:", error);
        }
      };

      this.observer = new MutationObserver(wrappedCallback);
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        ...config
      });

      this.isObserving = true;
      return true;
    } catch (error) {
      console.warn("Failed to start mutation observer:", error);
      return false;
    }
  }

  /**
   * Stops observing
   * @returns {void}
   */
  disconnect() {
    try {
      if (this.observer && this.isObserving) {
        this.observer.disconnect();
        this.isObserving = false;
      }
    } catch (error) {
      console.warn("Failed to disconnect mutation observer:", error);
    }
  }
}

// Create singleton instance
export const domSafetyManager = new DOMSafetyManager();
/**
 * @fileoverview Message handling utilities with retry mechanisms and error recovery
 * @author Prompter Extension
 * @since 1.0.0
 */

/**
 * Provides robust message passing with retry mechanisms
 * @class MessageHandler
 */
export class MessageHandler {
  constructor() {
    /** @type {Map<string, Function>} */
    this.messageHandlers = new Map();
    
    /** @type {number} */
    this.defaultTimeout = 10000; // 10 seconds
    
    /** @type {number} */
    this.defaultRetries = 3;
    
    /** @type {Set<string>} */
    this.pendingMessages = new Set();
  }

  /**
   * Sends message with retry mechanism and timeout
   * @param {Object} message - Message to send
   * @param {Object} options - Send options
   * @param {number} options.timeout - Timeout in milliseconds
   * @param {number} options.retries - Number of retry attempts
   * @param {boolean} options.expectResponse - Whether to expect a response
   * @returns {Promise<any>} Response or null if no response expected
   */
  async sendMessage(message, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      expectResponse = true
    } = options;

    if (!this.validateMessage(message)) {
      throw new Error("Invalid message format");
    }

    const messageId = this.generateMessageId();
    this.pendingMessages.add(messageId);

    try {
      return await this.attemptSendMessage(message, { timeout, retries, expectResponse, messageId });
    } finally {
      this.pendingMessages.delete(messageId);
    }
  }

  /**
   * Attempts to send message with retries
   * @param {Object} message - Message to send
   * @param {Object} options - Send options with messageId
   * @returns {Promise<any>} Response
   * @private
   */
  async attemptSendMessage(message, options) {
    const { timeout, retries, expectResponse, messageId } = options;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`📤 Sending message (attempt ${attempt + 1}/${retries + 1}):`, message);
        
        const response = await this.sendSingleMessage(message, timeout, expectResponse);
        
        if (expectResponse && !response) {
          throw new Error("No response received");
        }

        console.log(`✅ Message sent successfully:`, response);
        return response;

      } catch (error) {
        lastError = error;
        console.warn(`❌ Message attempt ${attempt + 1} failed:`, error);

        // Don't retry certain types of errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.wait(delay);
        }
      }
    }

    throw new Error(`Message failed after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Sends a single message with timeout
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in milliseconds
   * @param {boolean} expectResponse - Whether to expect a response
   * @returns {Promise<any>} Response
   * @private
   */
  async sendSingleMessage(message, timeout, expectResponse) {
    return new Promise((resolve, reject) => {
      // Check if chrome runtime is available
      if (!chrome?.runtime?.sendMessage) {
        reject(new Error("Chrome runtime API not available"));
        return;
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          // Check for runtime errors
          if (chrome.runtime.lastError) {
            const error = new Error(chrome.runtime.lastError.message);
            error.isRuntimeError = true;
            reject(error);
            return;
          }

          // Handle response
          if (expectResponse) {
            if (response === undefined || response === null) {
              reject(new Error("Received null/undefined response"));
              return;
            }

            if (response.error) {
              reject(new Error(response.error));
              return;
            }
          }

          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Validates message format
   * @param {Object} message - Message to validate
   * @returns {boolean} True if valid
   * @private
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      console.warn("Message must be an object");
      return false;
    }

    if (!message.action || typeof message.action !== 'string') {
      console.warn("Message must have a string action property");
      return false;
    }

    return true;
  }

  /**
   * Checks if error is non-retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if non-retryable
   * @private
   */
  isNonRetryableError(error) {
    const nonRetryableMessages = [
      'Extension context invalidated',
      'Could not establish connection',
      'The message port closed before a response was received',
      'Chrome runtime API not available'
    ];

    return nonRetryableMessages.some(msg => 
      error.message && error.message.includes(msg)
    );
  }

  /**
   * Registers a message handler
   * @param {string} action - Action to handle
   * @param {Function} handler - Handler function
   * @returns {void}
   */
  registerHandler(action, handler) {
    if (typeof action !== 'string' || typeof handler !== 'function') {
      throw new Error("Action must be string and handler must be function");
    }

    this.messageHandlers.set(action, handler);
  }

  /**
   * Handles incoming messages
   * @param {Object} message - Received message
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   * @returns {boolean} True if response will be sent asynchronously
   */
  handleMessage(message, sender, sendResponse) {
    try {
      if (!this.validateMessage(message)) {
        sendResponse({ error: "Invalid message format" });
        return false;
      }

      const handler = this.messageHandlers.get(message.action);
      
      if (!handler) {
        console.warn(`No handler registered for action: ${message.action}`);
        sendResponse({ error: `Unknown action: ${message.action}` });
        return false;
      }

      // Execute handler with error catching
      const result = handler(message, sender);

      // Handle async responses
      if (result instanceof Promise) {
        result
          .then(response => {
            try {
              sendResponse(response || { success: true });
            } catch (e) {
              console.warn("Failed to send async response:", e);
            }
          })
          .catch(error => {
            try {
              sendResponse({ error: error.message || "Handler error" });
            } catch (e) {
              console.warn("Failed to send error response:", e);
            }
          });
        
        return true; // Indicates async response
      }

      // Handle sync responses
      sendResponse(result || { success: true });
      return false;

    } catch (error) {
      console.error("Message handler error:", error);
      try {
        sendResponse({ error: error.message || "Unknown error" });
      } catch (e) {
        console.warn("Failed to send error response:", e);
      }
      return false;
    }
  }

  /**
   * Sets up message listener
   * @returns {Function} Cleanup function
   */
  setupListener() {
    const boundHandler = this.handleMessage.bind(this);
    
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(boundHandler);
      
      return () => {
        try {
          chrome.runtime.onMessage.removeListener(boundHandler);
        } catch (error) {
          console.warn("Failed to remove message listener:", error);
        }
      };
    }

    console.warn("Chrome runtime onMessage API not available");
    return () => {}; // No-op cleanup
  }

  /**
   * Generates unique message ID
   * @returns {string} Message ID
   * @private
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Gets statistics about message handling
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      registeredHandlers: this.messageHandlers.size,
      pendingMessages: this.pendingMessages.size,
      handlerActions: Array.from(this.messageHandlers.keys())
    };
  }

  /**
   * Cleans up pending messages and handlers
   * @returns {void}
   */
  cleanup() {
    this.pendingMessages.clear();
    this.messageHandlers.clear();
  }
}

/**
 * Background script communication utilities
 */
export class BackgroundCommunicator {
  constructor(messageHandler) {
    this.messageHandler = messageHandler || new MessageHandler();
  }

  /**
   * Formats text using a template
   * @param {string} templateId - Template ID
   * @param {string} selectedText - Text to format
   * @returns {Promise<string>} Formatted text
   */
  async formatText(templateId, selectedText) {
    const response = await this.messageHandler.sendMessage({
      action: 'formatWithTemplate',
      templateId,
      selectedText
    }, {
      timeout: 15000, // Longer timeout for API calls
      retries: 2
    });

    if (!response.formattedText) {
      throw new Error("No formatted text received");
    }

    return response.formattedText;
  }

  /**
   * Gets available templates
   * @returns {Promise<Array>} Templates array
   */
  async getTemplates() {
    const response = await this.messageHandler.sendMessage({
      action: 'GET_TEMPLATES'
    }, {
      timeout: 10000,
      retries: 3
    });

    if (!Array.isArray(response.templates)) {
      throw new Error("Invalid templates response");
    }

    return response.templates;
  }

  /**
   * Notifies about text selection
   * @param {string} text - Selected text
   * @param {boolean} isInInputField - Whether selection is in input field
   * @returns {Promise<void>}
   */
  async notifyTextSelection(text, isInInputField) {
    await this.messageHandler.sendMessage({
      action: 'TEXT_SELECTED',
      text,
      isInInputField
    }, {
      expectResponse: false,
      retries: 1
    });
  }
}

// Create singleton instances
export const messageHandler = new MessageHandler();
export const backgroundCommunicator = new BackgroundCommunicator(messageHandler);
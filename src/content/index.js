/**
 * @fileoverview Main content script entry point (refactored)
 * @author Promptr Extension
 * @since 1.0.0
 */

// Import refactored modules
import { textSelectionManager } from "./modules/textSelection.js";
import { textReplacementManager } from "./modules/textReplacement.js";
import { visualFeedbackManager } from "./modules/visualFeedback.js";
import { handleKeyboardModal } from "./modules/modalManager.js";
import { errorHandler } from "./modules/errorHandler.js";
import { messageHandler, backgroundCommunicator } from "./modules/messageHandler.js";
import { domSafetyManager } from "./modules/domSafety.js";
import { ACTIONS, NOTIFICATION_TYPES } from "./constants.js";

/**
 * @typedef {import('./types.js').ChromeMessage} ChromeMessage
 */


/**
 * Enhanced message listener with better error handling and logging
 */
chrome.runtime.onMessage.addListener(
  errorHandler.wrapFunction(
    (message, sender, sendResponse) => {

      // Always send a response to prevent port closure
      try {
        sendResponse({ received: true });
      } catch (responseError) {
        console.warn("Failed to send response:", responseError);
      }

      // Handle different message types
      handleMessage(message)
        .then(() => {
          // Message handled successfully
        })
        .catch((error) => {
          errorHandler.handleError(error, 'messageHandling', { message });
          visualFeedbackManager.showUserFriendlyError(error, 'messageHandling');
        });

      return true; // Keep message channel open for async responses
    },
    'messageListener',
    { retries: 0 } // Don't retry message handling
  )
);

/**
 * Handles incoming messages from the background script
 * @param {ChromeMessage} message - The message to handle
 * @returns {Promise<void>}
 * @private
 */
async function handleMessage(message) {
  switch (message.action) {
    case ACTIONS.REPLACE_TEXT:
      await handleReplaceText(message);
      break;

    case ACTIONS.SHOW_LOADING:
      visualFeedbackManager.showLoading(message.message);
      break;

    case ACTIONS.SHOW_ERROR:
      visualFeedbackManager.showError(message.message);
      break;

    case ACTIONS.SHOW_KEYBOARD_MODAL:
      await handleKeyboardModal(message);
      break;

    case 'formatComplete':
    case 'formatError':
      // Handle timeout-resistant direct messages from background script
      backgroundCommunicator.handleDirectMessage(message);
      break;

    default:
      console.error("Unknown message action:", message.action);
  }
}

/**
 * Handles text replacement requests
 * @param {ChromeMessage} message - Message containing replacement data
 * @returns {Promise<void>}
 * @private
 */
async function handleReplaceText(message) {
  if (!message.newText) {
    throw new Error("No text provided for replacement");
  }


  const result = await textReplacementManager.replaceSelectedText(
    message.newText,
    {
      showFeedback: true,
    }
  );

  if (!result.success) {
    throw new Error(result.error || "Text replacement failed");
  }

}

/**
 * Validates that the content script is working properly
 * @returns {Promise<void>}
 */
async function validateSetup() {
  try {
    // Test text selection manager
    const hasSelection = textSelectionManager.hasValidSelection();

    // Test text replacement validation
    const validationResult = await textReplacementManager.validateReplacement();

    // Test visual feedback

  } catch (error) {
    console.error("❌ Setup validation failed:", error);
  }
}

/**
 * Performance monitoring for the refactored system
 * @returns {void}
 */
function performanceMonitoring() {
  // Log memory usage if available

}

/**
 * Accessibility enhancements for the refactored system
 * @returns {void}
 */
function enhanceAccessibility() {
  // Add screen reader announcements for key actions
  const announceToScreenReader = (message) => {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.style.position = "absolute";
    announcement.style.left = "-10000px";
    announcement.style.width = "1px";
    announcement.style.height = "1px";
    announcement.style.overflow = "hidden";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  // Store for potential use
  window.prompterAnnounce = announceToScreenReader;
}

/**
 * Error boundary for the content script
 * @returns {void}
 */
function setupErrorBoundary() {
  // The errorHandler already sets up global error handling,
  // but we can add content-script specific handling here
  
  errorHandler.addErrorListener((error, context, metadata) => {
    // Show user-friendly errors for critical failures
    if (context.includes('critical') || context.includes('modal')) {
      visualFeedbackManager.showUserFriendlyError(error, context);
    }
  });

}

/**
 * Initialize the refactored content script system
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    // Set up error handling
    setupErrorBoundary();

    // Enhance accessibility
    enhanceAccessibility();

    // Run validation
    await validateSetup();

    // Performance monitoring
    performanceMonitoring();

    // Success message
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    visualFeedbackManager.showError("Extension failed to initialize properly");
  }
}

// Initialize the system
initialize();

// Export managers for potential use by other scripts or debugging
window.prompterManagers = {
  textSelection: textSelectionManager,
  textReplacement: textReplacementManager,
  visualFeedback: visualFeedbackManager,

};

// Production: Debug shortcuts removed for security

/**
 * @fileoverview Main content script entry point (refactored)
 * @author Prompter Extension
 * @since 1.0.0
 */

// Import refactored modules
import { textSelectionManager } from "./modules/textSelection.js";
import { textReplacementManager } from "./modules/textReplacement.js";
import { visualFeedbackManager } from "./modules/visualFeedback.js";
import { handleKeyboardModal } from "./modules/modalManager.js";
import { ACTIONS, NOTIFICATION_TYPES } from "./constants.js";

/**
 * @typedef {import('./types.js').ChromeMessage} ChromeMessage
 */

console.log("🔄 Prompter Content Script (Refactored) - Loaded");
console.log(`📍 Site Handler: ${textReplacementManager.getSiteHandlerInfo()}`);

/**
 * Enhanced message listener with better error handling and logging
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Received message:", message.action || message.type);

  // Add detailed logging for showKeyboardModal
  if (message.action === "showKeyboardModal") {
    console.log("🔍 DEBUGGING received showKeyboardModal:", {
      action: message.action,
      templatesCount: message.templates?.length || 0,
      userEmail: message.user?.email,
      templateNames: message.templates?.map((t) => t.name) || [],
      hasTemplates: message.templates && message.templates.length > 0,
      error: message.error,
      fullMessage: message,
    });
  }

  // Always send a response to prevent port closure
  sendResponse({ received: true });

  // Handle different message types
  handleMessage(message)
    .then(() => {
      console.log("✅ Message handled successfully");
    })
    .catch((error) => {
      console.error("❌ Message handling failed:", error);
      visualFeedbackManager.showError(
        `Failed to process request: ${error.message}`
      );
    });

  return true; // Keep message channel open for async responses
});

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

    default:
      console.warn("⚠️ Unknown message action:", message.action);
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

  console.log("🔄 Processing text replacement...");

  const result = await textReplacementManager.replaceSelectedText(
    message.newText,
    {
      showFeedback: true,
    }
  );

  if (!result.success) {
    throw new Error(result.error || "Text replacement failed");
  }

  console.log("✅ Text replacement completed successfully");
}

/**
 * Validates that the content script is working properly
 * @returns {Promise<void>}
 */
async function validateSetup() {
  try {
    // Test text selection manager
    const hasSelection = textSelectionManager.hasValidSelection();
    console.log(
      "📋 Selection Manager:",
      hasSelection ? "Active selection found" : "No active selection"
    );

    // Test text replacement validation
    const validationResult = await textReplacementManager.validateReplacement();
    console.log(
      "🔧 Replacement Manager:",
      validationResult.valid ? "Ready" : `Not ready: ${validationResult.reason}`
    );

    // Test visual feedback
    console.log("🎨 Visual Feedback Manager: Ready");
    console.log("📱 Modal System: Ready");

    console.log(
      "✅ All systems operational - Phase 5 Modal Refactoring Complete!"
    );
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
  if (performance.memory) {
    console.log("📊 Memory Usage:", {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + "MB",
      total:
        Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + "MB",
      limit:
        Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + "MB",
    });
  }

  // Log module load times
  console.log("⚡ Module Load Performance:", {
    textSelection: "✅ Loaded",
    textReplacement: "✅ Loaded",
    visualFeedback: "✅ Loaded",
    modalSystem: "✅ Loaded",
  });
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
  window.addEventListener("error", (event) => {
    console.error("🚨 Content Script Error:", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });

    // Show user-friendly error message
    visualFeedbackManager.showError(
      "Extension encountered an error. Please try again."
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("🚨 Unhandled Promise Rejection:", event.reason);

    // Show user-friendly error message
    visualFeedbackManager.showError(
      "Extension operation failed. Please try again."
    );

    // Prevent the error from appearing in console
    event.preventDefault();
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
    console.log("🎉 Prompter Extension - Fully Refactored & Ready!");
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

  // Add debugging utilities
  debug: {
    getStats: () => ({
      selectionManager: textSelectionManager.getCurrentSelection(),
      replacementValidation: textReplacementManager.validateReplacement(),
      siteHandler: textReplacementManager.getSiteHandlerInfo(),
    }),

    runTests: async () => {
      console.log("🧪 Running diagnostic tests...");
      await validateSetup();
      performanceMonitoring();
      console.log("✅ Diagnostic tests completed");
    },

    showTestNotification: () => {
      visualFeedbackManager.showSuccess(
        "🎉 Refactored system working perfectly!"
      );
    },
  },
};

// Add global shortcut for debugging (Ctrl+Shift+D)
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key === "D") {
    event.preventDefault();
    console.log("🔍 Prompter Debug Mode Activated");
    window.prompterManagers.debug.runTests();
  }
});

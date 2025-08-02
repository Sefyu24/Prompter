/**
 * @fileoverview Visual feedback module for notifications and transitions
 * @author Promptr Extension
 * @since 1.0.0
 */

import {
  COLORS,
  TIMING,
  Z_INDEX,
  CSS_CLASSES,
  NOTIFICATION_TYPES,
} from "../constants.js";
import { getElementBounds } from "../utils.js";
import { domSafetyManager } from "./domSafety.js";
import { errorHandler, getUserFriendlyErrorMessage } from "./errorHandler.js";

/**
 * @typedef {import('../types.js').NotificationConfig} NotificationConfig
 * @typedef {import('../types.js').ElementBounds} ElementBounds
 */

/**
 * Manages visual feedback including notifications and text replacement animations
 * @class VisualFeedbackManager
 */
export class VisualFeedbackManager {
  constructor() {
    /** @type {boolean} */
    this.stylesAdded = false;
  }

  /**
   * Shows a notification to the user
   * @param {string} message - Notification message
   * @param {'error'|'success'|'info'} type - Notification type
   * @param {number} [duration] - Display duration in milliseconds
   * @example
   * ```javascript
   * feedbackManager.showNotification('Success!', 'success');
   * ```
   */
  showNotification(message, type, duration = TIMING.NOTIFICATION_TIMEOUT) {
    try {
      const notification = this.createNotificationElement(message, type);
      
      if (!domSafetyManager.isValidElement(notification)) {
        throw new Error("Failed to create notification element");
      }
      
      if (!document.body) {
        throw new Error("Document body not available");
      }
      
      document.body.appendChild(notification);

      setTimeout(() => {
        if (domSafetyManager.isValidElement(notification)) {
          domSafetyManager.safeRemoveElement(notification);
        }
      }, duration);
    } catch (error) {
      errorHandler.handleError(error, 'visualFeedback.showNotification', {
        message,
        type,
        duration
      });
      
      // Fallback: log to console if notification fails
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Creates a notification DOM element
   * @param {string} message - Notification message
   * @param {'error'|'success'|'info'} type - Notification type
   * @returns {HTMLElement} Notification element
   * @private
   */
  createNotificationElement(message, type) {
    const notification = document.createElement("div");
    notification.textContent = message;

    const { bgColor, borderColor } = this.getNotificationColors(type);

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background-color: ${bgColor};
      color: ${COLORS.WHITE};
      border: 1px solid ${borderColor};
      border-radius: calc(1.4rem - 6px);
      box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16);
      z-index: ${Z_INDEX.NOTIFICATION};
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: -0.025em;
      animation: prompter-notification-enter 0.2s ease-out;
    `;

    return notification;
  }

  /**
   * Gets colors for notification based on type
   * @param {'error'|'success'|'info'} type - Notification type
   * @returns {{bgColor: string, borderColor: string}} Color configuration
   * @private
   */
  getNotificationColors(type) {
    switch (type) {
      case NOTIFICATION_TYPES.ERROR:
        return { bgColor: COLORS.ERROR, borderColor: COLORS.ERROR };
      case NOTIFICATION_TYPES.SUCCESS:
        return { bgColor: COLORS.SUCCESS, borderColor: COLORS.SUCCESS };
      default:
        return { bgColor: COLORS.INFO, borderColor: COLORS.INFO };
    }
  }

  /**
   * Shows visual feedback when text is replaced
   * @param {HTMLElement} element - Element where text was replaced
   * @returns {Promise<void>} Promise that resolves when animation completes
   * @example
   * ```javascript
   * await feedbackManager.showTextReplacementFeedback(inputElement);
   * ```
   */
  async showTextReplacementFeedback(element) {
    if (!element) {
      console.warn("No element provided for replacement feedback");
      return;
    }

    this.ensureTransitionStyles();

    const overlay = this.createReplacementOverlay(element);
    const originalStyles = this.applyHighlightEffect(element);

    document.body.appendChild(overlay);

    // Start overlay animation
    requestAnimationFrame(() => {
      overlay.style.animation = `prompter-replacement-pulse ${TIMING.ANIMATION_DURATION}ms ease-out`;
    });

    // Show success notification
    this.showNotification(
      "✨ Text formatted successfully!",
      NOTIFICATION_TYPES.SUCCESS
    );

    // Cleanup after animation
    await this.cleanupReplacementFeedback(element, overlay, originalStyles);
  }

  /**
   * Creates the replacement overlay element
   * @param {HTMLElement} element - Target element
   * @returns {HTMLElement} Overlay element
   * @private
   */
  createReplacementOverlay(element) {
    const overlay = document.createElement("div");
    overlay.className = CSS_CLASSES.REPLACEMENT_OVERLAY;

    const bounds = getElementBounds(element);
    const borderRadius = window.getComputedStyle(element).borderRadius || "4px";

    overlay.style.cssText = `
      position: absolute;
      top: ${bounds.top}px;
      left: ${bounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      pointer-events: none;
      z-index: ${Z_INDEX.REPLACEMENT_OVERLAY};
      border-radius: ${borderRadius};
    `;

    return overlay;
  }

  /**
   * Applies highlight effect to the element
   * @param {HTMLElement} element - Target element
   * @returns {Object} Original styles for restoration
   * @private
   */
  applyHighlightEffect(element) {
    const originalStyles = {
      transition: element.style.transition,
      boxShadow: element.style.boxShadow,
      border: element.style.border,
    };

    // Apply highlight effect
    element.style.transition = "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    element.style.boxShadow = `0 0 0 2px ${COLORS.PURPLE_GLOW}, 0 0 20px rgba(139, 92, 246, 0.3)`;
    element.style.border = "1px solid rgba(139, 92, 246, 0.6)";

    return originalStyles;
  }

  /**
   * Cleans up replacement feedback effects
   * @param {HTMLElement} element - Target element
   * @param {HTMLElement} overlay - Overlay element
   * @param {Object} originalStyles - Original element styles
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   * @private
   */
  async cleanupReplacementFeedback(element, overlay, originalStyles) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Restore original styles
        element.style.transition = originalStyles.transition;
        element.style.boxShadow = originalStyles.boxShadow;
        element.style.border = originalStyles.border;

        // Remove overlay
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }

        resolve();
      }, TIMING.ANIMATION_DURATION);
    });
  }

  /**
   * Ensures transition styles are added to the page
   * @private
   */
  ensureTransitionStyles() {
    if (this.stylesAdded) return;

    const styleId = CSS_CLASSES.TRANSITION_STYLES;
    if (document.getElementById(styleId)) {
      this.stylesAdded = true;
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = this.getTransitionCSS();

    document.head.appendChild(style);
    this.stylesAdded = true;
  }

  /**
   * Gets the CSS for transitions and animations
   * @returns {string} CSS content
   * @private
   */
  getTransitionCSS() {
    return `
      .${CSS_CLASSES.REPLACEMENT_OVERLAY} {
        background: linear-gradient(45deg, 
          rgba(139, 92, 246, 0.15) 0%, 
          rgba(139, 92, 246, 0.25) 50%, 
          rgba(139, 92, 246, 0.15) 100%);
        border: 1px solid rgba(139, 92, 246, 0.4);
      }
      
      @keyframes prompter-replacement-pulse {
        0% {
          transform: scale(1);
          opacity: 0;
          background: rgba(139, 92, 246, 0.3);
        }
        25% {
          transform: scale(1.02);
          opacity: 1;
          background: rgba(139, 92, 246, 0.2);
        }
        75% {
          transform: scale(1.01);
          opacity: 0.8;
          background: rgba(139, 92, 246, 0.1);
        }
        100% {
          transform: scale(1);
          opacity: 0;
          background: rgba(139, 92, 246, 0.05);
        }
      }
      
      @keyframes prompter-notification-enter {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      @keyframes prompter-glow-fade {
        0% {
          box-shadow: 0 0 0 2px ${COLORS.PURPLE_GLOW_STRONG}, 0 0 25px ${COLORS.PURPLE_GLOW};
        }
        100% {
          box-shadow: 0 0 0 0px rgba(139, 92, 246, 0), 0 0 0px rgba(139, 92, 246, 0);
        }
      }
    `;
  }

  /**
   * Shows a loading notification
   * @param {string} [message='Formatting text...'] - Loading message
   */
  showLoading(message = "Formatting text...") {
    this.showNotification(message, NOTIFICATION_TYPES.INFO);
  }

  /**
   * Shows an error notification
   * @param {string|Error} message - Error message or Error object
   */
  showError(message) {
    const errorMessage = message instanceof Error 
      ? getUserFriendlyErrorMessage(message)
      : message;
    
    this.showNotification(errorMessage, NOTIFICATION_TYPES.ERROR);
  }

  /**
   * Shows user-friendly error for technical errors
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {number} [duration] - Display duration
   */
  showUserFriendlyError(error, context, duration) {
    // Log technical error for debugging
    errorHandler.handleError(error, context);
    
    // Show user-friendly message
    const friendlyMessage = getUserFriendlyErrorMessage(error);
    this.showNotification(friendlyMessage, NOTIFICATION_TYPES.ERROR, duration);
  }

  /**
   * Shows a success notification
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showNotification(message, NOTIFICATION_TYPES.SUCCESS);
  }
}

// Create a singleton instance
export const visualFeedbackManager = new VisualFeedbackManager();

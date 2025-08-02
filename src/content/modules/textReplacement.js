/**
 * @fileoverview Core text replacement module
 * @author Promptr Extension
 * @since 1.0.0
 */

import { SiteHandlerFactory } from "./siteHandlers.js";
import { visualFeedbackManager } from "./visualFeedback.js";
import { textSelectionManager } from "./textSelection.js";
import { domSafetyManager } from "./domSafety.js";
import {
  findEditableParent,
  findEditableElementBySelectors,
} from "../utils.js";
import { SELECTORS } from "../constants.js";

/**
 * @typedef {import('../types.js').TextReplacementOptions} TextReplacementOptions
 * @typedef {import('../types.js').ReplacementResult} ReplacementResult
 */

/**
 * Manages text replacement operations across different websites
 * @class TextReplacementManager
 */
export class TextReplacementManager {
  constructor() {
    /** @type {import('./siteHandlers.js').SiteHandler} */
    this.siteHandler = SiteHandlerFactory.createHandler();
  }

  /**
   * Replaces selected text with formatted content
   * @param {string} newText - The formatted text to insert
   * @param {TextReplacementOptions} [options={}] - Replacement options
   * @returns {Promise<ReplacementResult>} Replacement result
   * @example
   * ```javascript
   * const result = await textReplacer.replaceSelectedText('Formatted JSON content');
   * if (result.success) {
   *   console.log('Text replaced successfully');
   * }
   * ```
   */
  async replaceSelectedText(newText, options = {}) {
    const {
      targetElement = null,
      showFeedback = true,
      useStoredRange = false,
    } = options;

    try {
      // Find the target element
      const element = await this.findTargetElement(
        targetElement,
        useStoredRange
      );

      if (!element) {
        return {
          success: false,
          error: "No editable element found",
        };
      }

      // Perform the text replacement
      const result = await this.siteHandler.replaceText(
        element,
        newText,
        options
      );

      // Show visual feedback if successful and requested
      if (result.success && showFeedback) {
        await visualFeedbackManager.showTextReplacementFeedback(element);
      }

      return result;
    } catch (error) {
      console.error("Text replacement failed:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Finds the target element for text replacement
   * @param {HTMLElement|null} targetElement - Optional target element override
   * @param {boolean} useStoredRange - Whether to use stored selection range
   * @returns {Promise<HTMLElement|null>} Target element or null if not found
   * @private
   */
  async findTargetElement(targetElement, useStoredRange) {
    try {
      // Use provided target element if available and valid
      if (targetElement && domSafetyManager.isValidElement(targetElement)) {
        return targetElement;
      }

      // Try to use stored selection range first
      if (useStoredRange) {
        const element = this.findElementFromStoredRange();
        if (element && domSafetyManager.isValidElement(element)) {
          return element;
        }
      }

      // Try current selection
      const currentElement = this.findElementFromCurrentSelection();
      if (currentElement && domSafetyManager.isValidElement(currentElement)) {
        return currentElement;
      }

      // Fallback to common selectors
      const fallbackElement = this.findElementBySelectors();
      if (fallbackElement && domSafetyManager.isValidElement(fallbackElement)) {
        return fallbackElement;
      }

      return null;
    } catch (error) {
      console.error("Error finding target element:", error);
      return null;
    }
  }

  /**
   * Finds element from stored selection range
   * @returns {HTMLElement|null} Element or null if not found
   * @private
   */
  findElementFromStoredRange() {
    const selectionInfo = textSelectionManager.getCurrentSelection();

    if (selectionInfo?.range && selectionInfo?.element) {
      return findEditableParent(selectionInfo.range.commonAncestorContainer);
    }

    return null;
  }

  /**
   * Finds element from current selection
   * @returns {HTMLElement|null} Element or null if not found
   * @private
   */
  findElementFromCurrentSelection() {
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return findEditableParent(range.commonAncestorContainer);
    }

    return null;
  }

  /**
   * Finds element using common selectors
   * @returns {HTMLElement|null} Element or null if not found
   * @private
   */
  findElementBySelectors() {
    return findEditableElementBySelectors(SELECTORS.TEXT_INPUTS);
  }

  /**
   * Replaces text specifically for modal operations
   * @param {string} newText - New text to insert
   * @param {string} selectedText - Original selected text
   * @param {HTMLElement} targetElement - Target element
   * @returns {Promise<ReplacementResult>} Replacement result
   */
  async replaceTextFromModal(newText, selectedText, targetElement) {
    // Validate inputs
    if (!domSafetyManager.isValidElement(targetElement)) {
      return {
        success: false,
        error: "No valid target element provided",
      };
    }

    if (typeof newText !== 'string') {
      return {
        success: false,
        error: "Invalid text provided for replacement",
      };
    }


    try {
      // Check element visibility and accessibility
      if (!domSafetyManager.isElementVisible(targetElement)) {
        console.warn("Target element is not visible");
      }

      // Focus the element first
      if (!domSafetyManager.safeFocus(targetElement)) {
        console.warn("Failed to focus target element, continuing anyway");
      }

      // Use the site handler to perform replacement
      const result = await this.siteHandler.replaceText(
        targetElement,
        newText,
        {
          showFeedback: false, // We'll show feedback separately
        }
      );

      if (result.success) {
        // Show visual feedback
        try {
          await visualFeedbackManager.showTextReplacementFeedback(targetElement);
        } catch (feedbackError) {
          console.warn("Visual feedback failed:", feedbackError);
          // Don't fail the operation if feedback fails
        }
      }

      return result;
    } catch (error) {
      console.error("Modal text replacement failed:", error);
      return {
        success: false,
        error: error.message || "Modal replacement failed",
      };
    }
  }

  /**
   * Gets information about the current site handler
   * @returns {string} Site handler name
   */
  getSiteHandlerInfo() {
    return this.siteHandler.siteName;
  }

  /**
   * Refreshes the site handler (useful if the page URL changes)
   */
  refreshSiteHandler() {
    this.siteHandler = SiteHandlerFactory.createHandler();
  }

  /**
   * Validates if text replacement is possible
   * @param {HTMLElement} [targetElement] - Optional target element to check
   * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
   */
  async validateReplacement(targetElement = null) {
    try {
      const element = await this.findTargetElement(targetElement, false);

      if (!domSafetyManager.isValidElement(element)) {
        return {
          valid: false,
          reason: "No valid editable element found",
        };
      }

      // Check if element is visible using DOM safety manager
      if (!domSafetyManager.isElementVisible(element)) {
        return {
          valid: false,
          reason: "Target element is not visible",
        };
      }

      // Check if element is disabled or readonly
      if (element.disabled || element.readOnly) {
        return {
          valid: false,
          reason: "Target element is disabled or readonly",
        };
      }

      // Additional safety checks
      if (!element.isConnected) {
        return {
          valid: false,
          reason: "Target element is not connected to the DOM",
        };
      }

      return { valid: true };
    } catch (error) {
      console.error("Validation error:", error);
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }
}

// Create a singleton instance
export const textReplacementManager = new TextReplacementManager();

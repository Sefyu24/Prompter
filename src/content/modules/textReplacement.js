/**
 * @fileoverview Core text replacement module
 * @author Prompter Extension
 * @since 1.0.0
 */

import { SiteHandlerFactory } from "./siteHandlers.js";
import { visualFeedbackManager } from "./visualFeedback.js";
import { textSelectionManager } from "./textSelection.js";
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
    // Use provided target element if available
    if (targetElement) {
      return targetElement;
    }

    // Try to use stored selection range first
    if (useStoredRange) {
      const element = this.findElementFromStoredRange();
      if (element) return element;
    }

    // Try current selection
    const currentElement = this.findElementFromCurrentSelection();
    if (currentElement) return currentElement;

    // Fallback to common selectors
    return this.findElementBySelectors();
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
    if (!targetElement) {
      return {
        success: false,
        error: "No target element provided",
      };
    }

    console.log("Replacing text from modal:", {
      element: targetElement.tagName,
      contentEditable: targetElement.contentEditable,
      selectedText: selectedText,
      newText: newText.substring(0, 100) + (newText.length > 100 ? "..." : ""),
    });

    try {
      // Focus the element first
      targetElement.focus();

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
        await visualFeedbackManager.showTextReplacementFeedback(targetElement);
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
    console.log(`Site handler refreshed: ${this.siteHandler.siteName}`);
  }

  /**
   * Validates if text replacement is possible
   * @param {HTMLElement} [targetElement] - Optional target element to check
   * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
   */
  async validateReplacement(targetElement = null) {
    try {
      const element = await this.findTargetElement(targetElement, false);

      if (!element) {
        return {
          valid: false,
          reason: "No editable element found",
        };
      }

      // Check if element is visible and enabled
      if (element.offsetParent === null) {
        return {
          valid: false,
          reason: "Target element is not visible",
        };
      }

      if (element.disabled || element.readOnly) {
        return {
          valid: false,
          reason: "Target element is disabled or readonly",
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }
}

// Create a singleton instance
export const textReplacementManager = new TextReplacementManager();

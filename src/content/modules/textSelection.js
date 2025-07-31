/**
 * @fileoverview Text selection handling module
 * @author Prompter Extension
 * @since 1.0.0
 */

import { getCurrentSelection, isTextInput } from "../utils.js";
import { domSafetyManager } from "./domSafety.js";
import { backgroundCommunicator } from "./messageHandler.js";
import { ACTIONS } from "../constants.js";

/**
 * @typedef {import('../types.js').SelectionInfo} SelectionInfo
 */

/**
 * Manages text selection capture and handling
 * @class TextSelectionManager
 */
export class TextSelectionManager {
  constructor() {
    /** @type {string} */
    this.selectedText = "";

    /** @type {HTMLElement|null} */
    this.targetElement = null;

    /** @type {Range|null} */
    this.selectionRange = null;

    this.setupEventListeners();
  }

  /**
   * Sets up event listeners for text selection
   * @private
   */
  setupEventListeners() {
    // Add multiple event listeners for better selection capture
    document.addEventListener("mouseup", this.captureSelection.bind(this));
    document.addEventListener(
      "selectionchange",
      this.captureSelection.bind(this)
    );

    // Site-specific handling for T3.chat
    this.setupSiteSpecificListeners();
  }

  /**
   * Sets up site-specific event listeners
   * @private
   */
  setupSiteSpecificListeners() {
    // For t3.chat, also listen on the document body
    if (
      window.location.hostname === "t3.chat" ||
      window.location.hostname === "www.t3.chat"
    ) {
      setTimeout(() => {
        const body = document.querySelector("body");
        if (body) {
          body.addEventListener("mouseup", this.captureSelection.bind(this));
        }
      }, 1000);
    }
  }

  /**
   * Captures the current text selection
   * @param {Event} [event] - The triggering event
   * @private
   */
  captureSelection(event) {
    try {
      const selectionInfo = getCurrentSelection();

      if (!selectionInfo) {
        this.clearSelection();
        return;
      }

      // Validate the target element before storing
      if (selectionInfo.element && !domSafetyManager.isValidElement(selectionInfo.element)) {
        console.warn("Invalid target element detected in selection");
        this.clearSelection();
        return;
      }

      this.selectedText = selectionInfo.text;
      this.targetElement = selectionInfo.element;
      this.selectionRange = selectionInfo.range;

      // Notify background script if selection is in an input field
      if (selectionInfo.isInInputField) {
        this.notifyBackgroundScript(selectionInfo);
      }
    } catch (error) {
      console.error("Error capturing selection:", error);
      this.clearSelection();
    }
  }

  /**
   * Notifies the background script about text selection
   * @param {SelectionInfo} selectionInfo - Selection information
   * @private
   */
  async notifyBackgroundScript(selectionInfo) {
    try {
      await backgroundCommunicator.notifyTextSelection(
        selectionInfo.text,
        true
      );
    } catch (error) {
      console.warn("Failed to notify background script:", error);
    }
  }

  /**
   * Clears the current selection data
   * @private
   */
  clearSelection() {
    this.selectedText = "";
    this.targetElement = null;
    this.selectionRange = null;
  }

  /**
   * Gets the current selection information
   * @returns {SelectionInfo|null} Current selection info or null if no selection
   * @public
   */
  getCurrentSelection() {
    if (!this.selectedText) {
      return null;
    }

    return {
      text: this.selectedText,
      element: this.targetElement,
      range: this.selectionRange,
      isInInputField: isTextInput(this.targetElement),
    };
  }

  /**
   * Validates if there's a valid text selection in an input field
   * @returns {boolean} True if there's a valid selection
   * @public
   */
  hasValidSelection() {
    const selection = this.getCurrentSelection();
    return Boolean(
      selection &&
        selection.text.length > 0 &&
        selection.element &&
        selection.isInInputField
    );
  }

  /**
   * Gets the selected text
   * @returns {string} Currently selected text
   * @public
   */
  getSelectedText() {
    return this.selectedText;
  }

  /**
   * Gets the target element
   * @returns {HTMLElement|null} Element containing the selection
   * @public
   */
  getTargetElement() {
    return this.targetElement;
  }

  /**
   * Gets the selection range
   * @returns {Range|null} Selection range object
   * @public
   */
  getSelectionRange() {
    return this.selectionRange;
  }

  /**
   * Manually sets selection data (useful for testing or programmatic selection)
   * @param {string} text - Selected text
   * @param {HTMLElement} element - Target element
   * @param {Range} [range] - Selection range
   * @public
   */
  setSelection(text, element, range = null) {
    try {
      if (typeof text !== 'string') {
        console.warn("Selection text must be a string");
        return;
      }

      if (element && !domSafetyManager.isValidElement(element)) {
        console.warn("Invalid element provided for selection");
        return;
      }

      this.selectedText = text;
      this.targetElement = element;
      this.selectionRange = range;
    } catch (error) {
      console.error("Error setting selection:", error);
      this.clearSelection();
    }
  }
}

// Create a singleton instance
export const textSelectionManager = new TextSelectionManager();

/**
 * @fileoverview Site-specific text replacement handlers
 * @author Promptr Extension
 * @since 1.0.0
 */

import {
  detectCurrentSite,
  dispatchEvents,
  dispatchReactInputEvent,
  wait,
} from "../utils.js";
import { domSafetyManager } from "./domSafety.js";
import { EVENTS, TIMING } from "../constants.js";

/**
 * @typedef {import('../types.js').ReplacementResult} ReplacementResult
 * @typedef {import('../types.js').TextReplacementOptions} TextReplacementOptions
 */

/**
 * Base class for site-specific text replacement handlers
 * @abstract
 * @class SiteHandler
 * @implements {ISiteHandler}
 */
export class SiteHandler {
  /**
   * @param {string} siteName - Name of the site this handler supports
   */
  constructor(siteName) {
    /** @type {string} */
    this.siteName = siteName;
  }

  /**
   * Replaces text in the target element
   * @param {HTMLElement} element - Target element
   * @param {string} newText - Text to insert
   * @param {TextReplacementOptions} [options] - Replacement options
   * @returns {Promise<ReplacementResult>} Replacement result
   * @abstract
   */
  async replaceText(element, newText, options = {}) {
    throw new Error(
      `replaceText must be implemented by ${this.constructor.name}`
    );
  }

  /**
   * Focuses the element and prepares for text replacement
   * @param {HTMLElement} element - Target element
   * @protected
   */
  async prepareElement(element) {
    try {
      if (!domSafetyManager.isValidElement(element)) {
        throw new Error("Invalid element provided for preparation");
      }

      if (!domSafetyManager.safeFocus(element)) {
        console.warn("Failed to focus element, continuing anyway");
      }
      
      await wait(TIMING.FOCUS_DELAY);
    } catch (error) {
      console.error("Element preparation failed:", error);
      throw error;
    }
  }

  /**
   * Triggers events to notify the page of changes
   * @param {HTMLElement} element - Target element
   * @param {string} newText - Inserted text
   * @protected
   */
  triggerChangeEvents(element, newText) {
    dispatchEvents(element, EVENTS.INPUT_EVENTS);

    // For React apps, also dispatch synthetic events
    if (element._valueTracker) {
      element._valueTracker.setValue("");
    }
  }

  /**
   * Creates a successful replacement result
   * @param {HTMLElement} element - Target element
   * @returns {ReplacementResult} Success result
   * @protected
   */
  createSuccessResult(element) {
    return {
      success: true,
      element: element,
    };
  }

  /**
   * Creates a failed replacement result
   * @param {string} error - Error message
   * @returns {ReplacementResult} Error result
   * @protected
   */
  createErrorResult(error) {
    return {
      success: false,
      error: error,
    };
  }
}

/**
 * Default handler for generic websites
 * @class DefaultHandler
 * @extends SiteHandler
 */
export class DefaultHandler extends SiteHandler {
  constructor() {
    super("Default");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      // Validate inputs
      if (!domSafetyManager.isValidElement(element)) {
        throw new Error("Invalid element provided");
      }

      if (typeof newText !== 'string') {
        throw new Error("New text must be a string");
      }

      await this.prepareElement(element);

      if (element.contentEditable === "true") {
        return await this.replaceInContentEditable(element, newText);
      } else {
        return await this.replaceInInputElement(element, newText);
      }
    } catch (error) {
      console.error(`Default replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in contenteditable elements
   * @param {HTMLElement} element - Contenteditable element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInContentEditable(element, newText) {
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const lines = newText.split("\n");
      const fragment = document.createDocumentFragment();

      lines.forEach((line, index) => {
        if (line.length > 0) {
          fragment.appendChild(document.createTextNode(line));
        }
        if (index < lines.length - 1) {
          fragment.appendChild(document.createElement("br"));
        }
      });

      range.insertNode(fragment);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.triggerChangeEvents(element, newText);
    return this.createSuccessResult(element);
  }

  /**
   * Replaces text in input/textarea elements
   * @param {HTMLElement} element - Input element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInInputElement(element, newText) {
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";

    element.value = value.substring(0, start) + newText + value.substring(end);
    element.selectionStart = start;
    element.selectionEnd = start + newText.length;

    this.triggerChangeEvents(element, newText);
    return this.createSuccessResult(element);
  }
}

/**
 * Handler for Perplexity.ai
 * @class PerplexityHandler
 * @extends SiteHandler
 */
export class PerplexityHandler extends SiteHandler {
  constructor() {
    super("Perplexity");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      // Try execCommand first for contenteditable elements
      if (element.contentEditable === "true") {
        if (await this.tryExecCommand(element, newText)) {
          return this.createSuccessResult(element);
        }
      }

      // Fallback to default handling
      const defaultHandler = new DefaultHandler();
      return await defaultHandler.replaceText(element, newText, options);
    } catch (error) {
      console.error(`Perplexity replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Attempts to use execCommand for text replacement
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<boolean>} True if successful
   * @private
   */
  async tryExecCommand(element, newText) {
    try {
      // Select all content
      document.execCommand("selectAll", false, null);

      // Delete the selected content
      document.execCommand("delete", false, null);

      // Insert the new text
      document.execCommand("insertText", false, newText);

      // Additional React event triggering
      dispatchReactInputEvent(element, newText);

      return true;
    } catch (error) {
      console.warn("execCommand failed for Perplexity:", error);
      return false;
    }
  }
}

/**
 * Handler for ChatGPT
 * @class ChatGPTHandler
 * @extends SiteHandler
 */
export class ChatGPTHandler extends SiteHandler {
  constructor() {
    super("ChatGPT");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      if (element.contentEditable === "true") {
        return await this.replaceInChatGPTContentEditable(element, newText);
      } else {
        const defaultHandler = new DefaultHandler();
        return await defaultHandler.replaceText(element, newText, options);
      }
    } catch (error) {
      console.error(`ChatGPT replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in ChatGPT's contenteditable elements
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInChatGPTContentEditable(element, newText) {
    try {
      // Method 1: Try execCommand
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand("insertText", false, newText);

        this.triggerReactEvents(element, newText);
        return this.createSuccessResult(element);
      }
    } catch (error) {
      console.warn("ChatGPT execCommand failed:", error);
    }

    // Method 2: Direct content replacement
    element.innerHTML = "";
    element.textContent = newText;

    // Set cursor at end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.triggerReactEvents(element, newText);
    return this.createSuccessResult(element);
  }

  /**
   * Triggers React-specific events for ChatGPT
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @private
   */
  triggerReactEvents(element, newText) {
    dispatchReactInputEvent(element, newText);

    // Trigger composition events for better compatibility
    element.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true })
    );
    element.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: newText })
    );

    this.triggerChangeEvents(element, newText);
  }
}

/**
 * Handler for Claude.ai
 * @class ClaudeHandler
 * @extends SiteHandler
 */
export class ClaudeHandler extends SiteHandler {
  constructor() {
    super("Claude");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      if (element.contentEditable === "true") {
        return await this.replaceInClaudeContentEditable(element, newText);
      } else {
        const defaultHandler = new DefaultHandler();
        return await defaultHandler.replaceText(element, newText, options);
      }
    } catch (error) {
      console.error(`Claude replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in Claude's contenteditable elements
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInClaudeContentEditable(element, newText) {
    // Clear the element content
    element.innerHTML = "";

    // Add the new text with Claude's specific structure
    const lines = newText.split("\n");
    const fragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
      const div = document.createElement("div");
      if (line.length > 0) {
        div.textContent = line;
      } else {
        div.innerHTML = "<br>";
      }
      fragment.appendChild(div);
    });

    element.appendChild(fragment);

    // Set cursor at end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.triggerChangeEvents(element, newText);
    return this.createSuccessResult(element);
  }
}

/**
 * Handler for T3.chat
 * @class T3ChatHandler
 * @extends SiteHandler
 */
export class T3ChatHandler extends SiteHandler {
  constructor() {
    super("T3Chat");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      if (
        element.tagName.toLowerCase() === "textarea" ||
        element.tagName.toLowerCase() === "input"
      ) {
        return await this.replaceInT3ChatInput(element, newText);
      } else {
        const defaultHandler = new DefaultHandler();
        return await defaultHandler.replaceText(element, newText, options);
      }
    } catch (error) {
      console.error(`T3Chat replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in T3Chat input elements with special event handling
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInT3ChatInput(element, newText) {
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";

    element.value = value.substring(0, start) + newText + value.substring(end);
    element.selectionStart = start;
    element.selectionEnd = start + newText.length;

    // T3Chat-specific event handling to prevent conflicts
    this.preventEventConflicts(element);

    // Dispatch controlled events after a delay
    await wait(TIMING.REACT_EVENT_DELAY);
    dispatchEvents(element, ["input", "change"]);

    return this.createSuccessResult(element);
  }

  /**
   * Prevents event conflicts for T3Chat
   * @param {HTMLElement} element - Target element
   * @private
   */
  preventEventConflicts(element) {
    const stopEvent = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };

    element.addEventListener("paste", stopEvent, { once: true, capture: true });
    element.addEventListener("input", stopEvent, { once: true, capture: true });
  }
}

/**
 * Handler for Gemini
 * @class GeminiHandler
 * @extends SiteHandler
 */
export class GeminiHandler extends SiteHandler {
  constructor() {
    super("Gemini");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      if (element.contentEditable === "true") {
        return await this.replaceInGeminiContentEditable(element, newText);
      } else {
        const defaultHandler = new DefaultHandler();
        return await defaultHandler.replaceText(element, newText, options);
      }
    } catch (error) {
      console.error(`Gemini replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in Gemini's contenteditable elements
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInGeminiContentEditable(element, newText) {
    try {
      // Try execCommand approach
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, newText);

      this.triggerChangeEvents(element, newText);
      return this.createSuccessResult(element);
    } catch (error) {
      console.warn("Gemini execCommand failed, using fallback");

      // Fallback to default handling
      const defaultHandler = new DefaultHandler();
      return await defaultHandler.replaceText(element, newText);
    }
  }
}

/**
 * Handler for Cursor (cursor.com/agents)
 * @class CursorHandler
 * @extends SiteHandler
 */
export class CursorHandler extends SiteHandler {
  constructor() {
    super("Cursor");
  }

  /**
   * @inheritdoc
   */
  async replaceText(element, newText, options = {}) {
    try {
      await this.prepareElement(element);

      if (element.contentEditable === "true") {
        return await this.replaceInCursorContentEditable(element, newText);
      } else if (element.tagName.toLowerCase() === "textarea") {
        return await this.replaceInCursorTextarea(element, newText);
      } else {
        const defaultHandler = new DefaultHandler();
        return await defaultHandler.replaceText(element, newText, options);
      }
    } catch (error) {
      console.error(`Cursor replacement failed:`, error);
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Replaces text in Cursor's contenteditable elements
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInCursorContentEditable(element, newText) {
    try {
      // Method 1: Try modern clipboard API approach for better compatibility
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        // Use insertText for better React compatibility
        document.execCommand("insertText", false, newText);

        this.triggerCursorEvents(element, newText);
        return this.createSuccessResult(element);
      }
    } catch (error) {
      console.warn("Cursor execCommand failed:", error);
    }

    // Method 2: Direct content replacement fallback
    element.innerHTML = "";
    element.textContent = newText;

    // Set cursor at end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    this.triggerCursorEvents(element, newText);
    return this.createSuccessResult(element);
  }

  /**
   * Replaces text in Cursor's textarea elements
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @returns {Promise<ReplacementResult>} Replacement result
   * @private
   */
  async replaceInCursorTextarea(element, newText) {
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const value = element.value || "";

    element.value = value.substring(0, start) + newText + value.substring(end);
    element.selectionStart = start;
    element.selectionEnd = start + newText.length;

    this.triggerCursorEvents(element, newText);
    return this.createSuccessResult(element);
  }

  /**
   * Triggers events specific to Cursor's interface
   * @param {HTMLElement} element - Target element
   * @param {string} newText - New text
   * @private
   */
  triggerCursorEvents(element, newText) {
    // Dispatch standard events
    dispatchEvents(element, ["input", "change"]);
    
    // Dispatch React-specific events for better compatibility
    dispatchReactInputEvent(element, newText);

    // Additional events that might be needed for Cursor's interface
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    element.dispatchEvent(new Event("focus", { bubbles: true }));
    
    // Custom event for Cursor if they use it
    element.dispatchEvent(new CustomEvent("cursor-text-change", { 
      bubbles: true, 
      detail: { text: newText } 
    }));
  }
}

/**
 * Factory class for creating site-specific handlers
 * @class SiteHandlerFactory
 */
export class SiteHandlerFactory {
  /**
   * Creates the appropriate handler based on the current site
   * @returns {SiteHandler} Site-specific handler instance
   * @static
   */
  static createHandler() {
    const siteDetection = detectCurrentSite();

    if (siteDetection.isPerplexity) {
      return new PerplexityHandler();
    } else if (siteDetection.isChatGPT) {
      return new ChatGPTHandler();
    } else if (siteDetection.isClaude) {
      return new ClaudeHandler();
    } else if (siteDetection.isT3Chat) {
      return new T3ChatHandler();
    } else if (siteDetection.isGemini) {
      return new GeminiHandler();
    } else if (siteDetection.isCursor) {
      return new CursorHandler();
    } else {
      return new DefaultHandler();
    }
  }

  /**
   * Gets the name of the current site handler
   * @returns {string} Handler name
   * @static
   */
  static getCurrentHandlerName() {
    return this.createHandler().siteName;
  }
}

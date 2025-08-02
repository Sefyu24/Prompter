/**
 * @fileoverview Utility functions for the content script
 * @author Promptr Extension
 * @since 1.0.0
 */

import { SITES, SELECTORS, TIMING } from "./constants.js";

/**
 * @typedef {import('./types.js').SiteDetection} SiteDetection
 * @typedef {import('./types.js').SelectionInfo} SelectionInfo
 * @typedef {import('./types.js').ElementBounds} ElementBounds
 */

/**
 * Detects which website the user is currently on
 * @returns {SiteDetection} Object containing boolean flags for each supported site
 * @example
 * ```javascript
 * const { isChatGPT, isPerplexity } = detectCurrentSite();
 * if (isChatGPT) {
 *   // Use ChatGPT-specific logic
 * }
 * ```
 */
export function detectCurrentSite() {
  const hostname = window.location.hostname;

  return {
    isPerplexity: hostname === SITES.PERPLEXITY,
    isT3Chat: SITES.T3_CHAT.includes(hostname),
    isChatGPT: SITES.CHATGPT.includes(hostname),
    isClaude: hostname === SITES.CLAUDE,
    isGemini: hostname === SITES.GEMINI,
    isCursor: hostname === SITES.CURSOR,
  };
}

/**
 * Checks if an element is a text input (textarea, input, or contenteditable)
 * @param {HTMLElement|null} element - Element to check
 * @returns {boolean} True if element accepts text input
 * @example
 * ```javascript
 * const isEditable = isTextInput(document.activeElement);
 * ```
 */
export function isTextInput(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();

  // Check for textarea
  if (tagName === "textarea") return true;

  // Check for input with text-like type
  if (tagName === "input" && SELECTORS.INPUT_TYPES.includes(element.type)) {
    return true;
  }

  // Check for contenteditable
  if (element.contentEditable === "true") return true;

  // Check if parent is contenteditable
  let parent = element.parentElement;
  while (parent) {
    if (parent.contentEditable === "true") return true;
    parent = parent.parentElement;
  }

  return false;
}

/**
 * Finds the editable parent element of a given node
 * @param {Node|null} node - Starting node
 * @returns {HTMLElement|null} The editable parent element or null if none found
 * @example
 * ```javascript
 * const editableElement = findEditableParent(selection.anchorNode);
 * ```
 */
export function findEditableParent(node) {
  // First, try the normal DOM traversal approach
  let currentNode = node;
  while (currentNode && currentNode !== document) {
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const element = /** @type {HTMLElement} */ (currentNode);
      if (
        element.tagName.toLowerCase() === "textarea" ||
        element.tagName.toLowerCase() === "input" ||
        element.contentEditable === "true"
      ) {
        return element;
      }
    }
    currentNode = currentNode.parentNode;
  }

  // If normal traversal failed, try site-specific fallbacks
  const hostname = window.location.hostname;

  // For t3.chat, the selection might be in an overlay but the actual input is separate
  if (hostname === "t3.chat") {
    const chatInput = document.querySelector("#chat-input");
    if (chatInput && isTextInput(chatInput)) {
      return chatInput;
    }
  }

  // General fallback: look for common input selectors in the vicinity
  if (node && node.nodeType === Node.ELEMENT_NODE) {
    const element = /** @type {HTMLElement} */ (node);

    // Search within the current element and its siblings/parents for inputs
    const searchRoot =
      element.closest(
        'form, [role="main"], main, .chat-container, .message-container'
      ) || document.body;

    for (const selector of SELECTORS.TEXT_INPUTS) {
      const input = searchRoot.querySelector(selector);
      if (input && isTextInput(input)) {
        return input;
      }
    }
  }

  return null;
}

/**
 * Gets the current text selection information
 * @returns {SelectionInfo|null} Selection information or null if no selection
 * @example
 * ```javascript
 * const selection = getCurrentSelection();
 * if (selection) {
 *   console.log('Selected:', selection.text);
 * }
 * ```
 */
export function getCurrentSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || selectedText.length === 0) {
    return null;
  }

  let targetElement = null;
  let anchorNode = null;
  let selectionRange = null;

  // Store the actual anchor node for findEditableParent
  if (selection.anchorNode) {
    anchorNode = selection.anchorNode;
    targetElement = selection.anchorNode.parentElement || selection.anchorNode;
  }

  // Store the selection range for later use
  if (selection.rangeCount > 0) {
    selectionRange = selection.getRangeAt(0).cloneRange();
  }

  const isInInputField = isTextInput(targetElement);

  return {
    text: selectedText,
    element: targetElement, // Parent element for display/manipulation
    anchorNode: anchorNode, // Actual selection node for findEditableParent
    range: selectionRange,
    isInInputField,
  };
}

/**
 * Attempts to find an editable element using common selectors
 * @param {string[]} [customSelectors] - Additional selectors to try
 * @returns {HTMLElement|null} Found editable element or null
 * @example
 * ```javascript
 * const element = findEditableElementBySelectors(['.custom-input']);
 * ```
 */
export function findEditableElementBySelectors(customSelectors = []) {
  const selectors = [...SELECTORS.TEXT_INPUTS, ...customSelectors];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isTextInput(element)) {
      return element;
    }
  }

  return null;
}

/**
 * Gets the bounding rectangle of an element with scroll offsets
 * @param {HTMLElement} element - Target element
 * @returns {ElementBounds} Element bounds with scroll information
 * @example
 * ```javascript
 * const bounds = getElementBounds(targetElement);
 * positionOverlay(bounds);
 * ```
 */
export function getElementBounds(element) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
    width: rect.width,
    height: rect.height,
    scrollTop,
    scrollLeft,
  };
}

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 * @example
 * ```javascript
 * const safeHtml = escapeHtml('<script>alert("xss")</script>');
 * ```
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Dispatches multiple events on an element
 * @param {HTMLElement} element - Target element
 * @param {string[]} eventTypes - Array of event types to dispatch
 * @param {Object} [eventOptions] - Options for the events
 * @example
 * ```javascript
 * dispatchEvents(inputElement, ['input', 'change'], { bubbles: true });
 * ```
 */
export function dispatchEvents(
  element,
  eventTypes,
  eventOptions = { bubbles: true }
) {
  eventTypes.forEach((eventType) => {
    element.dispatchEvent(new Event(eventType, eventOptions));
  });
}

/**
 * Creates a synthetic input event for React compatibility
 * @param {HTMLElement} element - Target element
 * @param {string} data - Input data
 * @example
 * ```javascript
 * dispatchReactInputEvent(inputElement, newText);
 * ```
 */
export function dispatchReactInputEvent(element, data) {
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: data,
  });
  element.dispatchEvent(inputEvent);
}

/**
 * Adds a delay before executing a function
 * @param {Function} fn - Function to execute
 * @param {number} delay - Delay in milliseconds
 * @returns {Promise<any>} Promise that resolves with the function result
 * @example
 * ```javascript
 * await delay(() => element.focus(), TIMING.FOCUS_DELAY);
 * ```
 */
export function delay(fn, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(fn());
    }, delay);
  });
}

/**
 * Waits for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the delay
 * @example
 * ```javascript
 * await wait(100);
 * console.log('100ms have passed');
 * ```
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a string appears to be JSON
 * @param {string} text - Text to check
 * @returns {boolean} True if text looks like JSON
 * @example
 * ```javascript
 * if (looksLikeJson(responseText)) {
 *   // Handle as JSON
 * }
 * ```
 */
export function looksLikeJson(text) {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/**
 * Safely parses JSON with fallback
 * @param {string} text - JSON text to parse
 * @param {any} [fallback=null] - Fallback value if parsing fails
 * @returns {any} Parsed JSON or fallback value
 * @example
 * ```javascript
 * const data = safeJsonParse(response, {});
 * ```
 */
export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * @fileoverview Constants and configuration for the content script
 * @author Prompter Extension
 * @since 1.0.0
 */

/**
 * Supported websites and their hostnames
 * @readonly
 * @enum {string|string[]}
 */
export const SITES = {
  PERPLEXITY: "www.perplexity.ai",
  T3_CHAT: ["t3.chat", "www.t3.chat"],
  CHATGPT: ["chat.openai.com", "chatgpt.com"],
  CLAUDE: "claude.ai",
  GEMINI: "gemini.google.com",
};

/**
 * CSS selectors for finding editable elements
 * @readonly
 * @enum {string[]}
 */
export const SELECTORS = {
  TEXT_INPUTS: [
    "textarea",
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    ".chat-input",
    ".message-input",
    "#message-input",
    "div[contenteditable]",
  ],
  INPUT_TYPES: ["text", "textarea", "email", "search", "url"],
};

/**
 * Animation and timing constants
 * @readonly
 * @enum {number}
 */
export const TIMING = {
  ANIMATION_DURATION: 600,
  NOTIFICATION_TIMEOUT: 3000,
  SITE_DETECTION_DELAY: 1000,
  REACT_EVENT_DELAY: 50,
  FOCUS_DELAY: 10,
};

/**
 * Z-index values for layering
 * @readonly
 * @enum {number}
 */
export const Z_INDEX = {
  NOTIFICATION: 10000,
  MODAL_OVERLAY: 999999,
  REPLACEMENT_OVERLAY: 999999,
};

/**
 * CSS class names used by the extension
 * @readonly
 * @enum {string}
 */
export const CSS_CLASSES = {
  MODAL_OVERLAY: "prompter-modal-overlay",
  MODAL: "prompter-modal",
  TEMPLATE_ITEM: "prompter-template-item",
  TEMPLATE_SELECTED: "selected",
  REPLACEMENT_OVERLAY: "prompter-replacement-overlay",
  TRANSITION_STYLES: "prompter-transition-styles",
  MODAL_STYLES: "prompter-modal-styles",
};

/**
 * Event types used throughout the extension
 * @readonly
 * @enum {string[]}
 */
export const EVENTS = {
  INPUT_EVENTS: ["input", "change", "keyup", "paste"],
  FOCUS_EVENTS: ["blur", "focus"],
  PERPLEXITY_EVENTS: ["input", "change", "blur", "focus", "keyup"],
};

/**
 * Colors using OKLCH format for consistent theming
 * @readonly
 * @enum {string}
 */
export const COLORS = {
  ERROR: "oklch(0.629 0.1902 23.0704)",
  SUCCESS: "oklch(0.7176 0.1686 142.495)",
  INFO: "oklch(0.5393 0.2713 286.7462)",
  WHITE: "oklch(1 0 0)",
  PURPLE_GLOW: "rgba(139, 92, 246, 0.5)",
  PURPLE_GLOW_STRONG: "rgba(139, 92, 246, 0.8)",
};

/**
 * Chrome extension action types
 * @readonly
 * @enum {string}
 */
export const ACTIONS = {
  REPLACE_TEXT: "replaceText",
  SHOW_LOADING: "showLoading",
  SHOW_ERROR: "showError",
  SHOW_KEYBOARD_MODAL: "showKeyboardModal",
  FORMAT_WITH_TEMPLATE: "formatWithTemplate",
  TEXT_SELECTED: "textSelected",
};

/**
 * Notification types
 * @readonly
 * @enum {string}
 */
export const NOTIFICATION_TYPES = {
  ERROR: "error",
  SUCCESS: "success",
  INFO: "info",
};

/**
 * Regular expressions for text processing
 * @readonly
 * @enum {RegExp}
 */
export const REGEX = {
  JSON_BRACKETS: /^[\s]*[\{\[][\s\S]*[\}\]][\s]*$/,
  XML_TAGS: /<[^>]+>/,
};

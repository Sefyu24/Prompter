/**
 * @fileoverview Type definitions for the content script
 * @author Promptr Extension
 * @since 1.0.0
 */

/**
 * @typedef {Object} Template
 * @property {string} id - Unique template identifier
 * @property {string} name - Display name of the template
 * @property {string} [description] - Optional template description
 * @property {string} templateType - Type of template (json, xml, markdown)
 * @property {string} template_type - Alternative template type field
 * @property {string} promptTemplate - The template content
 * @property {string} prompt_template - Alternative template content field
 */

/**
 * @typedef {Object} TextReplacementOptions
 * @property {HTMLElement} [targetElement] - Optional target element override
 * @property {boolean} [showFeedback=true] - Whether to show visual feedback
 * @property {boolean} [useStoredRange=false] - Whether to use stored selection range
 */

/**
 * @typedef {Object} ModalConfig
 * @property {Template[]} templates - Available templates
 * @property {string} selectedText - Currently selected text
 * @property {HTMLElement} targetElement - Target element for replacement
 * @property {string} [error] - Error message if any
 */

/**
 * @typedef {Object} NotificationConfig
 * @property {string} message - Notification message
 * @property {'error'|'success'|'info'} type - Notification type
 * @property {number} [duration] - Display duration in milliseconds
 */

/**
 * Information about current text selection
 * @typedef {Object} SelectionInfo
 * @property {string} text - The selected text
 * @property {HTMLElement} element - The parent element containing the selection
 * @property {Node} anchorNode - The actual anchor node for the selection
 * @property {Range} range - The selection range
 * @property {boolean} isInInputField - Whether selection is in an input field
 */

/**
 * @typedef {Object} ReplacementResult
 * @property {boolean} success - Whether replacement was successful
 * @property {string} [error] - Error message if replacement failed
 * @property {HTMLElement} [element] - The element where text was replaced
 */

/**
 * @typedef {Object} SiteDetection
 * @property {boolean} isPerplexity - Whether current site is Perplexity
 * @property {boolean} isT3Chat - Whether current site is T3Chat
 * @property {boolean} isChatGPT - Whether current site is ChatGPT
 * @property {boolean} isClaude - Whether current site is Claude
 * @property {boolean} isGemini - Whether current site is Gemini
 */

/**
 * @typedef {Object} ChromeMessage
 * @property {string} action - The action to perform
 * @property {string} [newText] - New text for replacement
 * @property {string} [message] - Message content
 * @property {Template[]} [templates] - Available templates
 * @property {string} [error] - Error message
 * @property {string} [templateId] - Template identifier
 * @property {string} [selectedText] - Selected text content
 */

/**
 * @typedef {Object} ElementBounds
 * @property {number} top - Top position
 * @property {number} left - Left position
 * @property {number} width - Element width
 * @property {number} height - Element height
 * @property {number} scrollTop - Scroll top offset
 * @property {number} scrollLeft - Scroll left offset
 */

/**
 * Interface for site-specific text replacement handlers
 * @interface ISiteHandler
 */
/**
 * @function
 * @name ISiteHandler#replaceText
 * @param {HTMLElement} element - Target element
 * @param {string} newText - Text to insert
 * @param {TextReplacementOptions} [options] - Replacement options
 * @returns {Promise<ReplacementResult>} Replacement result
 */

/**
 * Interface for modal management
 * @interface IModalManager
 */
/**
 * @function
 * @name IModalManager#show
 * @param {ModalConfig} config - Modal configuration
 * @returns {Promise<void>}
 */
/**
 * @function
 * @name IModalManager#close
 * @returns {void}
 */
/**
 * @function
 * @name IModalManager#isVisible
 * @returns {boolean}
 */

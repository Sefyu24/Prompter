/**
 * @fileoverview Main modal manager - orchestrates the entire modal system
 * @author Promptr Extension
 * @since 1.0.0
 */

import { modalStyleManager } from "./modalStyles.js";
import { templateRenderer } from "./templateRenderer.js";
import { visualFeedbackManager } from "./visualFeedback.js";
import { textReplacementManager } from "./textReplacement.js";
import { domSafetyManager } from "./domSafety.js";
import { backgroundCommunicator } from "./messageHandler.js";
import { findEditableParent, getCurrentSelection } from "../utils.js";
import { CSS_CLASSES, ACTIONS, NOTIFICATION_TYPES } from "../constants.js";

/**
 * @typedef {import('../types.js').Template} Template
 * @typedef {import('../types.js').ModalConfig} ModalConfig
 * @typedef {import('../types.js').ChromeMessage} ChromeMessage
 */

/**
 * Manages the keyboard shortcut modal system
 * @class ModalManager
 */
export class ModalManager {
  constructor() {
    /** @type {HTMLElement|null} */
    this.modalElement = null;

    /** @type {HTMLElement|null} */
    this.searchInput = null;

    /** @type {string} */
    this.selectedText = "";

    /** @type {HTMLElement|null} */
    this.targetElement = null;

    /** @type {boolean} */
    this.isVisible = false;

    /** @type {AbortController|null} */
    this.eventController = null;
  }

  /**
   * Shows the modal with provided configuration
   * @param {ModalConfig} config - Modal configuration
   * @returns {Promise<void>}
   * @example
   * ```javascript
   * await modalManager.show({
   *   templates: userTemplates,
   *   selectedText: 'Hello world',
   *   targetElement: inputElement
   * });
   * ```
   */
  async show(config) {
    if (this.isVisible) {
      await this.close();
    }

    // Validate configuration
    const validationResult = this.validateConfig(config);
    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    // Store modal state
    this.selectedText = config.selectedText;
    this.targetElement = config.targetElement;

    // Set up templates
    templateRenderer.setTemplates(config.templates);

    // Ensure styles are loaded
    modalStyleManager.ensureModalStyles();

    // Create and show modal
    await this.createModal();
    this.setupEventListeners();
    this.attachToPage();
    this.focusSearchInput();

    this.isVisible = true;
  }

  /**
   * Validates modal configuration
   * @param {ModalConfig} config - Configuration to validate
   * @returns {{valid: boolean, error?: string}} Validation result
   * @private
   */
  validateConfig(config) {
    if (config.error) {
      if (config.error.includes("authenticated")) {
        visualFeedbackManager.showError(
          "Please sign in to use templates. Open the extension popup to authenticate."
        );
      } else {
        visualFeedbackManager.showError(config.error);
      }
      return { valid: false, error: config.error };
    }

    if (!config.selectedText || config.selectedText.trim().length === 0) {
      const error = "Please select text first";
      visualFeedbackManager.showError(error);
      return { valid: false, error };
    }

    if (!config.targetElement) {
      const error = "Please select text in an input field";
      visualFeedbackManager.showError(error);
      return { valid: false, error };
    }

    return { valid: true };
  }

  /**
   * Creates the modal DOM structure
   * @returns {Promise<void>}
   * @private
   */
  async createModal() {
    try {
      this.modalElement = document.createElement("div");
      
      if (!domSafetyManager.isValidElement(this.modalElement)) {
        throw new Error("Failed to create modal element");
      }
      
      this.modalElement.className = CSS_CLASSES.MODAL_OVERLAY;
      domSafetyManager.safeSetAttribute(this.modalElement, "role", "dialog");
      domSafetyManager.safeSetAttribute(this.modalElement, "aria-modal", "true");
      domSafetyManager.safeSetAttribute(this.modalElement, "aria-labelledby", "prompter-modal-title");

      const modalContent = `
        <div class="${CSS_CLASSES.MODAL}" role="document">
          <div class="prompter-header">
            <h3 id="prompter-modal-title">Select Template</h3>
            <input type="text" 
                   class="prompter-search" 
                   placeholder="Type to search templates..." 
                   autocomplete="off"
                   aria-label="Search templates"
                   aria-describedby="prompter-search-hint">
            <div id="prompter-search-hint" class="sr-only">
              Use arrow keys to navigate, Enter to select, Esc to close
            </div>
          </div>
          <div class="prompter-template-list" 
               role="listbox" 
               aria-label="Available templates"
               tabindex="-1">
            ${templateRenderer.renderTemplateList()}
          </div>
          <div class="prompter-footer">
            <span class="prompter-hints">
              ↑↓ Navigate • Enter Select • Esc Close • 1-9 Quick Select
            </span>
          </div>
        </div>
      `;
      
      // Set content directly since this is a newly created element
      try {
        this.modalElement.innerHTML = modalContent;
      } catch (htmlError) {
        console.error("Failed to set modal HTML:", htmlError);
        throw new Error("Failed to set modal content");
      }

      // Use regular querySelector since we just created this element and know it's safe
      this.searchInput = this.modalElement.querySelector(".prompter-search");
      
      if (!this.searchInput) {
        console.error("❌ Search input not found in modal HTML");
        console.error("Modal HTML length:", this.modalElement.innerHTML.length);
        console.error("Modal HTML preview:", this.modalElement.innerHTML.substring(0, 500));
        console.error("All inputs in modal:", this.modalElement.querySelectorAll("input"));
        console.error("Elements with 'search' class:", this.modalElement.querySelectorAll(".prompter-search"));
        throw new Error("Failed to find search input element");
      }
    } catch (error) {
      console.error("Modal creation failed:", error);
      throw error;
    }
  }

  /**
   * Sets up event listeners for modal interaction
   * @returns {void}
   * @private
   */
  setupEventListeners() {
    this.eventController = new AbortController();
    const { signal } = this.eventController;

    // Search input events
    if (this.searchInput) {
      this.searchInput.addEventListener("input", this.handleSearch.bind(this), {
        signal,
      });
      this.searchInput.addEventListener(
        "keydown",
        this.handleKeyDown.bind(this),
        { signal }
      );
    }

    // Click outside to close
    this.modalElement.addEventListener(
      "click",
      this.handleBackdropClick.bind(this),
      { signal }
    );

    // Template item clicks
    this.setupTemplateItemListeners(signal);

    // Global escape key
    document.addEventListener("keydown", this.handleGlobalKeyDown.bind(this), {
      signal,
    });
  }

  /**
   * Sets up click listeners for template items
   * @param {AbortSignal} signal - Abort signal for cleanup
   * @returns {void}
   * @private
   */
  setupTemplateItemListeners(signal) {
    const templateItems = this.modalElement.querySelectorAll(
      `.${CSS_CLASSES.TEMPLATE_ITEM}`
    );

    templateItems.forEach((item, index) => {
      item.addEventListener(
        "click",
        () => {
          this.selectTemplateByIndex(index);
        },
        { signal }
      );

      item.addEventListener(
        "mouseenter",
        () => {
          templateRenderer.selectByIndex(index);
          this.updateSelectionDisplay();
        },
        { signal }
      );
    });
  }

  /**
   * Handles search input
   * @param {Event} event - Input event
   * @returns {void}
   * @private
   */
  handleSearch(event) {
    const query = event.target.value;
    templateRenderer.filterTemplates(query);
    this.updateTemplateListContent();
  }

  /**
   * Handles keydown events in search input
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {void}
   * @private
   */
  handleKeyDown(event) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.moveSelection(1);
        break;

      case "ArrowUp":
        event.preventDefault();
        this.moveSelection(-1);
        break;

      case "Enter":
        event.preventDefault();
        this.selectCurrentTemplate();
        break;

      case "Escape":
        event.preventDefault();
        this.close();
        break;

      case "Tab":
        event.preventDefault();
        this.moveSelection(event.shiftKey ? -1 : 1);
        break;

      default:
        // Handle number keys (1-9)
        if (event.key >= "1" && event.key <= "9") {
          event.preventDefault();
          const number = parseInt(event.key);
          this.selectTemplateByQuickSelect(number);
        }
        break;
    }
  }

  /**
   * Handles global keydown events
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {void}
   * @private
   */
  handleGlobalKeyDown(event) {
    if (event.key === "Escape" && this.isVisible) {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  /**
   * Handles backdrop click to close modal
   * @param {Event} event - Click event
   * @returns {void}
   * @private
   */
  handleBackdropClick(event) {
    if (event.target === this.modalElement) {
      this.close();
    }
  }

  /**
   * Moves selection up or down
   * @param {number} direction - Direction to move (-1 for up, 1 for down)
   * @returns {void}
   * @private
   */
  moveSelection(direction) {
    if (templateRenderer.moveSelection(direction)) {
      this.updateSelectionDisplay();
      this.scrollSelectedIntoView();
    }
  }

  /**
   * Updates the visual selection display
   * @returns {void}
   * @private
   */
  updateSelectionDisplay() {
    const templateItems = this.modalElement.querySelectorAll(
      `.${CSS_CLASSES.TEMPLATE_ITEM}`
    );
    const { selectedIndex } = templateRenderer.getSelectionState();

    templateItems.forEach((item, index) => {
      const isSelected = index === selectedIndex;
      item.classList.toggle(CSS_CLASSES.TEMPLATE_SELECTED, isSelected);
      item.setAttribute("aria-selected", isSelected);
      item.setAttribute("tabindex", isSelected ? 0 : -1);
    });
  }

  /**
   * Scrolls the selected item into view
   * @returns {void}
   * @private
   */
  scrollSelectedIntoView() {
    const selectedItem = this.modalElement.querySelector(
      `.${CSS_CLASSES.TEMPLATE_ITEM}.${CSS_CLASSES.TEMPLATE_SELECTED}`
    );

    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }

  /**
   * Updates the template list display (only called when search changes)
   * @returns {void}
   * @private
   */
  updateTemplateList() {
    const templateList = this.modalElement.querySelector(
      ".prompter-template-list"
    );
    if (templateList) {
      templateList.innerHTML = templateRenderer.renderTemplateList();
      this.setupTemplateItemListeners(this.eventController.signal);
      this.updateSelectionDisplay();
    }
  }

  /**
   * Updates only the template list content without affecting modal structure
   * @returns {void}
   * @private
   */
  updateTemplateListContent() {
    const templateList = this.modalElement.querySelector(
      ".prompter-template-list"
    );
    if (templateList) {
      // Store current scroll position
      const scrollTop = templateList.scrollTop;
      
      // Update content
      templateList.innerHTML = templateRenderer.renderTemplateList();
      this.setupTemplateItemListeners(this.eventController.signal);
      this.updateSelectionDisplay();
      
      // Restore scroll position
      templateList.scrollTop = scrollTop;
    }
  }

  /**
   * Selects template by index
   * @param {number} index - Template index
   * @returns {Promise<void>}
   * @private
   */
  async selectTemplateByIndex(index) {
    if (templateRenderer.selectByIndex(index)) {
      await this.selectCurrentTemplate();
    }
  }

  /**
   * Selects template by quick select number
   * @param {number} number - Quick select number (1-9)
   * @returns {Promise<void>}
   * @private
   */
  async selectTemplateByQuickSelect(number) {
    const template = templateRenderer.getTemplateByQuickSelect(number);
    if (template) {
      await this.processTemplateSelection(template);
    }
  }

  /**
   * Selects the currently highlighted template
   * @returns {Promise<void>}
   * @private
   */
  async selectCurrentTemplate() {
    const selectedTemplate = templateRenderer.getSelectedTemplate();
    if (selectedTemplate) {
      await this.processTemplateSelection(selectedTemplate);
    }
  }

  /**
   * Processes template selection and formats text with enhanced visual feedback
   * @param {Template} template - Selected template
   * @returns {Promise<void>}
   * @private
   */
  async processTemplateSelection(template) {
    try {
      // Show loading state
      this.showLoadingState();

      // Send message to background script for formatting
      const response = await this.requestTextFormatting(template);

      if (response.error) {
        throw new Error(response.error);
      }

      // Show text replacement progress
      this.showReplacementProgress();

      // Replace text with formatted result
      await this.replaceTextWithResult(response.formattedText);

      // Show success state and close modal after delay
      this.showSuccessAndClose();
    } catch (error) {
      console.error("Template selection failed:", error);
      visualFeedbackManager.showError(error.message || "Failed to format text");
      await this.close();
    }
  }

  /**
   * Requests text formatting from background script
   * @param {Template} template - Template to use for formatting
   * @returns {Promise<string>} Formatted text
   * @private
   */
  async requestTextFormatting(template) {
    try {
      const formattedText = await backgroundCommunicator.formatText(
        template.id, 
        this.selectedText
      );
      
      return { formattedText };
    } catch (error) {
      console.error("Text formatting failed:", error);
      throw error;
    }
  }

  /**
   * Replaces text with formatted result
   * @param {string} formattedText - Formatted text to insert
   * @returns {Promise<void>}
   * @private
   */
  async replaceTextWithResult(formattedText) {
    if (!formattedText || !this.targetElement) {
      throw new Error("No formatted text or target element");
    }

    const result = await textReplacementManager.replaceTextFromModal(
      formattedText,
      this.selectedText,
      this.targetElement
    );

    if (!result.success) {
      throw new Error(result.error || "Text replacement failed");
    }
  }

  /**
   * Shows loading state in modal
   * @returns {void}
   * @private
   */
  showLoadingState() {
    const templateList = this.modalElement.querySelector(
      ".prompter-template-list"
    );
    if (templateList) {
      templateList.innerHTML = templateRenderer.renderLoadingState();
    }
  }

  /**
   * Shows text replacement progress in modal
   * @returns {void}
   * @private
   */
  showReplacementProgress() {
    const templateList = this.modalElement.querySelector(
      ".prompter-template-list"
    );
    if (templateList) {
      templateList.innerHTML = templateRenderer.renderReplacementProgress();
    }
  }

  /**
   * Shows success state and closes modal after delay
   * @returns {void}
   * @private
   */
  showSuccessAndClose() {
    const templateList = this.modalElement.querySelector(
      ".prompter-template-list"
    );
    if (templateList) {
      templateList.innerHTML = templateRenderer.renderSuccessState();
    }

    // Wait for user to see success message, then close
    setTimeout(() => {
      this.close();
    }, 600);
  }

  /**
   * Attaches modal to page
   * @returns {void}
   * @private
   */
  attachToPage() {
    try {
      if (!domSafetyManager.isValidElement(this.modalElement)) {
        throw new Error("Invalid modal element");
      }
      
      if (!document.body) {
        throw new Error("Document body not available");
      }
      
      document.body.appendChild(this.modalElement);
    } catch (error) {
      console.error("Failed to attach modal to page:", error);
      throw error;
    }
  }

  /**
   * Focuses the search input
   * @returns {void}
   * @private
   */
  focusSearchInput() {
    if (domSafetyManager.isValidElement(this.searchInput)) {
      // Use requestAnimationFrame to ensure modal is fully rendered
      requestAnimationFrame(() => {
        if (!domSafetyManager.safeFocus(this.searchInput)) {
          console.warn("Failed to focus search input");
        }
      });
    } else {
      console.warn("Search input element is not valid for focusing");
    }
  }

  /**
   * Closes the modal
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.isVisible) return;

    try {
      // Clean up event listeners
      if (this.eventController) {
        this.eventController.abort();
        this.eventController = null;
      }

      // Remove modal from DOM with animation
      if (domSafetyManager.isValidElement(this.modalElement)) {
        this.modalElement.style.animation = "prompter-modal-exit 0.2s ease-out";

        await new Promise((resolve) => {
          setTimeout(() => {
            if (domSafetyManager.isValidElement(this.modalElement)) {
              domSafetyManager.safeRemoveElement(this.modalElement);
            }
            resolve();
          }, 200);
        });
      }
    } catch (error) {
      console.error("Error during modal close:", error);
      // Continue with cleanup even if animation fails
    }

    // Reset state
    this.modalElement = null;
    this.searchInput = null;
    this.selectedText = "";
    this.targetElement = null;
    this.isVisible = false;

    // Reset renderer
    templateRenderer.reset();

  }

  /**
   * Checks if modal is currently visible
   * @returns {boolean} True if modal is visible
   */
  getIsVisible() {
    return this.isVisible;
  }

  /**
   * Gets current modal state for debugging
   * @returns {Object} Current modal state
   */
  getState() {
    return {
      isVisible: this.isVisible,
      hasTargetElement: !!this.targetElement,
      selectedText: this.selectedText,
      templateStats: templateRenderer.getStatistics(),
    };
  }
}

// Debouncing state for modal opening
let modalOpenTimeout = null;
let lastModalOpenTime = 0;
const MODAL_OPEN_DEBOUNCE = 500; // 500ms debounce

/**
 * Handles keyboard modal message from background script with debouncing
 * @param {ChromeMessage} message - Message from background script
 * @returns {Promise<void>}
 */
export async function handleKeyboardModal(message) {
  const now = Date.now();
  
  // Clear any existing timeout
  if (modalOpenTimeout) {
    clearTimeout(modalOpenTimeout);
  }
  
  // If called too quickly, debounce it
  if (now - lastModalOpenTime < MODAL_OPEN_DEBOUNCE) {
    modalOpenTimeout = setTimeout(() => {
      handleKeyboardModalImmediate(message);
    }, MODAL_OPEN_DEBOUNCE);
    return;
  }
  
  lastModalOpenTime = now;
  return handleKeyboardModalImmediate(message);
}

/**
 * Immediate handler for keyboard modal (internal function)
 * @param {ChromeMessage} message - Message from background script
 * @returns {Promise<void>}
 * @private
 */
async function handleKeyboardModalImmediate(message) {
  // Check if there's an error message first
  if (message.error) {
    if (message.error.includes("authenticated")) {
      visualFeedbackManager.showError(
        "Please sign in to use templates. Open the extension popup to authenticate."
      );
    } else {
      visualFeedbackManager.showError(message.error);
    }
    return;
  }

  // Validate text selection
  const selectionInfo = getCurrentSelection();

  if (!selectionInfo) {
    visualFeedbackManager.showError("Please select text first");
    return;
  }


  // Find target element using the actual anchor node, matching original behavior
  const targetElement = findEditableParent(selectionInfo.anchorNode);


  if (!targetElement) {
    console.error("❌ findEditableParent returned null for:", {
      website: window.location.hostname,
      anchorNode: selectionInfo.anchorNode,
      anchorNodeHTML:
        selectionInfo.anchorNode?.parentElement?.outerHTML?.substring(0, 200),
      selectionText: selectionInfo.text,
    });

    visualFeedbackManager.showError("Please select text in an input field");
    return;
  }

  // Fetch fresh templates before showing modal
  try {
    const freshTemplates = await backgroundCommunicator.getTemplates();
    
    // Use singleton modal manager to prevent duplicates
    await globalModalManager.show({
      templates: freshTemplates,
      selectedText: selectionInfo.text,
      targetElement: targetElement,
      error: message.error,
    });
  } catch (templatesError) {
    // Fallback to templates from message using singleton
    await globalModalManager.show({
      templates: message.templates || [],
      selectedText: selectionInfo.text,
      targetElement: targetElement,
      error: message.error,
    });
  }
}

// Create a singleton instance for global use
export const globalModalManager = new ModalManager();

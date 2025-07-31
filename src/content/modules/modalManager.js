/**
 * @fileoverview Main modal manager - orchestrates the entire modal system
 * @author Prompter Extension
 * @since 1.0.0
 */

import { modalStyleManager } from "./modalStyles.js";
import { templateRenderer } from "./templateRenderer.js";
import { visualFeedbackManager } from "./visualFeedback.js";
import { textReplacementManager } from "./textReplacement.js";
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
    this.createModal();
    this.setupEventListeners();
    this.attachToPage();
    this.focusSearchInput();

    this.isVisible = true;
    console.log(
      "📱 Modal opened with",
      config.templates?.length || 0,
      "templates"
    );
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
   * @returns {void}
   * @private
   */
  createModal() {
    this.modalElement = document.createElement("div");
    this.modalElement.className = CSS_CLASSES.MODAL_OVERLAY;
    this.modalElement.setAttribute("role", "dialog");
    this.modalElement.setAttribute("aria-modal", "true");
    this.modalElement.setAttribute("aria-labelledby", "prompter-modal-title");

    this.modalElement.innerHTML = `
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

    this.searchInput = this.modalElement.querySelector(".prompter-search");
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
    this.updateTemplateList();
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
   * Updates the template list display
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
   * Processes template selection and formats text
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

      // Replace text with formatted result
      await this.replaceTextWithResult(response.formattedText);

      // Close modal
      await this.close();
    } catch (error) {
      console.error("Template selection failed:", error);
      visualFeedbackManager.showError(error.message || "Failed to format text");
      await this.close();
    }
  }

  /**
   * Requests text formatting from background script
   * @param {Template} template - Template to use for formatting
   * @returns {Promise<any>} Formatting response
   * @private
   */
  async requestTextFormatting(template) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: ACTIONS.FORMAT_WITH_TEMPLATE,
          templateId: template.id,
          selectedText: this.selectedText,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            reject(new Error("No response from background script"));
            return;
          }

          resolve(response);
        }
      );
    });
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
   * Attaches modal to page
   * @returns {void}
   * @private
   */
  attachToPage() {
    document.body.appendChild(this.modalElement);
  }

  /**
   * Focuses the search input
   * @returns {void}
   * @private
   */
  focusSearchInput() {
    if (this.searchInput) {
      // Use requestAnimationFrame to ensure modal is fully rendered
      requestAnimationFrame(() => {
        this.searchInput.focus();
      });
    }
  }

  /**
   * Closes the modal
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.isVisible) return;

    // Clean up event listeners
    if (this.eventController) {
      this.eventController.abort();
      this.eventController = null;
    }

    // Remove modal from DOM with animation
    if (this.modalElement) {
      this.modalElement.style.animation = "prompter-modal-exit 0.2s ease-out";

      await new Promise((resolve) => {
        setTimeout(() => {
          if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
          }
          resolve();
        }, 200);
      });
    }

    // Reset state
    this.modalElement = null;
    this.searchInput = null;
    this.selectedText = "";
    this.targetElement = null;
    this.isVisible = false;

    // Reset renderer
    templateRenderer.reset();

    console.log("📱 Modal closed");
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

/**
 * Handles keyboard modal message from background script
 * @param {ChromeMessage} message - Message from background script
 * @returns {Promise<void>}
 */
export async function handleKeyboardModal(message) {
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

  console.log("🔍 Selection Debug Info:", {
    text: selectionInfo.text,
    textLength: selectionInfo.text.length,
    element: selectionInfo.element,
    elementTagName: selectionInfo.element?.tagName,
    elementId: selectionInfo.element?.id,
    elementClass: selectionInfo.element?.className,
    anchorNode: selectionInfo.anchorNode,
    anchorNodeType: selectionInfo.anchorNode?.nodeType,
    anchorNodeName: selectionInfo.anchorNode?.nodeName,
    anchorNodeParent: selectionInfo.anchorNode?.parentElement,
    anchorNodeParentTag: selectionInfo.anchorNode?.parentElement?.tagName,
    isInInputField: selectionInfo.isInInputField,
    currentURL: window.location.href,
  });

  // Find target element using the actual anchor node, matching original behavior
  const targetElement = findEditableParent(selectionInfo.anchorNode);

  console.log("🎯 Target Element Search Result:", {
    targetElement: targetElement,
    targetElementTag: targetElement?.tagName,
    targetElementId: targetElement?.id,
    targetElementClass: targetElement?.className,
    targetElementContentEditable: targetElement?.contentEditable,
    targetElementRole: targetElement?.getAttribute("role"),
    targetElementDataAttrs: targetElement
      ? Object.fromEntries(
          Array.from(targetElement.attributes)
            .filter((attr) => attr.name.startsWith("data-"))
            .map((attr) => [attr.name, attr.value])
        )
      : {},
  });

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

  // Create and show modal
  const modalManager = new ModalManager();
  await modalManager.show({
    templates: message.templates || [],
    selectedText: selectionInfo.text,
    targetElement: targetElement,
    error: message.error,
  });
}

// Create a singleton instance for global use
export const globalModalManager = new ModalManager();

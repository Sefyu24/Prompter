// Content script - runs on web pages
import insertTextAtCursor from 'insert-text-at-cursor';

// Extension loaded

let selectedText = "";
let targetElement = null;
let selectionRange = null;

// Check which site we're on for site-specific handling
const isPerplexity = window.location.hostname === 'www.perplexity.ai';
const isT3Chat = window.location.hostname === 't3.chat' || window.location.hostname === 'www.t3.chat';
const isChatGPT = window.location.hostname === 'chat.openai.com' || window.location.hostname === 'chatgpt.com';
const isClaude = window.location.hostname === 'claude.ai';
const isGemini = window.location.hostname === 'gemini.google.com';

// Listen for text selection - use multiple events for better compatibility
const captureSelection = function(e) {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    // Store the element that contains the selection
    if (selection.anchorNode) {
      targetElement = selection.anchorNode.parentElement || selection.anchorNode;
    } else if (e && e.target) {
      // Fallback to event target
      targetElement = e.target;
    }
    
    // Store the selection range for later use
    if (selection.rangeCount > 0) {
      selectionRange = selection.getRangeAt(0).cloneRange();
    }

    // Check if the selection is in an input field or textarea
    const isInInputField = isTextInput(targetElement);

    if (isInInputField) {
      // Send message to background script that text is selected
      chrome.runtime.sendMessage({
        action: "textSelected",
        text: selectedText,
        isInInputField: true,
      });
    }
  }
};

// Add multiple event listeners for better selection capture
document.addEventListener("mouseup", captureSelection);
document.addEventListener("selectionchange", captureSelection);

// For t3.chat, also listen on the document body
if (isT3Chat) {
  setTimeout(() => {
    const body = document.querySelector('body');
    if (body) {
      body.addEventListener("mouseup", captureSelection);
    }
  }, 1000);
}

// Function to check if element is a text input
function isTextInput(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const inputTypes = ["text", "textarea", "email", "search", "url"];

  // Check for textarea
  if (tagName === "textarea") return true;

  // Check for input with text-like type
  if (tagName === "input" && inputTypes.includes(element.type)) return true;

  // Check for contenteditable divs (common in modern chat interfaces)
  if (element.contentEditable === "true") return true;

  // Check if parent is contenteditable
  let parent = element.parentElement;
  while (parent) {
    if (parent.contentEditable === "true") return true;
    parent = parent.parentElement;
  }

  return false;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Message received
  
  // Always send a response to prevent port closure
  sendResponse({received: true});
  
  if (message.action === "replaceText") {
    // Replacing text
    replaceSelectedText(message.newText);
  } else if (message.action === "showLoading") {
    showNotification("Formatting text...", "info");
  } else if (message.action === "showError") {
    showNotification(message.message, "error");
  } else if (message.action === "showKeyboardModal") {
    // Handle keyboard shortcut modal
    handleKeyboardModal(message);
  }
  
  return true; // Keep message channel open for async responses
});

/**
 * Replace selected text with formatted text using insert-text-at-cursor library
 * This handles all input types: textarea, input, contenteditable, etc.
 * @param {string} newText - The formatted text to insert
 */
function replaceSelectedText(newText) {
  if (isPerplexity || isT3Chat) {
    const siteName = isPerplexity ? 'Perplexity.ai' : 'T3.chat';
    // Starting text replacement
  }

  let editableElement = null;
  let useStoredRange = false;

  // Try to use stored selection range first (better for perplexity.ai)
  if (selectionRange && targetElement) {
    editableElement = findEditableParent(selectionRange.commonAncestorContainer);
    useStoredRange = true;
  }

  // Fallback to current selection
  if (!editableElement) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      editableElement = findEditableParent(container);
    }
  }
  
  // For t3.chat, try finding the input field directly
  if (!editableElement && isT3Chat) {
    // Searching for input field directly
    // Try common selectors for chat input fields
    const selectors = [
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '.chat-input',
      '.message-input',
      '#message-input',
      'div[contenteditable]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        editableElement = element;
        // Found input field
        break;
      }
    }
  }

  if (editableElement) {
    try {
      if (isPerplexity) {
        // Found editable element
      }

      // Focus the element first to ensure proper insertion
      editableElement.focus();
      
      // For perplexity.ai and t3.chat, try a more aggressive approach
      if (isPerplexity || isT3Chat) {
        replaceTextForPerplexity(editableElement, newText, useStoredRange);
      } else {
        // Handle contenteditable elements differently than textarea/input
        if (editableElement.contentEditable === 'true') {
          // For contenteditable, we need to handle newlines properly
          insertTextIntoContentEditable(editableElement, newText);
        } else {
          // For textarea/input, use the library directly
          insertTextAtCursor(editableElement, newText);
        }
      }
      
      // Trigger multiple events to ensure the page recognizes the change
      const events = ['input', 'change', 'keyup', 'paste'];
      events.forEach(eventType => {
        editableElement.dispatchEvent(new Event(eventType, { bubbles: true }));
      });
      
      // For React apps, also dispatch a synthetic event
      if (editableElement._valueTracker) {
        editableElement._valueTracker.setValue('');
      }
      
    } catch (error) {
      // Error inserting text - fallback to manual replacement
      // Fallback to manual replacement if library fails
      fallbackTextReplacement(editableElement, newText);
    }
  } else {
    // No editable element found
  }
}

/**
 * Perplexity.ai-specific text replacement function
 * @param {HTMLElement} element - The target element
 * @param {string} newText - The text to insert
 * @param {boolean} useStoredRange - Whether to use the stored selection range
 */
function replaceTextForPerplexity(element, newText, useStoredRange) {
  try {
    // Attempting text replacement
    
    // Method 1: Use execCommand which works better with contenteditable
    if (element.contentEditable === 'true') {
      // Focus the element
      element.focus();
      
      // Select all content
      document.execCommand('selectAll', false, null);
      
      // Delete the selected content
      document.execCommand('delete', false, null);
      
      // Insert the new text using insertText command
      // This maintains undo/redo history and triggers proper events
      document.execCommand('insertText', false, newText);
      
      // Used execCommand method
      
      // Additional event triggering for React
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: newText
      });
      element.dispatchEvent(inputEvent);
      
      return;
    }
    
    // Method 2: Try contenteditable approach
    if (element.contentEditable === 'true') {
      insertTextIntoContentEditable(element, newText);
      // Used contenteditable method
      return;
    }
    
    // Method 3: Try direct value assignment for input/textarea
    if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const value = element.value || '';
      
      element.value = value.substring(0, start) + newText + value.substring(end);
      element.selectionStart = start;
      element.selectionEnd = start + newText.length;
      
      // For t3.chat, prevent clipboard event conflicts
      if (isT3Chat) {
        // Stop propagation to prevent React errors
        const stopEvent = (e) => {
          e.stopPropagation();
          e.preventDefault();
        };
        
        element.addEventListener('paste', stopEvent, { once: true, capture: true });
        element.addEventListener('input', stopEvent, { once: true, capture: true });
        
        // Dispatch a controlled input event after a delay
        setTimeout(() => {
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }, 50);
      }
      
      // Used direct value assignment
      return;
    }
    
    // Method 4: Fallback to insert-text-at-cursor library
    insertTextAtCursor(element, newText);
    // Used insert-text-at-cursor library
    
  } catch (error) {
    console.error('Text replacement failed:', error);
    fallbackTextReplacement(element, newText);
  }
}

/**
 * Insert text into contenteditable element with proper line break handling
 * @param {HTMLElement} element - The contenteditable element
 * @param {string} text - The text to insert
 */
function insertTextIntoContentEditable(element, text) {
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // Split text by newlines and create proper DOM structure
    const lines = text.split('\n');
    const fragment = document.createDocumentFragment();
    
    lines.forEach((line, index) => {
      // Add the text content
      if (line.length > 0) {
        fragment.appendChild(document.createTextNode(line));
      }
      
      // Add line break (except for the last line)
      if (index < lines.length - 1) {
        fragment.appendChild(document.createElement('br'));
      }
    });
    
    range.insertNode(fragment);
    
    // Move cursor to end of inserted content
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Fallback text replacement method if insert-text-at-cursor fails
 * @param {HTMLElement} element - The target element
 * @param {string} newText - The text to insert
 */
function fallbackTextReplacement(element, newText) {
  if (element.tagName.toLowerCase() === "textarea" || 
      element.tagName.toLowerCase() === "input") {
    // Handle textarea/input
    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const text = element.value || '';

    element.value = text.substring(0, start) + newText + text.substring(end);
    element.selectionStart = start;
    element.selectionEnd = start + newText.length;
  } else {
    // Handle contenteditable - simple text replacement
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      selection.removeAllRanges();
    } else if (selectionRange) {
      // Try with stored range
      selectionRange.deleteContents();
      selectionRange.insertNode(document.createTextNode(newText));
    }
  }
  
  // Trigger additional events for perplexity.ai
  if (isPerplexity) {
    const events = ['input', 'change', 'blur', 'focus', 'keyup'];
    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
  }
}

function findEditableParent(node) {
  while (node && node !== document) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node;
      if (
        element.tagName.toLowerCase() === "textarea" ||
        element.tagName.toLowerCase() === "input" ||
        element.contentEditable === "true"
      ) {
        return element;
      }
    }
    node = node.parentNode;
  }
  return null;
}

// Function to show notifications
function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background-color: ${type === "error" ? "oklch(0.629 0.1902 23.0704)" : "oklch(0.5393 0.2713 286.7462)"};
    color: oklch(1 0 0);
    border: 1px solid ${type === "error" ? "oklch(0.629 0.1902 23.0704)" : "oklch(0.5393 0.2713 286.7462)"};
    border-radius: calc(1.4rem - 6px);
    box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16);
    z-index: 10000;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.025em;
    animation: prompter-notification-enter 0.2s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ===== KEYBOARD MODAL SYSTEM =====

let keyboardModal = null;
let currentSelectedIndex = 0;
let filteredTemplates = [];
let allTemplates = [];
let modalSelectedText = "";
let modalTargetElement = null;

/**
 * Handle keyboard modal message from background script
 */
function handleKeyboardModal(message) {
  // Check if there's an error message
  if (message.error) {
    showNotification(message.error, "error");
    return;
  }

  // Validate text selection
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  if (!selectedText || selectedText.length === 0) {
    showNotification("Please select text first", "error");
    return;
  }

  // Check if selection is in a supported input field
  const targetElement = findEditableParent(selection.anchorNode);
  if (!targetElement) {
    showNotification("Please select text in an input field", "error");
    return;
  }

  // Store selection info for later use
  modalSelectedText = selectedText;
  modalTargetElement = targetElement;
  allTemplates = message.templates || [];
  filteredTemplates = [...allTemplates];
  currentSelectedIndex = 0;

  // Show the modal
  showKeyboardModal();
}

/**
 * Create and show the keyboard modal
 */
function showKeyboardModal() {
  // Remove existing modal if present
  if (keyboardModal) {
    keyboardModal.remove();
  }

  // Create modal structure
  keyboardModal = document.createElement('div');
  keyboardModal.className = 'prompter-modal-overlay';
  keyboardModal.innerHTML = `
    <div class="prompter-modal">
      <div class="prompter-header">
        <h3>Select Template</h3>
        <input type="text" class="prompter-search" placeholder="Type to search..." autocomplete="off">
      </div>
      <div class="prompter-template-list">
        ${renderTemplateList()}
      </div>
      <div class="prompter-footer">
        <span class="prompter-hints">↑↓ Navigate • Enter Select • Esc Close • 1-9 Quick Select</span>
      </div>
    </div>
  `;

  // Add styles
  addModalStyles();

  // Add event listeners
  addModalEventListeners();

  // Position modal
  positionModal();

  // Add to page
  document.body.appendChild(keyboardModal);

  // Focus search input
  const searchInput = keyboardModal.querySelector('.prompter-search');
  if (searchInput) {
    searchInput.focus();
  }
}

/**
 * Render the template list HTML
 */
function renderTemplateList() {
  if (filteredTemplates.length === 0) {
    return '<div class="prompter-empty">No templates found</div>';
  }

  return filteredTemplates.map((template, index) => {
    const templateType = template.templateType || template.template_type || 'json';
    const typeClass = `prompter-type-badge prompter-type-${templateType}`;
    return `
      <div class="prompter-template-item ${index === currentSelectedIndex ? 'selected' : ''}" data-index="${index}">
        <div class="prompter-template-header">
          <div class="prompter-template-name">${escapeHtml(template.name)}</div>
          <span class="${typeClass}">${templateType.toUpperCase()}</span>
        </div>
        ${template.description ? `<div class="prompter-template-description">${escapeHtml(template.description)}</div>` : ''}
        <div class="prompter-template-number">${index + 1}</div>
      </div>
    `;
  }).join('');
}

/**
 * Add modal styles to the page using Tailwind-based design system
 */
function addModalStyles() {
  if (document.getElementById('prompter-modal-styles')) {
    return; // Styles already added
  }

  const style = document.createElement('style');
  style.id = 'prompter-modal-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap');
    
    .prompter-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Plus Jakarta Sans', sans-serif;
      letter-spacing: -0.025em;
    }

    .prompter-modal {
      background: oklch(0.994 0 0);
      border: 1px solid oklch(0.93 0.0094 286.2156);
      border-radius: 1.4rem;
      box-shadow: 0px 8px 10px -1px hsl(0 0% 0% / 0.16), 0px 2px 3px 0px hsl(0 0% 0% / 0.16);
      width: 90%;
      max-width: 480px;
      max-height: 80vh;
      overflow: hidden;
      animation: prompter-modal-enter 0.2s ease-out;
    }

    @keyframes prompter-modal-enter {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
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

    .prompter-header {
      padding: 20px 20px 16px;
      border-bottom: 1px solid oklch(0.93 0.0094 286.2156);
    }

    .prompter-header h3 {
      margin: 0 0 12px 0;
      font-size: 18px;
      font-weight: 600;
      color: oklch(0 0 0);
    }

    .prompter-search {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid oklch(0.93 0.0094 286.2156);
      border-radius: calc(1.4rem - 8px);
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      background: oklch(0.9401 0 0);
      color: oklch(0 0 0);
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    .prompter-search:focus {
      border-color: oklch(0.5393 0.2713 286.7462);
      box-shadow: 0 0 0 3px oklch(0.5393 0.2713 286.7462 / 0.1);
    }

    .prompter-template-list {
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    }

    .prompter-template-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      margin: 4px 0;
      border-radius: calc(1.4rem - 6px);
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
      background: oklch(0.994 0 0);
      border: 1px solid transparent;
    }

    .prompter-template-item:hover {
      background-color: oklch(0.9702 0 0);
      border: 1px solid oklch(0.93 0.0094 286.2156);
      box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.08);
    }

    .prompter-template-item.selected {
      background-color: oklch(0.9393 0.0288 266.368);
      border-color: oklch(0.5393 0.2713 286.7462);
      box-shadow: 0px 2px 3px 0px hsl(0 0% 0% / 0.16), 0px 1px 2px -1px hsl(0 0% 0% / 0.16);
    }

    .prompter-template-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
      width: 100%;
    }

    .prompter-template-name {
      font-weight: 500;
      color: oklch(0 0 0);
      flex: 1;
    }

    .prompter-template-description {
      font-size: 13px;
      color: oklch(0.4386 0 0);
      flex: 1;
      margin-top: 2px;
    }

    .prompter-type-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .prompter-type-json {
      background: oklch(0.4792 0.2202 231.6067 / 0.1);
      color: oklch(0.4792 0.2202 231.6067);
    }

    .prompter-type-xml {
      background: oklch(0.5568 0.2294 142.495 / 0.1);
      color: oklch(0.5568 0.2294 142.495);
    }

    .prompter-type-markdown {
      background: oklch(0.5393 0.2713 286.7462 / 0.1);
      color: oklch(0.5393 0.2713 286.7462);
    }

    .prompter-template-number {
      position: absolute;
      top: 8px;
      right: 8px;
      background: oklch(0.9702 0 0);
      color: oklch(0.4386 0 0);
      font-size: 11px;
      font-weight: 500;
      padding: 2px 6px;
      border-radius: calc(1.4rem - 10px);
      min-width: 16px;
      text-align: center;
    }

    .prompter-template-item.selected .prompter-template-number {
      background: oklch(0.5393 0.2713 286.7462);
      color: oklch(1 0 0);
    }

    .prompter-empty {
      text-align: center;
      padding: 40px 20px;
      color: oklch(0.4386 0 0);
      font-size: 14px;
    }

    .prompter-footer {
      padding: 12px 20px;
      background: oklch(0.9702 0 0);
      border-top: 1px solid oklch(0.93 0.0094 286.2156);
    }

    .prompter-hints {
      font-size: 12px;
      color: oklch(0.4386 0 0);
      text-align: center;
      display: block;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Add event listeners to the modal
 */
function addModalEventListeners() {
  if (!keyboardModal) return;

  const searchInput = keyboardModal.querySelector('.prompter-search');
  
  // Search input events
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keydown', handleSearchKeydown);
  }

  // Click outside to close
  keyboardModal.addEventListener('click', (e) => {
    if (e.target === keyboardModal) {
      closeKeyboardModal();
    }
  });

  // Template item clicks
  const templateItems = keyboardModal.querySelectorAll('.prompter-template-item');
  templateItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      selectTemplate(index);
    });
  });
}

/**
 * Handle search input
 */
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (query === '') {
    filteredTemplates = [...allTemplates];
  } else {
    filteredTemplates = allTemplates.filter(template => 
      template.name.toLowerCase().includes(query) ||
      (template.description && template.description.toLowerCase().includes(query))
    );
  }
  
  currentSelectedIndex = 0;
  updateTemplateList();
}

/**
 * Handle keydown events in search input
 */
function handleSearchKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      moveSelection(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveSelection(-1);
      break;
    case 'Enter':
      e.preventDefault();
      selectTemplate(currentSelectedIndex);
      break;
    case 'Escape':
      e.preventDefault();
      closeKeyboardModal();
      break;
    default:
      // Handle number keys (1-9)
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < filteredTemplates.length) {
          selectTemplate(index);
        }
      }
      break;
  }
}

/**
 * Move selection up or down
 */
function moveSelection(direction) {
  const newIndex = currentSelectedIndex + direction;
  
  if (newIndex >= 0 && newIndex < filteredTemplates.length) {
    currentSelectedIndex = newIndex;
    updateTemplateList();
    
    // Scroll selected item into view
    const selectedItem = keyboardModal.querySelector('.prompter-template-item.selected');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }
}

/**
 * Update the template list display
 */
function updateTemplateList() {
  const templateList = keyboardModal.querySelector('.prompter-template-list');
  if (templateList) {
    templateList.innerHTML = renderTemplateList();
    
    // Re-add click listeners
    const templateItems = templateList.querySelectorAll('.prompter-template-item');
    templateItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        selectTemplate(index);
      });
    });
  }
}

/**
 * Select a template and format the text
 */
function selectTemplate(index) {
  if (index < 0 || index >= filteredTemplates.length) {
    return;
  }

  const selectedTemplate = filteredTemplates[index];
  
  // Show loading state
  showLoadingState();

  // Send message to background script to format text
  chrome.runtime.sendMessage({
    action: "formatWithTemplate",
    templateId: selectedTemplate.id,
    selectedText: modalSelectedText
  }, (response) => {
    if (chrome.runtime.lastError) {
      const errorMessage = chrome.runtime.lastError.message || "Unknown runtime error";
      console.error("Chrome runtime error:", errorMessage);
      console.error("Full error object:", chrome.runtime.lastError);
      showNotification(`Communication error: ${errorMessage}`, "error");
      closeKeyboardModal();
      return;
    }

    if (!response) {
      console.error("No response received from background script");
      showNotification("No response from extension background", "error");
      closeKeyboardModal();
      return;
    }

    if (response.error) {
      console.error("Background script error:", response.error);
      showNotification(response.error, "error");
      closeKeyboardModal();
      return;
    }

    // Replace the selected text with formatted result
    if (response.formattedText && modalTargetElement) {
      try {
        // Focus the target element
        modalTargetElement.focus();
        
        // Replace the text using existing function
        replaceSelectedTextWithFormatted(response.formattedText);
        
        showNotification("Text formatted successfully!", "info");
      } catch (error) {
        console.error("Error during text replacement:", error);
        showNotification("Failed to replace text", "error");
      }
    } else {
      console.warn("No formatted text received or no target element");
      showNotification("No formatted text received", "error");
    }

    closeKeyboardModal();
  });
}

/**
 * Replace selected text with formatted text (for keyboard modal)
 */
function replaceSelectedTextWithFormatted(newText) {
  if (!modalTargetElement) {
    console.error('No target element for text replacement');
    return;
  }

  console.log('Replacing text in element:', modalTargetElement.tagName, modalTargetElement.contentEditable);
  console.log('Selected text to replace:', modalSelectedText);
  console.log('New formatted text:', newText);

  try {
    // Focus the element first
    modalTargetElement.focus();

    // Site-specific handling for better compatibility
    if (isChatGPT) {
      replaceTextForChatGPT(modalTargetElement, newText);
    } else if (isClaude) {
      replaceTextForClaude(modalTargetElement, newText);
    } else if (isPerplexity || isT3Chat) {
      replaceTextForPerplexity(modalTargetElement, newText, false);
    } else if (isGemini) {
      replaceTextForGemini(modalTargetElement, newText);
    } else {
      // Generic handling for other sites
      if (modalTargetElement.tagName.toLowerCase() === 'textarea' || 
          modalTargetElement.tagName.toLowerCase() === 'input') {
        
        // For textarea and input elements
        replaceTextInInputElement(modalTargetElement, newText);
        
      } else if (modalTargetElement.contentEditable === 'true') {
        
        // For contenteditable elements
        replaceTextInContentEditable(modalTargetElement, newText);
        
      } else {
        
        // Fallback for other elements
        console.warn('Unexpected element type, using fallback');
        fallbackTextReplacement(modalTargetElement, newText);
      }
    }

    // Trigger events to notify the page of changes
    const events = ['input', 'change', 'keyup', 'paste'];
    events.forEach(eventType => {
      modalTargetElement.dispatchEvent(new Event(eventType, { bubbles: true }));
    });

    // Additional React-compatible events
    if (isChatGPT || isClaude || isGemini) {
      // Trigger React synthetic events
      const inputEvent = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: newText
      });
      modalTargetElement.dispatchEvent(inputEvent);
      
      // Trigger composition events for better compatibility
      modalTargetElement.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      modalTargetElement.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: newText }));
    }

    // Special handling for React components
    if (modalTargetElement._valueTracker) {
      modalTargetElement._valueTracker.setValue('');
    }
    
    // Force React re-render by triggering additional events
    setTimeout(() => {
      modalTargetElement.dispatchEvent(new Event('blur', { bubbles: true }));
      modalTargetElement.dispatchEvent(new Event('focus', { bubbles: true }));
    }, 10);

  } catch (error) {
    console.error('Error replacing text from modal:', error);
    fallbackTextReplacement(modalTargetElement, newText);
  }
}

/**
 * Replace text in input/textarea elements
 */
function replaceTextInInputElement(element, newText) {
  console.log('Replacing text in input element');
  
  // Get current value and find the selected text
  const currentValue = element.value || '';
  const selectedTextIndex = currentValue.indexOf(modalSelectedText);
  
  if (selectedTextIndex !== -1) {
    // Replace the specific selected text
    const beforeText = currentValue.substring(0, selectedTextIndex);
    const afterText = currentValue.substring(selectedTextIndex + modalSelectedText.length);
    element.value = beforeText + newText + afterText;
    
    // Set cursor position after the new text
    const newCursorPosition = selectedTextIndex + newText.length;
    element.setSelectionRange(newCursorPosition, newCursorPosition);
    
    console.log('Text replaced in input element');
  } else {
    // Fallback: replace all content if we can't find the selected text
    console.warn('Could not find selected text in input, replacing all content');
    element.value = newText;
    element.setSelectionRange(newText.length, newText.length);
  }
}

/**
 * Replace text in contenteditable elements
 */
function replaceTextInContentEditable(element, newText) {
  console.log('Replacing text in contenteditable element');
  
  // Try to select the original text first
  if (selectTextInContentEditable(element, modalSelectedText)) {
    // If we successfully selected the text, replace it
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Insert new text with proper line breaks
      const lines = newText.split('\n');
      const fragment = document.createDocumentFragment();
      
      lines.forEach((line, index) => {
        if (line.length > 0) {
          fragment.appendChild(document.createTextNode(line));
        }
        if (index < lines.length - 1) {
          fragment.appendChild(document.createElement('br'));
        }
      });
      
      range.insertNode(fragment);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('Text replaced in contenteditable element');
    }
  } else {
    // Fallback: replace all content
    console.warn('Could not find selected text in contenteditable, replacing all content');
    element.innerHTML = '';
    element.textContent = newText;
  }
}

/**
 * Try to select specific text in a contenteditable element
 */
function selectTextInContentEditable(element, textToSelect) {
  const selection = window.getSelection();
  const range = document.createRange();
  
  // Walk through all text nodes to find the matching text
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let textContent = '';
  let textNodes = [];
  let node;
  
  while (node = walker.nextNode()) {
    textNodes.push({
      node: node,
      startOffset: textContent.length,
      endOffset: textContent.length + node.textContent.length
    });
    textContent += node.textContent;
  }
  
  const textIndex = textContent.indexOf(textToSelect);
  if (textIndex === -1) {
    return false;
  }
  
  // Find which text nodes contain our target text
  const startIndex = textIndex;
  const endIndex = textIndex + textToSelect.length;
  
  let startNode = null, startOffset = 0;
  let endNode = null, endOffset = 0;
  
  for (const nodeInfo of textNodes) {
    if (startNode === null && startIndex >= nodeInfo.startOffset && startIndex <= nodeInfo.endOffset) {
      startNode = nodeInfo.node;
      startOffset = startIndex - nodeInfo.startOffset;
    }
    
    if (endIndex >= nodeInfo.startOffset && endIndex <= nodeInfo.endOffset) {
      endNode = nodeInfo.node;
      endOffset = endIndex - nodeInfo.startOffset;
      break;
    }
  }
  
  if (startNode && endNode) {
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (error) {
      console.error('Error selecting text in contenteditable:', error);
      return false;
    }
  }
  
  return false;
}

/**
 * Site-specific text replacement for ChatGPT
 */
function replaceTextForChatGPT(element, newText) {
  console.log('Using ChatGPT-specific text replacement');
  
  if (element.contentEditable === 'true') {
    // ChatGPT uses contenteditable divs
    try {
      // Method 1: Try to use execCommand for better React compatibility
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        // Clear current selection and select all text in the element
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Use execCommand to replace
        document.execCommand('insertText', false, newText);
        
        console.log('ChatGPT text replaced using execCommand');
        return;
      }
    } catch (error) {
      console.warn('execCommand failed, trying direct replacement');
    }
    
    // Method 2: Direct content replacement
    element.innerHTML = '';
    element.textContent = newText;
    
    // Set cursor at end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
  } else {
    // Fallback for other element types
    replaceTextInInputElement(element, newText);
  }
}

/**
 * Site-specific text replacement for Claude.ai
 */
function replaceTextForClaude(element, newText) {
  console.log('Using Claude-specific text replacement');
  
  if (element.contentEditable === 'true') {
    // Claude.ai uses contenteditable with specific structure
    try {
      // Clear the element content
      element.innerHTML = '';
      
      // Add the new text, preserving line breaks
      const lines = newText.split('\n');
      const fragment = document.createDocumentFragment();
      
      lines.forEach((line, index) => {
        if (line.length > 0) {
          const div = document.createElement('div');
          div.textContent = line;
          fragment.appendChild(div);
        } else {
          // Empty line
          const div = document.createElement('div');
          div.innerHTML = '<br>';
          fragment.appendChild(div);
        }
      });
      
      element.appendChild(fragment);
      
      // Set cursor at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('Claude text replaced successfully');
    } catch (error) {
      console.error('Claude-specific replacement failed:', error);
      replaceTextInContentEditable(element, newText);
    }
  } else {
    replaceTextInInputElement(element, newText);
  }
}

/**
 * Site-specific text replacement for Gemini
 */
function replaceTextForGemini(element, newText) {
  console.log('Using Gemini-specific text replacement');
  
  if (element.contentEditable === 'true') {
    // Gemini uses contenteditable elements
    try {
      // Select all content and replace
      element.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, newText);
      
      console.log('Gemini text replaced using execCommand');
    } catch (error) {
      console.warn('Gemini execCommand failed, using fallback');
      replaceTextInContentEditable(element, newText);
    }
  } else {
    replaceTextInInputElement(element, newText);
  }
}

/**
 * Show loading state in modal
 */
function showLoadingState() {
  if (!keyboardModal) return;
  
  const templateList = keyboardModal.querySelector('.prompter-template-list');
  if (templateList) {
    templateList.innerHTML = '<div class="prompter-empty">Formatting text...</div>';
  }
}

/**
 * Position the modal on screen
 */
function positionModal() {
  // For now, center the modal. Later we can add smart positioning near selected text
  if (keyboardModal) {
    keyboardModal.style.display = 'flex';
    keyboardModal.style.alignItems = 'center';
    keyboardModal.style.justifyContent = 'center';
  }
}

/**
 * Close the keyboard modal
 */
function closeKeyboardModal() {
  if (keyboardModal) {
    keyboardModal.remove();
    keyboardModal = null;
  }
  
  // Reset state
  currentSelectedIndex = 0;
  filteredTemplates = [];
  allTemplates = [];
  modalSelectedText = "";
  modalTargetElement = null;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
// Content script - runs on web pages
import insertTextAtCursor from 'insert-text-at-cursor';

// Extension loaded

let selectedText = "";
let targetElement = null;
let selectionRange = null;

// Check if we're on perplexity.ai or t3.chat
const isPerplexity = window.location.hostname === 'www.perplexity.ai';
const isT3Chat = window.location.hostname === 't3.chat' || window.location.hostname === 'www.t3.chat';

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
    background-color: ${type === "error" ? "#f44336" : "#2196F3"};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}
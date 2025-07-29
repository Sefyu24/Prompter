// Content script - runs on web pages
import insertTextAtCursor from 'insert-text-at-cursor';

console.log("JSON Formatter extension loaded");

let selectedText = "";
let targetElement = null;

// Listen for text selection
document.addEventListener("mouseup", function (e) {
  const selection = window.getSelection();
  selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    // Store the element that contains the selection
    targetElement = selection.anchorNode.parentElement;

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
});

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
  if (message.action === "replaceText") {
    replaceSelectedText(message.newText);
  } else if (message.action === "showLoading") {
    showNotification("Formatting text...", "info");
  } else if (message.action === "showError") {
    showNotification(message.message, "error");
  }
});

/**
 * Replace selected text with formatted text using insert-text-at-cursor library
 * This handles all input types: textarea, input, contenteditable, etc.
 * @param {string} newText - The formatted text to insert
 */
function replaceSelectedText(newText) {
  const selection = window.getSelection();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const editableElement = findEditableParent(container);

    if (editableElement) {
      try {
        // Focus the element first to ensure proper insertion
        editableElement.focus();
        
        // Handle contenteditable elements differently than textarea/input
        if (editableElement.contentEditable === 'true') {
          // For contenteditable, we need to handle newlines properly
          insertTextIntoContentEditable(editableElement, newText);
        } else {
          // For textarea/input, use the library directly
          insertTextAtCursor(editableElement, newText);
        }
        
        // Trigger input event to notify the page of changes
        editableElement.dispatchEvent(new Event("input", { bubbles: true }));
        editableElement.dispatchEvent(new Event("change", { bubbles: true }));
        
      } catch (error) {
        console.error('Error inserting text:', error);
        // Fallback to manual replacement if library fails
        fallbackTextReplacement(editableElement, newText);
      }
    }
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
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const text = element.value;

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
    }
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
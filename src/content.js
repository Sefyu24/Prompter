// Content script - runs on web pages
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

// Function to replace selected text with formatted JSON
function replaceSelectedText(newText) {
  const selection = window.getSelection();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);

    // Check if we're in a contenteditable element
    const container = range.commonAncestorContainer;
    const editableElement = findEditableParent(container);

    if (editableElement) {
      if (
        editableElement.tagName.toLowerCase() === "textarea" ||
        editableElement.tagName.toLowerCase() === "input"
      ) {
        // Handle textarea/input
        const start = editableElement.selectionStart;
        const end = editableElement.selectionEnd;
        const text = editableElement.value;

        editableElement.value =
          text.substring(0, start) + newText + text.substring(end);
        editableElement.selectionStart = start;
        editableElement.selectionEnd = start + newText.length;
      } else {
        // Handle contenteditable div
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        selection.removeAllRanges();
      }

      // Trigger input event to notify the page of changes
      editableElement.dispatchEvent(new Event("input", { bubbles: true }));
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
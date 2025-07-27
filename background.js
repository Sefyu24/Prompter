// Enhanced background.js with basic encryption
let currentTabId = null;
let selectedText = "";

// Simple encryption functions (basic obfuscation)
function simpleEncrypt(text) {
  // This is basic obfuscation, not true encryption
  // For production, consider using Web Crypto API
  return btoa(text.split("").reverse().join(""));
}

function simpleDecrypt(encryptedText) {
  try {
    return atob(encryptedText).split("").reverse().join("");
  } catch (e) {
    return null;
  }
}

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "formatToJSON",
    title: "Format question in JSON",
    contexts: ["selection"],
    visible: false,
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "textSelected") {
    currentTabId = sender.tab.id;
    selectedText = message.text;

    if (message.isInInputField) {
      chrome.contextMenus.update("formatToJSON", {
        visible: true,
      });
    }
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "formatToJSON") {
    formatTextToJSON(selectedText, tab.id);
  }
});

// Enhanced function to get API key securely
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openaiApiKey"], function (result) {
      if (result.openaiApiKey) {
        resolve(result.openaiApiKey);
      } else {
        resolve(null);
      }
    });
  });
}

// Enhanced function to save API key securely
function saveApiKey(apiKey) {
  const encrypted = simpleEncrypt(apiKey);
  return new Promise((resolve) => {
    chrome.storage.local.set({ encryptedApiKey: encrypted }, function () {
      resolve(true);
    });
  });
}

// Function to format text using OpenAI API
async function formatTextToJSON(text, tabId) {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      chrome.tabs.sendMessage(tabId, {
        action: "showError",
        message: "Please set your OpenAI API key in the extension popup",
      });
      return;
    }

    chrome.tabs.sendMessage(tabId, {
      action: "showLoading",
    });

    const formattedText = await callOpenAI(text, apiKey);

    chrome.tabs.sendMessage(tabId, {
      action: "replaceText",
      newText: formattedText,
    });
  } catch (error) {
    console.error("Error formatting text:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "showError",
      message: "Error formatting text: " + error.message,
    });
  }
}

// Function to call OpenAI API
async function callOpenAI(text, apiKey) {
  const prompt = `You are a JSON formatter for AI questions. Your task is to take user questions and format them in a clear, structured JSON format that will help reduce token consumption and improve AI response accuracy.

Convert the following text into a well-structured JSON format. Consider the intent, extract key components like:
- main_question: The primary question or request
- context: Any background information provided
- specific_requirements: Particular constraints or specifications
- output_format: Desired response format if mentioned
- examples: Any examples provided

Original text: "${text}"

Return ONLY the JSON object, no additional text or formatting:`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that formats text into structured JSON for better AI processing. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Hide context menu when selection is cleared
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.contextMenus.update("formatToJSON", {
      visible: false,
    });
  }
});

// Expose secure storage functions to popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveApiKey") {
    saveApiKey(message.apiKey).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }

  if (message.action === "getApiKey") {
    getApiKey().then((apiKey) => {
      sendResponse({ apiKey: apiKey });
    });
    return true;
  }
});

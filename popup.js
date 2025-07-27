// Popup script for settings
document.addEventListener("DOMContentLoaded", function () {
  const apiKeyInput = document.getElementById("apiKey");
  const saveButton = document.getElementById("saveKey");
  const testButton = document.getElementById("testKey");
  const toggleButton = document.getElementById("toggleKey");
  const statusDiv = document.getElementById("status");

  // Load saved API key
  loadApiKey();

  // Save API key
  saveButton.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter an API key", "error");
      return;
    }

    // Save to Chrome storage
    chrome.storage.local.set({ openaiApiKey: apiKey }, function () {
      showStatus("API key saved successfully!", "success");
    });
  });

  // Test API key
  testButton.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus("Please enter an API key first", "error");
      return;
    }

    testApiKey(apiKey);
  });

  // Toggle API key visibility
  toggleButton.addEventListener("click", function () {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleButton.textContent = "Hide";
    } else {
      apiKeyInput.type = "password";
      toggleButton.textContent = "Show";
    }
  });

  // Load API key from storage
  function loadApiKey() {
    chrome.storage.local.get(["openaiApiKey"], function (result) {
      if (result.openaiApiKey) {
        apiKeyInput.value = result.openaiApiKey;
      }
    });
  }

  // Test API key function
  async function testApiKey(apiKey) {
    showStatus("Testing connection...", "loading");

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        showStatus("Connection successful!", "success");
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      showStatus("Connection failed: " + error.message, "error");
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    // Clear status after 3 seconds
    setTimeout(() => {
      statusDiv.textContent = "";
      statusDiv.className = "status";
    }, 3000);
  }
});

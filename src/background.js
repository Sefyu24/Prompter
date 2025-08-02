import { supabase } from "./supabase.js";
import stringify from "json-stringify-pretty-compact";
import { API_CONFIG, ENV_CONFIG, DEV_UTILS } from "./config.js";
import {
  getStoredAccessToken,
  checkAuthStatus,
  debugStorageContents,
} from "./chromeStorageAdapter.js";
import { cacheManager } from "./cacheManager.js";

// Context menu setup
let userTemplates = [];
let promptrTemplates = [];
let currentUser = null;

// Initialize context menu when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  DEV_UTILS.log("Extension installed/loaded");

  // Add delay to allow storage adapter to initialize properly
  setTimeout(async () => {
    await loadUserData(); // Load user data FIRST
    // Context menu will be created by loadUserData() if user is logged in
  }, 500);
});

// Listen for Supabase auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  DEV_UTILS.log("Supabase auth state changed:", event, "User:", session?.user?.email || "no user");

  if (event === "SIGNED_IN" && session) {
    DEV_UTILS.log("User signed in, reloading data for:", session.user?.email);
    try {
      await loadUserData();
      await updateContextMenu();
      DEV_UTILS.log("Post-signin data load completed");
    } catch (error) {
      console.error("Error during post-signin data load:", error);
    }
  } else if (event === "SIGNED_OUT") {
    DEV_UTILS.log("User signed out, clearing data");
    
    // Clear cache for the user before clearing currentUser
    if (currentUser?.id) {
      await cacheManager.invalidateUser(currentUser.id);
      DEV_UTILS.log("User cache cleared on sign out");
    }
    
    currentUser = null;
    userTemplates = [];
    promptrTemplates = [];

    // Debug: Check what's actually in storage after sign out
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      const debugData = await debugStorageContents();
      DEV_UTILS.log('Debug storage contents:', Object.keys(debugData));
    }
    await updateContextMenu();
  } else if (event === "TOKEN_REFRESHED" && session) {
    DEV_UTILS.log("Token refreshed for user:", session.user?.email);
    currentUser = session.user;
  } else {
    DEV_UTILS.log("Other auth event:", event);
  }
});

// Load user data on startup
chrome.runtime.onStartup.addListener(async () => {
  DEV_UTILS.log("Extension startup detected");

  // Add delay to ensure storage adapter is ready
  setTimeout(async () => {
    // Supabase will automatically restore session from storage adapter
    await loadUserData();
    await updateContextMenu();
  }, 500);
});

/**
 * Loads the current user's data and templates using Supabase automatic session management
 * @async
 * @returns {Promise<void>}
 */
async function loadUserData() {
  try {
    DEV_UTILS.log("Loading user data...");

    // Debug: First check what's in storage
    const hasAuth = await checkAuthStatus();
    DEV_UTILS.log("Auth status check result:", hasAuth);

    // Get stored access token directly
    let accessToken;
    try {
      accessToken = await getStoredAccessToken();
      DEV_UTILS.log("Access token retrieved successfully");
    } catch (tokenError) {
      DEV_UTILS.log("No access token found:", tokenError.message);
      // Debug: Show storage contents when token retrieval fails
      if (ENV_CONFIG.IS_DEVELOPMENT) {
        const debugData = await debugStorageContents();
        DEV_UTILS.log('Debug storage contents:', Object.keys(debugData));
      }
      currentUser = null;
      userTemplates = [];
      await createContextMenuWithTemplates();
      return;
    }

    // Load user's templates using cache manager with API fallback
    try {
      DEV_UTILS.log("Loading templates with cache...");

      // Get user info first
      try {
        DEV_UTILS.log("Getting user info...");
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("Could not get user info:", userError);
          currentUser = null;
        } else {
          currentUser = user;
          DEV_UTILS.log("Current user loaded:", user?.email || "no email");
          // Migrate old history format if needed
          await migrateOldHistory(user.id);
        }
      } catch (userInfoError) {
        console.error("Error getting user info:", userInfoError);
        currentUser = null;
      }

      const userId = currentUser?.id;
      const url = API_CONFIG.getUrl("TEMPLATES");
      const headers = API_CONFIG.getHeaders(accessToken);

      // Use cache manager for conditional fetching
      const { data: templates, fromCache } = await cacheManager.fetchWithCache(
        url,
        { method: "GET", headers },
        "templates",
        userId
      );

      DEV_UTILS.log(
        `User templates loaded ${fromCache ? 'FROM CACHE' : 'FROM API'}:`,
        templates?.length || 0
      );

      if (templates && templates.length > 0) {
        DEV_UTILS.log("User template names:", templates.map(t => t.name));
      } else {
        DEV_UTILS.log("No user templates returned from API/cache");
      }

      // Add source metadata to user templates for consistency
      userTemplates = (templates || []).map((template) => ({
        ...template,
        source: "user",
        ispromptrTemplate: false,
      }));

      // Load promptrTemplates after user templates are loaded
      await loadpromptrTemplates();
    } catch (error) {
      console.error("Error loading user templates:", error);

      // Handle authentication errors differently for user vs promptr templates
      if (error.message.includes("No authentication session found") || 
          error.message.includes("401")) {
        // Only 401 (unauthorized) should clear everything, not 403 (forbidden)
        DEV_UTILS.log("Authentication failed, clearing user data");
        currentUser = null;
        userTemplates = [];
        await createContextMenuWithTemplates();
        return;
      }

      // For 403 (forbidden) or other errors, user templates fail but try promptr templates
      DEV_UTILS.log("User templates failed (probably free tier), trying promptr templates");
      userTemplates = [];

      // Always try to load promptrTemplates, even if user templates failed
      try {
        await loadpromptrTemplates();
      } catch (promptrError) {
        console.error("Promptr templates also failed:", promptrError);
      }
    }

    DEV_UTILS.log(
      "Final template counts - User:",
      userTemplates.length,
      "Promptr:",
      promptrTemplates.length
    );

    // Update context menu after loading templates
    await updateContextMenu();
  } catch (error) {
    console.error("Error loading user data:", error);
    // Fallback: create context menu without templates
    userTemplates = [];
    currentUser = null;
    await createContextMenuWithTemplates();
  }
}

/**
 * Loads promptrTemplates from API
 * @returns {Promise<void>}
 */
async function loadpromptrTemplates() {
  try {
    DEV_UTILS.log("Loading promptrTemplates with cache...");

    const accessToken = await getStoredAccessToken();
    if (!accessToken) {
      DEV_UTILS.log("No access token for promptrTemplates");
      promptrTemplates = [];
      return;
    }

    DEV_UTILS.log("Access token available for promptrTemplates");
    DEV_UTILS.log("Current user for promptrTemplates:", currentUser?.email || "no user");

    const userId = currentUser?.id;
    const url = API_CONFIG.getUrl("PROMPTR_TEMPLATES");
    const headers = API_CONFIG.getHeaders(accessToken);

    DEV_UTILS.log("Making promptrTemplates request to:", url);
    DEV_UTILS.log("Request headers:", {
      ...headers,
      Authorization: headers.Authorization ? `Bearer [${headers.Authorization.substring(7, 20)}...]` : "none"
    });

    // Use cache manager for conditional fetching
    const { data: templates, fromCache } = await cacheManager.fetchWithCache(
      url,
      { method: "GET", headers },
      "promptr_templates",
      userId
    );

    DEV_UTILS.log(
      `PromptrTemplates loaded ${fromCache ? 'FROM CACHE' : 'FROM API'}:`,
      templates?.length || 0
    );

    if (templates && templates.length > 0) {
      DEV_UTILS.log("PromptrTemplate names:", templates.map(t => t.name));
      DEV_UTILS.log("PromptrTemplate IDs:", templates.map(t => t.id));
    } else {
      DEV_UTILS.log("No promptrTemplates returned from API/cache");
    }

    // Add source metadata to each template
    promptrTemplates = (templates || []).map((template) => ({
      ...template,
      source: "promptr",
      ispromptrTemplate: true,
    }));

    DEV_UTILS.log(
      "promptrTemplates after assignment:",
      promptrTemplates.length
    );
  } catch (error) {
    console.error("Error loading promptrTemplates:", error);
    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack?.substring(0, 200)
      });
    }
    promptrTemplates = [];
  }
}

/**
 * Gets all templates (user + promptr) merged with proper ordering
 * @returns {Array} Merged templates array
 */
function getAllTemplates() {
  const merged = [
    ...userTemplates, // User templates first
    ...promptrTemplates, // promptrTemplates second
  ];

  DEV_UTILS.log(
    "getAllTemplates() - User:",
    userTemplates.length,
    "Promptr:",
    promptrTemplates.length,
    "Total:",
    merged.length
  );
  return merged;
}

/**
 * Creates the simplified context menu with just the extension option
 * @returns {Promise<void>}
 */
async function createContextMenuWithTemplates() {
  return new Promise((resolve) => {
    // First, remove all existing menus
    chrome.contextMenus.removeAll(() => {
      // Create single menu item that opens the modal
      chrome.contextMenus.create(
        {
          id: "prompter-format",
          title: "Promptr",
          contexts: ["selection"],
        },
        resolve
      );
    });
  });
}

/**
 * Creates the base context menu item for the extension
 * @deprecated Use createContextMenuWithTemplates instead
 * @returns {void}
 */
function createContextMenu() {
  createContextMenuWithTemplates();
}

/**
 * Updates the context menu with user's templates as submenu items
 * @async
 * @returns {Promise<void>}
 */
async function updateContextMenu() {
  await createContextMenuWithTemplates();
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "prompter-format") {
    DEV_UTILS.log("Context menu clicked - opening modal");
    DEV_UTILS.log("Current user:", currentUser?.email || "Not logged in");
    const allTemplates = getAllTemplates();
    DEV_UTILS.log("Available templates:", allTemplates.length);

    try {
      // Check if we have a stored access token
      await getStoredAccessToken();
    } catch (error) {
      DEV_UTILS.log("No access token found, cannot show modal");
      chrome.tabs.sendMessage(tab.id, {
        action: "showKeyboardModal",
        error: "You need to be authenticated first",
      });
      return;
    }

    // If templates appear to not be loaded, try reloading
    if (allTemplates.length === 0) {
      DEV_UTILS.log("Templates appear empty, attempting to reload...");
      try {
        await loadUserData();
        const reloadedTemplates = getAllTemplates();
        DEV_UTILS.log("Templates reloaded, count:", reloadedTemplates.length);
      } catch (error) {
        console.error("Failed to reload templates:", error);
      }

      // Check again after reload
      const finalTemplates = getAllTemplates();
      if (finalTemplates.length === 0) {
        DEV_UTILS.log("No templates available after reload");
        chrome.tabs.sendMessage(tab.id, {
          action: "showKeyboardModal",
          error: "No templates available. Please create templates first.",
        });
        return;
      }
    }

    const finalAllTemplates = getAllTemplates();
    DEV_UTILS.log(
      "Sending modal with templates:",
      finalAllTemplates.map((t) => t.name)
    );

    // Send templates to content script to show modal
    chrome.tabs.sendMessage(tab.id, {
      action: "showKeyboardModal",
      templates: finalAllTemplates,
      user: currentUser,
    });
  }
});

/**
 * Formats the selected text using the backend API
 * @async
 * @param {string} text - The text to format
 * @param {Object} template - The template object containing id
 * @param {Object} user - The current user object
 * @returns {Promise<string>} The formatted text
 */
async function formatTextWithTemplate(text, template, user) {
  try {
    // Get stored access token directly (no session validation needed)
    const accessToken = await getStoredAccessToken();

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      API_CONFIG.REQUEST_TIMEOUT
    );

    // Call your backend API with timeout
    const response = await fetch(API_CONFIG.getUrl("FORMAT"), {
      method: "POST",
      headers: API_CONFIG.getHeaders(accessToken),
      body: JSON.stringify({
        templateId: template.id,
        userText: text,
      }),
      signal: controller.signal,
    });

    // Clear the timeout since the request completed
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Backend API error: ${response.status} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    let formattedText = data.formattedText;

    // Apply type-specific formatting based on template type
    try {
      const templateType =
        template.templateType || template.template_type || "json";
      if (templateType === "json") {
        // Format JSON templates with pretty printing
        if (
          (formattedText.startsWith("{") && formattedText.endsWith("}")) ||
          (formattedText.startsWith("[") && formattedText.endsWith("]"))
        ) {
          const jsonObject = JSON.parse(formattedText);
          formattedText = stringify(jsonObject, {
            maxLength: 80,
            indent: 2,
          });
          DEV_UTILS.log("JSON formatted successfully");
        }
      } else if (templateType === "xml") {
        // Basic XML formatting - add proper indentation if needed
        if (formattedText.includes("<") && formattedText.includes(">")) {
          // Simple XML formatting - just ensure it's readable
          formattedText = formattedText
            .replace(/></g, ">\n<")
            .replace(/^\s+|\s+$/g, "");
          DEV_UTILS.log("XML formatted successfully");
        }
      } else if (templateType === "markdown") {
        // Markdown doesn't need special formatting, keep as-is
        DEV_UTILS.log("Markdown template - no additional formatting needed");
      }
    } catch (formatError) {
      DEV_UTILS.log(
        "Format-specific processing failed, returning as-is:",
        formatError
      );
    }

    return formattedText;
  } catch (error) {
    console.error("Error calling backend API:", error);

    if (error.name === "AbortError") {
      throw new Error(
        `Request timed out after ${
          API_CONFIG.REQUEST_TIMEOUT / 1000
        } seconds. Please try again.`
      );
    }

    // Re-throw the error to be handled by the caller
    throw error;
  }
}

/**
 * Tracks a formatting request in the database for analytics
 * @async
 * @param {string} userId - The user's ID
 * @param {string} templateId - The template's ID
 * @param {string} inputText - The original text
 * @param {string} outputText - The formatted text
 * @returns {Promise<void>}
 */
async function trackFormattingRequest(
  userId,
  templateId,
  inputText,
  outputText
) {
  try {
    const { error } = await supabase.from("formatting_requests").insert({
      user_id: userId,
      template_id: templateId,
      input_text: inputText,
      output_text: outputText,
    });

    if (error) throw error;
    DEV_UTILS.log("Tracked formatting request");
  } catch (error) {
    console.error("Error tracking request:", error);
  }
}

/**
 * Saves a formatting request to local history for quick access
 * @async
 * @param {string} templateId - The template's ID
 * @param {string} templateName - The template's name
 * @param {string} inputText - The original text
 * @param {string} outputText - The formatted text
 * @param {string} domain - The domain where it was used
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
async function saveToHistory(
  templateId,
  templateName,
  inputText,
  outputText,
  domain,
  userId
) {
  try {
    if (!userId) {
      console.warn("Cannot save history: No user ID provided");
      return;
    }

    const timestamp = Date.now();
    const historyItem = {
      id: timestamp,
      inputText: inputText,
      outputText: outputText,
      templateName: templateName,
      templateId: templateId,
      timestamp: timestamp,
      domain: domain,
      userId: userId,
    };

    // Use user-specific storage key
    const historyKey = `formatting_history_${userId}`;

    // Get existing history for this user
    const result = await chrome.storage.local.get([historyKey]);
    const existingHistory = result[historyKey] || [];

    // Add new item to the beginning
    const updatedHistory = [historyItem, ...existingHistory];

    // Limit to 50 items
    const limitedHistory = updatedHistory.slice(0, 50);

    // Save back to storage with user-specific key
    await chrome.storage.local.set({ [historyKey]: limitedHistory });

    DEV_UTILS.log(
      "Saved to user history:",
      historyItem.templateName,
      "for user:",
      userId
    );
  } catch (error) {
    console.error("Error saving to history:", error);
  }
}

/**
 * Clears the formatting history from local storage for a specific user
 * @async
 * @param {string} userId - The user's ID (optional, uses current user if not provided)
 * @returns {Promise<void>}
 */
async function clearHistory(userId = null) {
  try {
    const targetUserId = userId || currentUser?.id;
    if (!targetUserId) {
      console.warn("Cannot clear history: No user ID provided");
      return;
    }

    const historyKey = `formatting_history_${targetUserId}`;
    await chrome.storage.local.remove([historyKey]);
    DEV_UTILS.log("History cleared for user:", targetUserId);
  } catch (error) {
    console.error("Error clearing history:", error);
  }
}

/**
 * Gets the formatting history for a specific user
 * @async
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} The user's formatting history
 */
async function getUserHistory(userId) {
  try {
    if (!userId) {
      console.warn("Cannot get history: No user ID provided");
      return [];
    }

    const historyKey = `formatting_history_${userId}`;
    const result = await chrome.storage.local.get([historyKey]);
    return result[historyKey] || [];
  } catch (error) {
    console.error("Error getting user history:", error);
    return [];
  }
}

/**
 * Migrates old formatting_history to user-specific format
 * @async
 * @param {string} userId - The current user's ID
 * @returns {Promise<void>}
 */
async function migrateOldHistory(userId) {
  try {
    if (!userId) return;

    // Check if old history exists
    const { formatting_history: oldHistory } = await chrome.storage.local.get([
      "formatting_history",
    ]);
    if (!oldHistory || oldHistory.length === 0) return;

    DEV_UTILS.log(
      "Migrating old history to user-specific format for user:",
      userId
    );

    // Check if user already has history (don't overwrite)
    const userHistoryKey = `formatting_history_${userId}`;
    const { [userHistoryKey]: existingUserHistory } =
      await chrome.storage.local.get([userHistoryKey]);

    if (existingUserHistory && existingUserHistory.length > 0) {
      DEV_UTILS.log("User already has history, skipping migration");
      // Remove old history since it's no longer needed
      await chrome.storage.local.remove(["formatting_history"]);
      return;
    }

    // Migrate old history to user-specific key
    const migratedHistory = oldHistory.map((item) => ({
      ...item,
      userId: userId, // Add userId to existing items
    }));

    // Save to user-specific key
    await chrome.storage.local.set({ [userHistoryKey]: migratedHistory });

    // Remove old history
    await chrome.storage.local.remove(["formatting_history"]);

    DEV_UTILS.log(
      `Migrated ${migratedHistory.length} history items for user:`,
      userId
    );
  } catch (error) {
    console.error("Error migrating old history:", error);
  }
}

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "format-prompt") {
    DEV_UTILS.log("Format prompt command triggered");
    DEV_UTILS.log("Current user:", currentUser?.email || "Not logged in");
    const allTemplates = getAllTemplates();
    DEV_UTILS.log("Available templates:", allTemplates.length);

    try {
      // Check if we have a stored access token
      await getStoredAccessToken();
    } catch (error) {
      DEV_UTILS.log("No access token found, cannot show modal");
      chrome.tabs.sendMessage(tab.id, {
        action: "showKeyboardModal",
        error: "You need to be authenticated first",
      });
      return;
    }

    // Debug: Log the state before checking templates
    DEV_UTILS.log("Before template check - allTemplates:", allTemplates.length);
    DEV_UTILS.log(
      "allTemplates array:",
      allTemplates.map((t) => `${t.name} (${t.source})`) || "empty"
    );

    // If templates appear to not be loaded, this might be a race condition
    if (allTemplates.length === 0) {
      DEV_UTILS.log(
        "Templates appear empty - this shouldn't happen if extension loaded correctly"
      );
      DEV_UTILS.log("Skipping template reload to avoid 401 error");
      // Don't call loadUserData() here as it causes 401 error
    }

    // Check if user has templates after loading
    if (allTemplates.length === 0) {
      DEV_UTILS.log(
        "Templates missing, attempting to reload for user:",
        currentUser?.email
      );

      // Try to reload templates first
      try {
        await loadUserData();
        const reloadedTemplates = getAllTemplates();
        DEV_UTILS.log("Templates reloaded, count:", reloadedTemplates.length);
      } catch (error) {
        console.error("Failed to reload templates:", error);
      }

      // Check again after reload
      const finalTemplates = getAllTemplates();
      if (finalTemplates.length === 0) {
        DEV_UTILS.log(
          "No templates available after reload for user:",
          currentUser?.email
        );
        chrome.tabs.sendMessage(tab.id, {
          action: "showKeyboardModal",
          error: "No templates available. Please create templates first.",
        });
        return;
      }
    }

    const finalAllTemplates = getAllTemplates();
    DEV_UTILS.log(
      "Sending modal with templates:",
      finalAllTemplates.map((t) => `${t.name} (${t.source})`)
    );

    if (ENV_CONFIG.IS_DEVELOPMENT) {
      console.log("DEBUGGING showKeyboardModal message:", {
        action: "showKeyboardModal",
        templatesCount: finalAllTemplates.length,
        userEmail: currentUser?.email,
        templateNames: finalAllTemplates.map((t) => `${t.name} (${t.source})`),
        hasTemplates: finalAllTemplates.length > 0,
        tabId: tab.id,
      });
    }

    // Send templates to content script to show modal
    chrome.tabs.sendMessage(tab.id, {
      action: "showKeyboardModal",
      templates: finalAllTemplates,
      user: currentUser,
    });
  }
});

// Handle messages from content script (including keyboard modal selections)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  DEV_UTILS.log("Background received message:", message.action || message.type);

  // Handle auth state changes from popup
  if (message.type === "AUTH_STATE_CHANGED") {
    DEV_UTILS.log(
      "Received auth state change from popup:",
      message.event
    );

    (async () => {
      try {
        if (message.event === "SIGNED_IN" && message.session) {
          DEV_UTILS.log("Processing sign-in from popup");
          // Wait a moment for Supabase to process the session
          setTimeout(async () => {
            await loadUserData();
            await updateContextMenu();
            DEV_UTILS.log("Auth sync from popup completed");
          }, 1000);
        } else if (message.event === "SIGNED_OUT") {
          DEV_UTILS.log("Processing sign-out from popup");
          
          // Clear cache for the user before clearing currentUser
          if (currentUser?.id) {
            await cacheManager.invalidateUser(currentUser.id);
            DEV_UTILS.log("User cache cleared on popup sign out");
          }
          
          currentUser = null;
          userTemplates = [];
          promptrTemplates = [];
          await updateContextMenu();
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error(
          "❌ Background: Error processing auth state change:",
          error
        );
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  }

  // Handle GET_TEMPLATES request from content script
  if (message.action === "GET_TEMPLATES") {
    DEV_UTILS.log("Handling GET_TEMPLATES request - fetching fresh templates");
    
    (async () => {
      try {
        // Reload fresh templates from API - load both user and promptr templates
        await loadUserData(); // This loads user templates and calls loadpromptrTemplates()
        
        // Ensure promptr templates are also fresh by calling explicitly
        await loadpromptrTemplates();
        
        const allTemplates = getAllTemplates();
        DEV_UTILS.log(
          "Returning",
          allTemplates.length,
          "fresh templates to content script (User:",
          userTemplates.length,
          "Promptr:",
          promptrTemplates.length + ")"
        );
        sendResponse({
          success: true,
          templates: allTemplates,
        });
      } catch (error) {
        console.error("Error fetching fresh templates:", error);
        
        // Fallback to cached templates if API fails
        const fallbackTemplates = getAllTemplates();
        DEV_UTILS.log("Falling back to cached templates:", fallbackTemplates.length);
        
        sendResponse({
          success: true,
          templates: fallbackTemplates,
          warning: "Using cached templates - API fetch failed"
        });
      }
    })();
    
    return true; // Asynchronous response
  }

  if (message.action === "formatWithTemplate") {
    const { templateId, selectedText, requestId } = message;

    DEV_UTILS.log("Processing format request for template:", templateId);

    // Validate inputs
    if (!templateId || !selectedText) {
      console.error("Missing required parameters:", {
        templateId,
        selectedText,
      });
      try {
        sendResponse({ error: "Missing template ID or selected text" });
      } catch (e) {
        DEV_UTILS.log("Response channel already closed");
      }
      return true;
    }

    // Process the formatting asynchronously
    (async () => {
      try {
        // Get stored access token directly (let API validate authentication)
        const accessToken = await getStoredAccessToken();

        DEV_UTILS.log("Starting text formatting...");

        // Create a minimal template object for API call
        const template = { id: templateId };

        // Format the text using the existing function (API will validate template exists)
        const formattedText = await formatTextWithTemplate(
          selectedText,
          template,
          null // user parameter not needed anymore
        );

        DEV_UTILS.log("Text formatted successfully");

        // Try to save to history (gracefully fail if user info not available)
        try {
          const domain = new URL(sender.tab.url).hostname;
          if (currentUser?.id) {
            await trackFormattingRequest(
              currentUser.id,
              templateId,
              selectedText,
              formattedText
            );

            // Find template name for history (fallback to ID if not found)
            const allTemplates = getAllTemplates();
            const templateName =
              allTemplates.find((t) => t.id === templateId)?.name || templateId;

            await saveToHistory(
              templateId,
              templateName,
              selectedText,
              formattedText,
              domain,
              currentUser.id
            );
          }
        } catch (historyError) {
          console.warn("Could not save to history:", historyError);
          // Continue execution - history saving is not critical
        }

        DEV_UTILS.log("Sending formatted response");

        // Send the result directly to the content script instead of using sendResponse
        // This avoids Chrome's message timeout issues
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "formatComplete",
          formattedText: formattedText,
          originalTemplateId: templateId,
          requestId: requestId, // Include requestId for proper matching
        });

        // Still try to send response in case the content script is waiting
        try {
          sendResponse({ formattedText });
        } catch (e) {
          DEV_UTILS.log(
            "Response channel already closed, but formatting completed via direct message"
          );
        }
      } catch (error) {
        console.error("Error formatting text from keyboard modal:", error);
        const errorMessage = error.message || "Failed to format text";

        // Send error directly to content script
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "formatError",
          error: errorMessage,
          originalTemplateId: templateId,
          requestId: requestId, // Include requestId for proper matching
        });

        try {
          sendResponse({ error: errorMessage });
        } catch (e) {
          DEV_UTILS.log(
            "Response channel already closed, but error sent via direct message"
          );
        }
      }
    })();

    return true; // Keep message channel open for async response
  }

  // For unknown messages, respond immediately
  try {
    sendResponse({ received: true });
  } catch (e) {
    DEV_UTILS.log("Response channel already closed");
  }
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    DEV_UTILS.log("Tab updated:", changeInfo.url);
  }

  // Check for auth success page with tokens in hash
  if (
    changeInfo.url?.includes("/auth/success#access_token=") ||
    changeInfo.url?.startsWith(
      `${API_CONFIG.WEBSITE_URL}/auth/success#access_token=`
    )
  ) {
    DEV_UTILS.log("OAuth callback detected on success page!");
    finishUserOAuth(changeInfo.url);
  }

  // Keep existing checks as fallback
  if (
    changeInfo.url?.startsWith(chrome.identity.getRedirectURL()) ||
    changeInfo.url?.startsWith(`${API_CONFIG.WEBSITE_URL}/#access_token=`)
  ) {
    DEV_UTILS.log("OAuth callback detected!");
    finishUserOAuth(changeInfo.url);
  }
});

/**
 * Method used to finish OAuth callback for a user authentication.
 */
async function finishUserOAuth(url) {
  try {
    DEV_UTILS.log(`handling user OAuth callback for URL: ${url}`);

    // extract tokens from hash
    const hashMap = parseUrlHash(url);
    const access_token = hashMap.get("access_token");
    const refresh_token = hashMap.get("refresh_token");
    DEV_UTILS.log("Extracted tokens:", {
      access_token: !!access_token,
      refresh_token: !!refresh_token,
    });

    if (!access_token || !refresh_token) {
      throw new Error(`no OAuth tokens found in URL hash`);
    }

    // Simply store the Supabase tokens directly - no need for custom endpoint
    DEV_UTILS.log("Storing Supabase session directly...");

    // We need to get user info from the token
    // The token is a JWT, we can decode it to get basic info
    const tokenPayload = JSON.parse(atob(access_token.split(".")[1]));

    // Store session data directly in Chrome storage using the same format as Supabase adapter
    const storageKey = "sb-audlasqcnqqtfednxmdo-auth-token";
    const sessionToStore = {
      access_token,
      refresh_token,
      user: {
        id: tokenPayload.sub,
        email: tokenPayload.email,
        user_metadata: tokenPayload.user_metadata || {},
      },
      expires_at: tokenPayload.exp * 1000, // Convert to milliseconds
    };

    await chrome.storage.local.set({
      [storageKey]: JSON.stringify(sessionToStore),
    });

    DEV_UTILS.log("Supabase session stored in Chrome storage successfully");
    DEV_UTILS.log("User authenticated:", tokenPayload.email);

    // Verify session is actually stored
    try {
      const testToken = await getStoredAccessToken();
      DEV_UTILS.log("Session verified - token accessible:", !!testToken);
    } catch (e) {
      console.warn("Session verification failed:", e.message);
    }

    // Trigger a manual load to ensure data is available
    DEV_UTILS.log("Manually triggering loadUserData after OAuth...");
    try {
      await loadUserData();
      DEV_UTILS.log("Manual post-OAuth data load completed");
    } catch (error) {
      console.error("Manual post-OAuth data load failed:", error);
    }

    // Close the OAuth tab instead of redirecting
    const tabs = await chrome.tabs.query({ url: url });
    if (tabs.length > 0) {
      await chrome.tabs.remove(tabs[0].id);
    }

    DEV_UTILS.log(`finished handling user OAuth callback`);
  } catch (error) {
    console.error("OAuth callback error:", error);
  }
}

/**
 * Helper method used to parse the hash of a redirect URL.
 */
function parseUrlHash(url) {
  const hashParts = new URL(url).hash.slice(1).split("&");
  const hashMap = new Map(
    hashParts.map((part) => {
      const [name, value] = part.split("=");
      return [name, value];
    })
  );

  return hashMap;
}

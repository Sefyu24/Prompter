import { supabase } from "./supabase.js";
import { config } from "./config.js";
import stringify from "json-stringify-pretty-compact";

// Context menu setup
let userTemplates = [];
let currentUser = null;

// Initialize context menu when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Extension installed/loaded");
  await loadUserData(); // Load user data FIRST
  // Context menu will be created by loadUserData() if user is logged in
});

// Listen for user session changes
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === "local" && changes.session) {
    if (changes.session.newValue) {
      await loadUserData();
      await updateContextMenu();
    } else {
      // User logged out
      currentUser = null;
      userTemplates = [];
      updateContextMenu();
    }
  }
});

// Load user data on startup
chrome.runtime.onStartup.addListener(async () => {
  const { session } = await chrome.storage.local.get(["session"]);
  if (session) {
    await loadUserData();
    await updateContextMenu();
  }
});

/**
 * Loads the current user's data and templates from Supabase
 * @async
 * @returns {Promise<void>}
 */
async function loadUserData() {
  try {
    console.log("Loading user data...");
    const { session } = await chrome.storage.local.get(["session"]);

    if (!session) {
      console.log("No session found, creating context menu without templates");
      // Create context menu without templates if user not logged in
      await createContextMenuWithTemplates();
      return;
    }

    console.log("Session found, restoring user session");
    // Set the session in Supabase
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;

    currentUser = user;
    console.log("Current user:", user.email);

    // Load user's templates
    const { data: templates, error: templatesError } = await supabase
      .from("templates")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (templatesError) throw templatesError;

    userTemplates = templates || [];
    console.log("Loaded templates:", userTemplates.length, "templates");

    // Migrate old history format if needed
    await migrateOldHistory(user.id);

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
 * Creates the complete context menu with templates
 * @returns {Promise<void>}
 */
async function createContextMenuWithTemplates() {
  return new Promise((resolve) => {
    // First, remove all existing menus
    chrome.contextMenus.removeAll(() => {
      // Create parent menu item
      chrome.contextMenus.create(
        {
          id: "prompter-format",
          title: "Format prompt with Prompter",
          contexts: ["selection"],
        },
        () => {
          // Parent created, now add children
          if (userTemplates.length > 0) {
            // Add separator
            chrome.contextMenus.create({
              id: "prompter-separator",
              type: "separator",
              parentId: "prompter-format",
              contexts: ["selection"],
            });

            // Track templates added
            let templatesAdded = 0;

            // Add template options
            userTemplates.forEach((template) => {
              chrome.contextMenus.create(
                {
                  id: `template-${template.id}`,
                  title: template.name,
                  parentId: "prompter-format",
                  contexts: ["selection"],
                },
                () => {
                  templatesAdded++;
                  // Resolve when all templates are added
                  if (templatesAdded === userTemplates.length) {
                    resolve();
                  }
                }
              );
            });
          } else {
            // No templates message
            chrome.contextMenus.create(
              {
                id: "no-templates",
                title: "No templates available",
                parentId: "prompter-format",
                contexts: ["selection"],
                enabled: false,
              },
              resolve
            );
          }
        }
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
  if (info.menuItemId.startsWith("template-")) {
    const templateId = info.menuItemId.replace("template-", "");
    const selectedText = info.selectionText;

    console.log("Context menu clicked for template:", templateId);
    console.log("Current userTemplates count:", userTemplates.length);
    console.log("Current user:", currentUser?.email || "Not logged in");

    // Find the template in current cache
    let template = userTemplates.find((t) => t.id === templateId);

    // If template not found, try reloading user data (service worker might have restarted)
    if (!template) {
      console.log("Template not found in cache, reloading user data...");
      await loadUserData();
      template = userTemplates.find((t) => t.id === templateId);
      console.log("After reload, userTemplates count:", userTemplates.length);
    }

    // If still not found, fetch directly from database
    if (!template) {
      console.log("Template still not found, fetching from database...");
      try {
        const { data, error } = await supabase
          .from("templates")
          .select("*")
          .eq("id", templateId)
          .single();

        if (error) throw error;
        template = data;
      } catch (error) {
        console.error("Failed to fetch template from database:", error);
        chrome.tabs.sendMessage(tab.id, {
          action: "showError",
          message: "Template not found. Please refresh and try again.",
        });
        return;
      }
    }

    if (!template) {
      console.error("Template not found:", templateId);
      chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        message: "Template not found. Please refresh and try again.",
      });
      return;
    }

    // Send message to content script to show loading
    chrome.tabs.sendMessage(tab.id, { action: "showLoading" });

    try {
      // Format the text using the template
      const formattedText = await formatTextWithTemplate(
        selectedText,
        template,
        currentUser
      );

      // Send formatted text back to content script
      chrome.tabs.sendMessage(tab.id, {
        action: "replaceText",
        newText: formattedText,
      });

      // Track the formatting request
      await trackFormattingRequest(
        currentUser.id,
        templateId,
        selectedText,
        formattedText
      );

      // Save to local history
      const domain = new URL(tab.url).hostname;
      await saveToHistory(
        templateId,
        template.name,
        selectedText,
        formattedText,
        domain,
        currentUser.id
      );
    } catch (error) {
      console.error("Error formatting text:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        message: "Failed to format text",
      });
    }
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
    // Get the current session to extract JWT token
    const { session } = await chrome.storage.local.get(["session"]);

    if (!session || !session.access_token) {
      throw new Error("No valid session found");
    }

    // Call your backend API instead of OpenAI directly
    const response = await fetch("http://localhost:3000/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        templateId: template.id,
        userText: text,
      }),
    });

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

    // Keep your existing JSON formatting logic
    try {
      if (
        (formattedText.startsWith("{") && formattedText.endsWith("}")) ||
        (formattedText.startsWith("[") && formattedText.endsWith("]"))
      ) {
        const jsonObject = JSON.parse(formattedText);
        formattedText = stringify(jsonObject, {
          maxLength: 80,
          indent: 2,
        });
        console.log("JSON formatted successfully");
      }
    } catch (jsonError) {
      console.log("Response is not valid JSON, returning as-is");
    }

    return formattedText;
  } catch (error) {
    console.error("Error calling backend API:", error);
    // Fallback to simple template replacement
    return template.prompt_template
      ? template.prompt_template.replace("{text}", text)
      : text;
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
    console.log("Tracked formatting request");
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
async function saveToHistory(templateId, templateName, inputText, outputText, domain, userId) {
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
      userId: userId
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
    
    console.log("Saved to user history:", historyItem.templateName, "for user:", userId);
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
    console.log("History cleared for user:", targetUserId);
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
    const { formatting_history: oldHistory } = await chrome.storage.local.get(['formatting_history']);
    if (!oldHistory || oldHistory.length === 0) return;

    console.log("Migrating old history to user-specific format for user:", userId);

    // Check if user already has history (don't overwrite)
    const userHistoryKey = `formatting_history_${userId}`;
    const { [userHistoryKey]: existingUserHistory } = await chrome.storage.local.get([userHistoryKey]);
    
    if (existingUserHistory && existingUserHistory.length > 0) {
      console.log("User already has history, skipping migration");
      // Remove old history since it's no longer needed
      await chrome.storage.local.remove(['formatting_history']);
      return;
    }

    // Migrate old history to user-specific key
    const migratedHistory = oldHistory.map(item => ({
      ...item,
      userId: userId // Add userId to existing items
    }));

    // Save to user-specific key
    await chrome.storage.local.set({ [userHistoryKey]: migratedHistory });
    
    // Remove old history
    await chrome.storage.local.remove(['formatting_history']);
    
    console.log(`Migrated ${migratedHistory.length} history items for user:`, userId);
  } catch (error) {
    console.error("Error migrating old history:", error);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log("Tab updated:", changeInfo.url);
  }

  // Check for auth success page with tokens in hash
  if (
    changeInfo.url?.includes("/auth/success#access_token=") ||
    changeInfo.url?.startsWith(
      "http://localhost:3000/auth/success#access_token="
    ) ||
    changeInfo.url?.startsWith(
      "http://localhost:3001/auth/success#access_token="
    )
  ) {
    console.log("OAuth callback detected on success page!");
    finishUserOAuth(changeInfo.url);
  }

  // Keep existing checks as fallback
  if (
    changeInfo.url?.startsWith(chrome.identity.getRedirectURL()) ||
    changeInfo.url?.startsWith("http://localhost:3000/#access_token=")
  ) {
    console.log("OAuth callback detected!");
    finishUserOAuth(changeInfo.url);
  }
});

/**
 * Method used to finish OAuth callback for a user authentication.
 */
async function finishUserOAuth(url) {
  try {
    console.log(`handling user OAuth callback for URL: ${url}`);

    // extract tokens from hash
    const hashMap = parseUrlHash(url);
    const access_token = hashMap.get("access_token");
    const refresh_token = hashMap.get("refresh_token");
    console.log("🔍 Extracted tokens:", {
      access_token: !!access_token,
      refresh_token: !!refresh_token,
    });

    if (!access_token || !refresh_token) {
      throw new Error(`no supabase tokens found in URL hash`);
    }

    // check if they work
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      console.log("this is the error related to setting the session", error);
      throw error;
    }

    console.log("user data", data.user);
    console.log("session data", data.session);

    // persist session to storage
    await chrome.storage.local.set({ session: data.session });
    console.log("✅ Session saved to chrome storage");

    // Close the OAuth tab instead of redirecting
    const tabs = await chrome.tabs.query({ url: url });
    if (tabs.length > 0) {
      await chrome.tabs.remove(tabs[0].id);
    }

    console.log(`finished handling user OAuth callback`);
  } catch (error) {
    console.error("here is the error related to Create Client", error);
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

import { supabase } from "./supabase.js";
import stringify from "json-stringify-pretty-compact";

// Context menu setup
let userTemplates = [];
let currentUser = null;

// Initialize context menu when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  console.log("🚀 Background: Extension installed/loaded");

  // Add delay to allow storage adapter to initialize properly
  setTimeout(async () => {
    await loadUserData(); // Load user data FIRST
    // Context menu will be created by loadUserData() if user is logged in
  }, 500);
});

// Listen for Supabase auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(
    "🔔 Background: Supabase auth state changed:",
    event,
    "User:",
    session?.user?.email || "no user"
  );

  if (event === "SIGNED_IN" && session) {
    console.log(
      "✅ Background: User signed in, reloading data for:",
      session.user?.email
    );
    try {
      await loadUserData();
      await updateContextMenu();
      console.log("✅ Background: Post-signin data load completed");
    } catch (error) {
      console.error(
        "❌ Background: Error during post-signin data load:",
        error
      );
    }
  } else if (event === "SIGNED_OUT") {
    console.log("👋 Background: User signed out, clearing data");
    currentUser = null;
    userTemplates = [];
    await updateContextMenu();
  } else if (event === "TOKEN_REFRESHED" && session) {
    console.log(
      "🔄 Background: Token refreshed for user:",
      session.user?.email
    );
    currentUser = session.user;
  } else {
    console.log("ℹ️ Background: Other auth event:", event);
  }
});

// Load user data on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("🚀 Background: Extension startup detected");

  // Add delay to ensure storage adapter is ready
  setTimeout(async () => {
    // Supabase will automatically restore session from storage adapter
    await loadUserData();
    await updateContextMenu();
  }, 500);
});

/**
 * Ensures we have a valid session using Supabase's automatic session management
 * @async
 * @returns {Promise<void>}
 */
async function ensureValidSession() {
  try {
    console.log("Checking session validity...");

    // Get current session - Supabase automatically handles storage and refresh
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.log("Session validation failed:", error);
      currentUser = null;
      userTemplates = [];
      throw new Error("You need to be authenticated first");
    }

    if (!session) {
      console.log("No valid session found");
      currentUser = null;
      userTemplates = [];
      throw new Error("You need to be authenticated first");
    }

    // Update current user if we have a valid session
    if (session.user) {
      currentUser = session.user;
      console.log("Session valid for user:", session.user.email);
    }

    return session;
  } catch (error) {
    console.error("Error ensuring valid session:", error);
    currentUser = null;
    userTemplates = [];
    throw error;
  }
}

/**
 * Loads the current user's data and templates using Supabase automatic session management
 * @async
 * @returns {Promise<void>}
 */
async function loadUserData() {
  try {
    console.log("🔄 Background: Loading user data...");

    // Get session using Supabase's automatic session management
    console.log(
      "📋 Background: Attempting to retrieve session from Supabase..."
    );
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("📋 Background: Session retrieval result:", {
      hasSession: !!session,
      hasError: !!sessionError,
      sessionUser: session?.user?.email || "no user",
      tokenPresent: !!session?.access_token,
    });

    if (sessionError) {
      console.error("❌ Background: Session error:", sessionError);
      throw sessionError;
    }

    if (!session) {
      console.log(
        "⚠️ Background: No session found, creating context menu without templates"
      );
      currentUser = null;
      userTemplates = [];
      await createContextMenuWithTemplates();
      return;
    }

    console.log("✅ Background: Valid session found, loading user data");
    console.log("🔑 Background: Token info:", {
      tokenLength: session.access_token?.length || 0,
      tokenStart: session.access_token?.substring(0, 20) + "...",
      expiresAt: session.expires_at,
      refreshToken: !!session.refresh_token,
    });

    // Get current user - session is already valid
    console.log("👤 Background: Attempting to get user info...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      console.error("❌ Background: User error:", userError);
      throw userError;
    }

    currentUser = user;
    console.log(
      "✅ Background: Current user loaded:",
      user?.email || "no email"
    );

    // Load user's templates using API route
    try {
      console.log("📄 Background: Making API call to fetch templates");
      console.log("🔑 Background: Using token for API:", {
        tokenStart: session.access_token?.substring(0, 20) + "...",
        tokenLength: session.access_token?.length,
      });

      const response = await fetch(
        "http://localhost:3000/api/extension/templates",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      console.log("📡 Background: API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Background: API error response:", errorText);
        throw new Error(
          `Failed to fetch templates: ${response.status} - ${errorText}`
        );
      }

      const templates = await response.json();
      console.log(
        "✅ Background: Successfully fetched templates:",
        templates?.length || 0
      );
      if (templates && templates.length > 0) {
        console.log(
          "📋 Background: Template names:",
          templates.map((t) => t.name)
        );
      }
      userTemplates = templates || [];
    } catch (error) {
      console.error("❌ Background: Error fetching templates from API:", error);
      userTemplates = [];
    }

    console.log("📊 Background: Final template count:", userTemplates.length);

    // Migrate old history format if needed
    await migrateOldHistory(user.id);

    // Update context menu after loading templates
    await updateContextMenu();
  } catch (error) {
    console.error("❌ Background: Error loading user data:", error);
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

    try {
      // Ensure valid session first
      await ensureValidSession();

      if (!currentUser) {
        console.error("No user authenticated");
        chrome.tabs.sendMessage(tab.id, {
          action: "showError",
          message: "You need to be authenticated first",
        });
        return;
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showError",
        message: "You need to be authenticated first",
      });
      return;
    }

    // Find the template in current cache
    let template = userTemplates.find((t) => t.id === templateId);

    // If template not found, try reloading user data (service worker might have restarted)
    if (!template) {
      console.log("Template not found in cache, reloading user data...");
      await loadUserData();
      template = userTemplates.find((t) => t.id === templateId);
      console.log("After reload, userTemplates count:", userTemplates.length);
    }

    // If still not found, fetch from API
    if (!template) {
      console.log("Template still not found, fetching from API...");
      try {
        // Ensure valid session before making API call
        const session = await ensureValidSession();

        if (!session) {
          throw new Error("No valid session available");
        }

        const response = await fetch(
          "http://localhost:3000/api/extension/templates",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.status}`);
        }

        const templates = await response.json();
        template = templates.find((t) => t.id === templateId);

        // Update userTemplates cache
        userTemplates = templates;
      } catch (error) {
        console.error("Failed to fetch template from API:", error);
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
    // Ensure we have valid session and user state
    const session = await ensureValidSession();

    if (!session || !session.access_token) {
      throw new Error("You need to be authenticated first");
    }

    // Double-check user is still logged in
    if (!currentUser) {
      console.log("Current user lost, reloading user data...");
      await loadUserData();
      if (!currentUser) {
        throw new Error("You need to be authenticated first");
      }
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
          console.log("JSON formatted successfully");
        }
      } else if (templateType === "xml") {
        // Basic XML formatting - add proper indentation if needed
        if (formattedText.includes("<") && formattedText.includes(">")) {
          // Simple XML formatting - just ensure it's readable
          formattedText = formattedText
            .replace(/></g, ">\n<")
            .replace(/^\s+|\s+$/g, "");
          console.log("XML formatted successfully");
        }
      } else if (templateType === "markdown") {
        // Markdown doesn't need special formatting, keep as-is
        console.log("Markdown template - no additional formatting needed");
      }
    } catch (formatError) {
      console.log(
        "Format-specific processing failed, returning as-is:",
        formatError
      );
    }

    return formattedText;
  } catch (error) {
    console.error("Error calling backend API:", error);
    // Fallback to simple template replacement
    const promptTemplate = template.promptTemplate || template.prompt_template;
    return promptTemplate ? promptTemplate.replace("{text}", text) : text;
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

    console.log(
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
    const { formatting_history: oldHistory } = await chrome.storage.local.get([
      "formatting_history",
    ]);
    if (!oldHistory || oldHistory.length === 0) return;

    console.log(
      "Migrating old history to user-specific format for user:",
      userId
    );

    // Check if user already has history (don't overwrite)
    const userHistoryKey = `formatting_history_${userId}`;
    const { [userHistoryKey]: existingUserHistory } =
      await chrome.storage.local.get([userHistoryKey]);

    if (existingUserHistory && existingUserHistory.length > 0) {
      console.log("User already has history, skipping migration");
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

    console.log(
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
    console.log("Format prompt command triggered");
    console.log("Current user:", currentUser?.email || "Not logged in");
    console.log("Available templates:", userTemplates?.length || 0);

    try {
      // Ensure valid session first
      await ensureValidSession();

      // Check if user is logged in after ensuring session
      if (!currentUser) {
        console.log("User not logged in, cannot show modal");
        chrome.tabs.sendMessage(tab.id, {
          action: "showKeyboardModal",
          error: "You need to be authenticated first",
        });
        return;
      }

      // Debug: Log the state before checking templates
      console.log(
        "Before template check - userTemplates:",
        userTemplates?.length || 0
      );
      console.log(
        "userTemplates array:",
        userTemplates?.map((t) => t.name) || "empty"
      );

      // If templates appear to not be loaded, this might be a race condition
      if (!userTemplates || userTemplates.length === 0) {
        console.log(
          "Templates appear empty - this shouldn't happen if extension loaded correctly"
        );
        console.log("Skipping template reload to avoid 401 error");
        // Don't call loadUserData() here as it causes 401 error
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showKeyboardModal",
        error: "You need to be authenticated first",
      });
      return;
    }

    // Check if user has templates after loading
    if (!userTemplates || userTemplates.length === 0) {
      console.log(
        "⚠️ Templates missing, attempting to reload for user:",
        currentUser?.email
      );

      // Try to reload templates first
      try {
        await loadUserData();
        console.log(
          "🔄 Templates reloaded, count:",
          userTemplates?.length || 0
        );
      } catch (error) {
        console.error("❌ Failed to reload templates:", error);
      }

      // Check again after reload
      if (!userTemplates || userTemplates.length === 0) {
        console.log(
          "❌ No templates available after reload for user:",
          currentUser?.email
        );
        chrome.tabs.sendMessage(tab.id, {
          action: "showKeyboardModal",
          error: "No templates available. Please create templates first.",
        });
        return;
      }
    }

    console.log(
      "Sending modal with templates:",
      userTemplates.map((t) => t.name)
    );

    console.log("🔍 DEBUGGING showKeyboardModal message:", {
      action: "showKeyboardModal",
      templatesCount: userTemplates?.length || 0,
      userEmail: currentUser?.email,
      templateNames: userTemplates?.map((t) => t.name) || [],
      hasTemplates: userTemplates && userTemplates.length > 0,
      tabId: tab.id,
    });

    // Send templates to content script to show modal
    chrome.tabs.sendMessage(tab.id, {
      action: "showKeyboardModal",
      templates: userTemplates,
      user: currentUser,
    });
  }
});

// Handle messages from content script (including keyboard modal selections)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action || message.type);

  // Handle auth state changes from popup
  if (message.type === "AUTH_STATE_CHANGED") {
    console.log(
      "🔔 Background: Received auth state change from popup:",
      message.event
    );

    (async () => {
      try {
        if (message.event === "SIGNED_IN" && message.session) {
          console.log("✅ Background: Processing sign-in from popup");
          // Wait a moment for Supabase to process the session
          setTimeout(async () => {
            await loadUserData();
            await updateContextMenu();
            console.log("✅ Background: Auth sync from popup completed");
          }, 1000);
        } else if (message.event === "SIGNED_OUT") {
          console.log("👋 Background: Processing sign-out from popup");
          currentUser = null;
          userTemplates = [];
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

  if (message.action === "formatWithTemplate") {
    const { templateId, selectedText } = message;

    console.log("Processing format request for template:", templateId);

    // Validate inputs
    if (!templateId || !selectedText) {
      console.error("Missing required parameters:", {
        templateId,
        selectedText,
      });
      sendResponse({ error: "Missing template ID or selected text" });
      return true;
    }

    // Process the formatting asynchronously
    (async () => {
      try {
        // Ensure valid session first
        await ensureValidSession();

        // Check if user is logged in after ensuring session
        if (!currentUser) {
          console.error("No current user found after session check");
          sendResponse({ error: "You need to be authenticated first" });
          return;
        }

        // Find the template
        const template = userTemplates.find((t) => t.id === templateId);
        if (!template) {
          console.error("Template not found:", templateId);
          sendResponse({ error: "Template not found" });
          return;
        }

        console.log("Starting text formatting...");

        // Format the text using the existing function
        const formattedText = await formatTextWithTemplate(
          selectedText,
          template,
          currentUser
        );

        console.log("Text formatted successfully");

        // Track the formatting request
        await trackFormattingRequest(
          currentUser.id,
          templateId,
          selectedText,
          formattedText
        );

        // Save to local history
        const domain = new URL(sender.tab.url).hostname;
        await saveToHistory(
          templateId,
          template.name,
          selectedText,
          formattedText,
          domain,
          currentUser.id
        );

        console.log("Sending formatted response");
        sendResponse({ formattedText });
      } catch (error) {
        console.error("Error formatting text from keyboard modal:", error);
        const errorMessage = error.message || "Failed to format text";
        sendResponse({ error: errorMessage });
      }
    })();

    return true; // Keep message channel open for async response
  }

  return true; // Keep message channel open for other messages
});

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

    // Set session in Supabase - storage adapter will automatically persist it
    console.log("🔐 Setting session in Supabase...");
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      console.error("❌ Error setting session:", error);
      throw error;
    }

    console.log("✅ Session set successfully!");
    console.log("👤 User authenticated:", data.user?.email);
    console.log("💾 Session data present:", !!data.session);
    console.log("✅ Session automatically stored via Chrome storage adapter");

    // Trigger a manual load to ensure data is available
    console.log("🔄 Manually triggering loadUserData after OAuth...");
    try {
      await loadUserData();
      console.log("✅ Manual post-OAuth data load completed");
    } catch (error) {
      console.error("❌ Manual post-OAuth data load failed:", error);
    }

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

import { supabase } from "./supabase.js";
import { API_CONFIG } from "./config.js";

document.addEventListener("DOMContentLoaded", async function () {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "AUTH_SUCCESS") {
      handleAuthSuccess(message.session);
    } else if (message.type === "AUTH_ERROR") {
      handleAuthError(message.error);
    }
  });

  async function handleAuthSuccess(sessionData) {
    try {
      console.log("🔐 Popup: Handling auth success...");
      // Create proper Supabase session - storage adapter will automatically persist it
      const { error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (error) throw error;

      console.log("✅ Popup: Session set successfully");
      // Auth state change listener will automatically show home page
    } catch (error) {
      console.error("❌ Popup: Error handling auth success:", error);
      showError("Authentication failed. Please try again.");
    }
  }

  function handleAuthError(errorMessage) {
    console.error("Auth error:", errorMessage);
    showError("Authentication failed: " + errorMessage);
    showLoginPage();
  }
  // Your code here
  const testLoginButton = document.getElementById("sso-btn");
  let clickedTimes = 0;

  console.log(
    "Chrome extension redirect url: ",
    chrome.identity.getRedirectURL()
  );

  // Check for existing session using Supabase's automatic session management
  console.log("🔍 Checking for existing session...");
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    console.log("📋 Session check result:", {
      hasSession: !!session,
      hasError: !!error,
      userEmail: session?.user?.email || "no user",
    });

    if (error) {
      console.error("❌ Session error:", error);
      showLoginPage();
    } else if (session && session.user) {
      console.log("✅ Valid session found, showing home page");
      showHomePage();
    } else {
      console.log("⚠️ No session found, showing login page");
      showLoginPage();
    }
  } catch (error) {
    console.error("❌ Error checking session:", error);
    showLoginPage();
  }

  // Listen for Supabase auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      "🔔 Popup: Auth state changed:",
      event,
      session?.user?.email || "no user"
    );

    if (event === "SIGNED_IN" && session) {
      console.log("✅ Popup: User signed in, showing home page");
      showHomePage();

      // Notify background script of auth state change
      chrome.runtime
        .sendMessage({
          type: "AUTH_STATE_CHANGED",
          event: event,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: session.user,
          },
        })
        .catch((error) => {
          console.log(
            "Background script not ready for auth notification:",
            error
          );
        });
    } else if (event === "SIGNED_OUT") {
      console.log("👋 Popup: User signed out, showing login page");
      showLoginPage();

      // Notify background script of sign out
      chrome.runtime
        .sendMessage({
          type: "AUTH_STATE_CHANGED",
          event: event,
          session: null,
        })
        .catch((error) => {
          console.log(
            "Background script not ready for auth notification:",
            error
          );
        });
    }
  });

  testLoginButton.addEventListener("click", function () {
    loginWithGoogle();
  });

  // Sign out button
  const signOutButton = document.getElementById("sign-out-btn");
  if (signOutButton) {
    signOutButton.addEventListener("click", async function () {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Clear stored session
        await chrome.storage.local.remove(["session"]);

        // Show login page
        showLoginPage();
      } catch (error) {
        console.error("Sign out error:", error);
        showError("Failed to sign out");
      }
    });
  }

  // Clear history button
  const clearHistoryButton = document.getElementById("clear-history-btn");
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", clearAllHistory);
  }

  async function loginWithGoogle() {
    try {
      console.log("Starting Google OAuth...");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: chrome.identity.getRedirectURL(),
        },
      });

      if (error) {
        console.error("OAuth error:", error);
        throw error;
      }

      console.log("Opening OAuth URL:", data.url);
      await chrome.tabs.create({ url: data.url });
    } catch (error) {
      console.error("Login error:", error);
      showError("Login failed: " + error.message);
    }
  }

  async function loadDashboard() {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Update user info in header
      document.getElementById("user-name").textContent =
        user.user_metadata?.full_name || "User";
      document.getElementById("user-email").textContent = user.email;
      if (user.user_metadata?.avatar_url) {
        document.getElementById("user-avatar").src =
          user.user_metadata.avatar_url;
      }

      // Fetch user stats from backend API
      try {
        // Get current session following the established pattern
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error("No active session");
        }

        const response = await fetch(API_CONFIG.getUrl('STATS'), {
          method: "GET",
          headers: API_CONFIG.getHeaders(session.access_token),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const stats = await response.json();
        
        // Update stats display - now showing monthly requests
        document.getElementById("total-requests").textContent =
          stats.monthly_requests || "0";
        document.getElementById("total-templates").textContent =
          stats.total_templates || "0";
          
        console.log("Stats loaded successfully:", stats);
      } catch (error) {
        console.error("Error fetching stats from API:", error);
        // Set default values if error
        document.getElementById("total-requests").textContent = "0";
        document.getElementById("total-templates").textContent = "0";
      }

      // Fetch user's templates
      const { data: templates, error: templatesError } = await supabase
        .from("templates")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (templatesError) {
        console.error("Error fetching templates:", templatesError);
        displayTemplates([]);
      } else {
        displayTemplates(templates || []);
      }

      // Load formatting history
      await loadHistory();
    } catch (error) {
      console.error("Error loading dashboard:", error);
      showError("Failed to load dashboard");
    }
  }

  // Display templates in the list
  function displayTemplates(templates) {
    const templatesList = document.getElementById("templates-list");

    if (templates.length === 0) {
      templatesList.innerHTML =
        '<p class="text-center text-muted-foreground text-sm py-5 m-0">No templates yet. Create your first template!</p>';
      return;
    }

    // Build HTML for templates
    const templatesHTML = templates
      .map((template) => {
        const templateType =
          template.templateType || template.template_type || "json";
        const badgeClass = `template-type-badge template-type-${templateType}`;
        return `
        <div class="bg-background border border-border rounded-md p-3 mb-[10px] cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm last:mb-0" data-template-id="${
          template.id
        }">
          <div class="flex items-center justify-between mb-1">
            <div class="font-medium text-foreground">${template.name}</div>
            <span class="${badgeClass}">${templateType.toUpperCase()}</span>
          </div>
          ${
            template.description
              ? `<div class="text-xs text-muted-foreground">${template.description}</div>`
              : ""
          }
        </div>
      `;
      })
      .join("");

    templatesList.innerHTML = templatesHTML;
  }

  // Load and display formatting history for current user
  async function loadHistory() {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.log("No user found, skipping history load");
        displayHistory([]);
        return;
      }

      // Load user-specific history
      const historyKey = `formatting_history_${user.id}`;
      const result = await chrome.storage.local.get([historyKey]);
      const history = result[historyKey] || [];

      displayHistory(history);
    } catch (error) {
      console.error("Error loading history:", error);
      displayHistory([]);
    }
  }

  // Display history items in the list
  function displayHistory(history) {
    const historyList = document.getElementById("history-list");

    if (history.length === 0) {
      historyList.innerHTML =
        '<p class="text-center text-muted-foreground text-sm py-5 m-0">No formatting history yet</p>';
      return;
    }

    // Build HTML for history items
    const historyHTML = history
      .map((item) => {
        const timeAgo = getTimeAgo(item.timestamp);
        const preview =
          item.inputText.length > 100
            ? item.inputText.substring(0, 100) + "..."
            : item.inputText;

        return `
        <div class="bg-background border border-border rounded-md mb-[10px] overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-sm last:mb-0" data-history-id="${item.id}">
          <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-muted transition-colors duration-200" data-toggle-id="${item.id}">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-primary text-sm mb-1">${item.templateName}</div>
              <div class="text-xs text-foreground mb-[6px] line-clamp-2 leading-[1.3] break-words overflow-hidden">${preview}</div>
              <div class="flex gap-3 text-[11px] text-muted-foreground">
                <span class="bg-accent text-accent-foreground px-[6px] py-[2px] rounded-sm font-medium">${item.domain}</span>
                <span class="text-muted-foreground">${timeAgo}</span>
              </div>
            </div>
            <div class="text-muted-foreground text-xs ml-2 transition-transform duration-200">▼</div>
          </div>
          <div class="hidden border-t border-border p-[15px] bg-muted/50">
            <div class="mb-[15px] last:mb-0">
              <div class="block mb-2 text-xs text-foreground font-semibold">Input:</div>
              <div class="bg-background border border-border rounded p-[10px] text-[11px] leading-[1.4] text-foreground whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto font-mono">${item.inputText}</div>
            </div>
            <div class="mb-[15px] last:mb-0">
              <div class="block mb-2 text-xs text-foreground font-semibold">Output:</div>
              <div class="bg-background border border-border rounded p-[10px] text-[11px] leading-[1.4] text-foreground whitespace-pre-wrap break-words max-h-[120px] overflow-y-auto font-mono">${item.outputText}</div>
              <button class="copy-btn mt-2 px-3 py-[6px] bg-primary text-primary-foreground border-none rounded text-[11px] font-medium cursor-pointer transition-all duration-200 hover:bg-primary/90 active:bg-primary/80" data-copy-id="${item.id}">
                Copy Output
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    historyList.innerHTML = historyHTML;

    // Add event listeners for toggle functionality
    const toggleButtons = historyList.querySelectorAll("[data-toggle-id]");
    toggleButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const itemId = button.getAttribute("data-toggle-id");
        toggleHistoryItem(itemId);
      });
    });

    // Add event listeners for copy buttons
    const copyButtons = historyList.querySelectorAll(".copy-btn[data-copy-id]");
    copyButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering toggle
        const itemId = button.getAttribute("data-copy-id");
        // Find the corresponding history item and get the actual output text
        const historyItem = history.find(
          (item) => item.id.toString() === itemId
        );
        if (historyItem) {
          copyToClipboard(itemId, historyItem.outputText);
        }
      });
    });
  }

  // Toggle history item expansion
  function toggleHistoryItem(itemId) {
    const item = document.querySelector(`[data-history-id="${itemId}"]`);
    const content = item.querySelector(".hidden, .block");
    const toggle = item.querySelector(".text-xs.ml-2");

    if (content.classList.contains("hidden")) {
      content.classList.remove("hidden");
      content.classList.add("block");
      toggle.textContent = "▲";
    } else {
      content.classList.remove("block");
      content.classList.add("hidden");
      toggle.textContent = "▼";
    }
  }

  // Copy text to clipboard
  async function copyToClipboard(itemId, text) {
    try {
      // Copy the original text without any escaping since we're getting it directly from the data
      await navigator.clipboard.writeText(text);

      // Show feedback
      const copyBtn = document.querySelector(`[data-copy-id="${itemId}"]`);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      copyBtn.classList.remove("bg-primary", "hover:bg-primary/90");
      copyBtn.classList.add("bg-green-500", "hover:bg-green-600");

      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove("bg-green-500", "hover:bg-green-600");
        copyBtn.classList.add("bg-primary", "hover:bg-primary/90");
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy to clipboard");
    }
  }

  // Helper function to get time ago string
  function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  // Clear all history for current user
  async function clearAllHistory() {
    if (confirm("Are you sure you want to clear all formatting history?")) {
      try {
        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log("No user found, cannot clear history");
          alert("Please log in to clear history");
          return;
        }

        // Clear user-specific history
        const historyKey = `formatting_history_${user.id}`;
        await chrome.storage.local.remove([historyKey]);
        displayHistory([]);
        console.log("History cleared for user:", user.id);
      } catch (error) {
        console.error("Error clearing history:", error);
        alert("Failed to clear history");
      }
    }
  }

  function showHomePage() {
    document.getElementById("Login-page").classList.add("hidden");
    document.getElementById("user-dashboard").classList.remove("hidden");
    loadDashboard();
  }

  function showLoginPage() {
    document.getElementById("Login-page").classList.remove("hidden");
    document.getElementById("user-dashboard").classList.add("hidden");
  }

  function showError(message) {
    console.error(message);
    alert(message);
  }

  // Session loading is now handled above with proper restoration
});

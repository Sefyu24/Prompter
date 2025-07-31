import { supabase } from "./supabase.js";
import { API_CONFIG } from "./config.js";
import { createIcons, Zap, Settings } from 'lucide';

// Notification system for popup
class PopupNotificationManager {
  constructor() {
    this.stylesAdded = false;
    this.ensureStyles();
  }

  showNotification(message, type = 'info', duration = 3000) {
    const notification = this.createNotificationElement(message, type);
    document.body.appendChild(notification);

    // Auto remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  createNotificationElement(message, type) {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    const colors = this.getNotificationColors(type);
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background-color: ${colors.bgColor};
      color: #ffffff;
      border: 1px solid ${colors.borderColor};
      border-radius: 8px;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      animation: slideInRight 0.3s ease-out;
    `;

    return notification;
  }

  getNotificationColors(type) {
    switch (type) {
      case 'error':
        return { 
          bgColor: '#ef4444', 
          borderColor: '#dc2626' 
        };
      case 'success':
        return { 
          bgColor: '#10b981', 
          borderColor: '#059669' 
        };
      default:
        return { 
          bgColor: '#3b82f6', 
          borderColor: '#2563eb' 
        };
    }
  }

  ensureStyles() {
    if (this.stylesAdded) return;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
    this.stylesAdded = true;
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showInfo(message) {
    this.showNotification(message, 'info');
  }
}

// Create global notification manager
const notificationManager = new PopupNotificationManager();

// Helper function to get user-friendly error messages
function getUserFriendlyErrorMessage(error, context = '') {
  if (error.message?.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
    return 'Session expired. Please sign in again.';
  }
  
  if (error.message?.includes('403') || error.message?.includes('forbidden')) {
    return 'Access denied. Please check your permissions.';
  }
  
  if (error.message?.includes('404')) {
    return 'Resource not found. Please try again later.';
  }
  
  if (error.message?.includes('500') || error.message?.includes('server')) {
    return 'Server error. Please try again in a few moments.';
  }
  
  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (context === 'stats' || context === 'templates' || context === 'membership') {
    return `Failed to load ${context}. Please refresh and try again.`;
  }
  
  // Generic fallback
  return error.message || 'An unexpected error occurred. Please try again.';
}

document.addEventListener("DOMContentLoaded", async function () {
  // Initialize Lucide icons
  createIcons({
    icons: {
      Zap,
      Settings
    }
  });

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
      
      // Simply store the Supabase tokens directly - no need for custom endpoint
      const tokenPayload = JSON.parse(atob(sessionData.access_token.split('.')[1]));
      
      // Store session data directly in Chrome storage using the same format as Supabase adapter
      const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
      const sessionToStore = {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        user: {
          id: tokenPayload.sub,
          email: tokenPayload.email,
          user_metadata: tokenPayload.user_metadata || {}
        },
        expires_at: tokenPayload.exp * 1000 // Convert to milliseconds
      };

      await chrome.storage.local.set({
        [storageKey]: JSON.stringify(sessionToStore)
      });

      console.log("✅ Popup: Supabase session stored successfully");
      console.log("👤 Popup: User authenticated:", tokenPayload.email);
      showHomePage(); // Manually show home page since we're not using Supabase auth state change
    } catch (error) {
      console.error("❌ Popup: Error handling auth success:", error);
      notificationManager.showError("Authentication failed. Please try again.");
    }
  }

  function handleAuthError(errorMessage) {
    console.error("Auth error:", errorMessage);
    notificationManager.showError("Authentication failed: " + errorMessage);
    showLoginPage();
  }
  // Your code here
  const testLoginButton = document.getElementById("sso-btn");
  let clickedTimes = 0;

  console.log(
    "Chrome extension redirect url: ",
    chrome.identity.getRedirectURL()
  );

  // Check for existing session using direct Chrome storage access
  console.log("🔍 Checking for existing session...");
  try {
    const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
    const result = await chrome.storage.local.get([storageKey]);
    const sessionData = result[storageKey];

    console.log("📋 Session check result:", {
      hasSession: !!sessionData,
      userEmail: sessionData ? JSON.parse(sessionData).user?.email || "no email" : "no user",
    });

    if (sessionData) {
      try {
        const parsedSession = JSON.parse(sessionData);
        if (parsedSession.user && parsedSession.access_token) {
          console.log("✅ Valid session found, showing home page");
          showHomePage();
        } else {
          console.log("⚠️ Invalid session data, showing login page");
          showLoginPage();
        }
      } catch (parseError) {
        console.error("❌ Error parsing session data:", parseError);
        showLoginPage();
      }
    } else {
      console.log("⚠️ No session found, showing login page");
      showLoginPage();
    }
  } catch (error) {
    console.error("❌ Error checking session:", error);
    showLoginPage();
  }

  // Note: We no longer use Supabase auth state changes since we manage sessions manually
  // Auth state changes are handled by the specific functions (handleAuthSuccess, signOut, etc.)

  testLoginButton.addEventListener("click", function () {
    loginWithGoogle();
  });

  // Sign out button
  const signOutButton = document.getElementById("sign-out-btn");
  if (signOutButton) {
    signOutButton.addEventListener("click", async function () {
      try {
        console.log("🚪 Signing out user...");
        
        // Clear our custom session storage
        const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
        await chrome.storage.local.remove([storageKey]);
        
        console.log("✅ Session cleared successfully");

        // Show login page
        showLoginPage();
        
        // Notify background script of sign out
        chrome.runtime
          .sendMessage({
            type: "AUTH_STATE_CHANGED",
            event: "SIGNED_OUT",
            session: null,
          })
          .catch((error) => {
            console.log("Background script not ready for auth notification:", error);
          });
          
      } catch (error) {
        console.error("Sign out error:", error);
        notificationManager.showError("Failed to sign out");
      }
    });
  }

  // Clear history button
  const clearHistoryButton = document.getElementById("clear-history-btn");
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", clearAllHistory);
  }

  // Button event listeners (will be added to DOM after membership status loads)
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'upgrade-btn') {
      handleUpgradeClick();
    } else if (e.target && e.target.id === 'manage-templates-btn') {
      handleManageTemplatesClick();
    }
  });

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
      notificationManager.showError("Login failed: " + error.message);
    }
  }

  async function loadDashboard() {
    try {
      // Get stored session data directly from Chrome storage
      const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
      const result = await chrome.storage.local.get([storageKey]);
      const sessionData = result[storageKey];
      
      if (!sessionData) {
        throw new Error("No authentication session found");
      }

      const parsedSession = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
      const user = parsedSession.user;
      const accessToken = parsedSession.access_token;

      if (!user || !accessToken) {
        throw new Error("Invalid session data");
      }

      // Update user info in header
      const userNameEl = document.getElementById("user-name");
      const userAvatarEl = document.getElementById("user-avatar");
      
      if (userNameEl) {
        userNameEl.textContent = user.user_metadata?.full_name || "User";
      }
      if (userAvatarEl && user.user_metadata?.avatar_url) {
        userAvatarEl.src = user.user_metadata.avatar_url;
      }

      // Fetch user stats from backend API
      try {
        const response = await fetch(API_CONFIG.getUrl('STATS'), {
          method: "GET",
          headers: API_CONFIG.getHeaders(accessToken),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const stats = await response.json();
        
        // Store stats for later use with membership data
        window.currentStats = stats;
          
        console.log("Stats loaded successfully:", stats);
      } catch (error) {
        console.error("Error fetching stats from API:", error);
        notificationManager.showError(getUserFriendlyErrorMessage(error, 'stats'));
        // Set default stats for later use
        window.currentStats = { monthly_requests: 0 };
      }

      // Fetch user membership status
      await loadMembershipStatus(accessToken);

      // Fetch user's templates from API instead of direct database access
      try {
        const templatesResponse = await fetch(API_CONFIG.getUrl('TEMPLATES'), {
          method: "GET",
          headers: API_CONFIG.getHeaders(accessToken),
        });

        if (!templatesResponse.ok) {
          throw new Error(`Failed to fetch templates: ${templatesResponse.status}`);
        }

        const templates = await templatesResponse.json();
        displayTemplates(templates || []);
        console.log("Templates loaded successfully from API:", templates?.length || 0);
      } catch (error) {
        console.error("Error fetching templates from API:", error);
        notificationManager.showError(getUserFriendlyErrorMessage(error, 'templates'));
        displayTemplates([]);
      }

      // Load formatting history
      await loadHistory();
    } catch (error) {
      console.error("Error loading dashboard:", error);
      notificationManager.showError("Failed to load dashboard");
    }
  }

  // Load and display user membership status
  async function loadMembershipStatus(accessToken) {
    try {
      const response = await fetch(API_CONFIG.getUrl('USER'), {
        method: "GET",
        headers: API_CONFIG.getHeaders(accessToken),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }

      const userData = await response.json();
      console.log("🔍 Full API Response:", userData);
      console.log("🔍 Subscription data:", userData.subscription);
      displayMembershipStatus(userData);
      console.log("User membership status loaded successfully:", userData);
    } catch (error) {
      console.error("Error fetching user membership status:", error);
      notificationManager.showError(getUserFriendlyErrorMessage(error, 'membership'));
      // Set default values if error
      displayMembershipStatus({ subscription: { isPro: false } });
    }
  }

  // Display membership status and upgrade section if needed
  function displayMembershipStatus(userData) {
    const membershipStatus = document.getElementById("membership-status");
    const upgradeSection = document.getElementById("upgrade-section");
    const proActions = document.getElementById("pro-actions");
    
    if (!membershipStatus || !upgradeSection || !proActions) {
      console.error("Membership status elements not found in DOM");
      return;
    }
    
    // Check if user is pro based on subscription status
    const isPro = (userData.subscription?.status === 'pro' || userData.subscription?.membershipStatus === 'pro') && userData.subscription?.isActive === true;
    
    // Update membership display
    if (isPro) {
      membershipStatus.textContent = "Pro";
      upgradeSection.classList.add("hidden");
      proActions.classList.remove("hidden");
    } else {
      membershipStatus.textContent = "Free";
      upgradeSection.classList.remove("hidden");
      proActions.classList.add("hidden");
    }
    
    // Update usage display with circular progress
    updateUsageDisplay(isPro);
  }
  
  // Update usage display with circular progress based on isPro status
  function updateUsageDisplay(isPro) {
    const usageCount = document.getElementById("usage-count");
    const usageMax = document.getElementById("usage-max");
    const progressCircle = document.getElementById("progress-circle");
    
    if (!usageCount || !usageMax || !progressCircle) {
      console.error("Usage display elements not found in DOM");
      return;
    }
    
    // Get current usage from stored stats
    const currentUsage = window.currentStats?.monthly_requests || 0;
    
    // Set limits based on isPro status
    const maxRequests = isPro ? 200 : 20;
    
    // Update display
    usageCount.textContent = currentUsage;
    usageMax.textContent = `/${maxRequests}`;
    
    // Calculate progress percentage
    const percentage = Math.min((currentUsage / maxRequests) * 100, 100);
    
    // Update circular progress
    // Circle circumference = 2 * π * r = 2 * π * 18 ≈ 113.1
    const circumference = 113.1;
    const offset = circumference - (percentage / 100) * circumference;
    
    progressCircle.style.strokeDashoffset = offset;
    
    // Change color based on usage level with enhanced shadow effects (adjusted for smaller circle)
    let strokeColor = '#8b5cf6'; // Purple default
    let shadowColor = 'rgba(139, 92, 246, 0.5)'; // Purple shadow
    let shadowIntensity = '3px';
    
    if (percentage >= 90) {
      strokeColor = '#ef4444'; // Red when near limit
      shadowColor = 'rgba(239, 68, 68, 0.6)'; // Red shadow
      shadowIntensity = '5px'; // Stronger shadow for critical state
    } else if (percentage >= 75) {
      strokeColor = '#f59e0b'; // Orange when getting high
      shadowColor = 'rgba(245, 158, 11, 0.5)'; // Orange shadow
      shadowIntensity = '4px';
    } else if (percentage >= 50) {
      strokeColor = '#3b82f6'; // Blue when moderate usage
      shadowColor = 'rgba(59, 130, 246, 0.5)'; // Blue shadow
      shadowIntensity = '3px';
    }
    
    progressCircle.style.stroke = strokeColor;
    progressCircle.style.filter = `drop-shadow(0 0 ${shadowIntensity} ${shadowColor})`;
    
    // Add pulsing animation for critical usage
    if (percentage >= 90) {
      progressCircle.style.animation = 'pulse 2s infinite';
    } else {
      progressCircle.style.animation = 'none';
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
      // Get current user from stored session
      const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
      const result = await chrome.storage.local.get([storageKey]);
      const sessionData = result[storageKey];
      
      if (!sessionData) {
        console.log("No user found, skipping history load");
        displayHistory([]);
        return;
      }

      const parsedSession = JSON.parse(sessionData);
      const user = parsedSession.user;
      
      if (!user || !user.id) {
        console.log("No user ID found, skipping history load");
        displayHistory([]);
        return;
      }

      // Load user-specific history
      const historyKey = `formatting_history_${user.id}`;
      const historyResult = await chrome.storage.local.get([historyKey]);
      const history = historyResult[historyKey] || [];

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

      // Show success notification
      notificationManager.showSuccess("Copied to clipboard!");

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
      notificationManager.showError("Failed to copy to clipboard");
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
        // Get current user from stored session
        const storageKey = 'sb-audlasqcnqqtfednxmdo-auth-token';
        const result = await chrome.storage.local.get([storageKey]);
        const sessionData = result[storageKey];
        
        if (!sessionData) {
          console.log("No user found, cannot clear history");
          notificationManager.showError("Please log in to clear history");
          return;
        }

        const parsedSession = JSON.parse(sessionData);
        const user = parsedSession.user;
        
        if (!user || !user.id) {
          console.log("No user ID found, cannot clear history");
          notificationManager.showError("Please log in to clear history");
          return;
        }

        // Clear user-specific history
        const historyKey = `formatting_history_${user.id}`;
        await chrome.storage.local.remove([historyKey]);
        displayHistory([]);
        notificationManager.showSuccess("History cleared successfully!");
        console.log("History cleared for user:", user.id);
      } catch (error) {
        console.error("Error clearing history:", error);
        notificationManager.showError("Failed to clear history");
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
    notificationManager.showError(message);
  }

  // Handle upgrade button click
  function handleUpgradeClick() {
    // Open upgrade page or redirect to pricing
    // You can customize this URL to your pricing page
    chrome.tabs.create({ url: 'https://your-website.com/pricing' });
  }

  // Handle manage templates button click
  function handleManageTemplatesClick() {
    // Open templates management page
    chrome.tabs.create({ url: 'https://your-website.com/dashboard/template' });
  }

  // Session loading is now handled above with proper restoration
});

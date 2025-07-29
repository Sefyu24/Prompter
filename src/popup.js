import { supabase } from './supabase.js';

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
      // Create proper Supabase session
      const { error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });

      if (error) throw error;

      // Update storage with full session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await chrome.storage.local.set({ session });

      // Show home page
      showHomePage();
    } catch (error) {
      console.error("Error handling auth success:", error);
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

  // Debug: Check stored session and restore it to Supabase
  chrome.storage.local.get(['session'], async (result) => {
    console.log('Stored session:', result.session);
    if (result.session) {
      try {
        // Restore the session to the Supabase client
        const { error } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        
        if (error) {
          console.error('Error restoring session:', error);
          showLoginPage();
        } else {
          console.log('Session restored successfully');
          showHomePage();
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        showLoginPage();
      }
    } else {
      showLoginPage();
    }
  });

  // Listen for storage changes (when session is saved)
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.session) {
      console.log('Session changed:', changes.session.newValue);
      if (changes.session.newValue) {
        try {
          // Restore the new session to the Supabase client
          const { error } = await supabase.auth.setSession({
            access_token: changes.session.newValue.access_token,
            refresh_token: changes.session.newValue.refresh_token,
          });
          
          if (error) {
            console.error('Error setting new session:', error);
            showLoginPage();
          } else {
            console.log('New session set successfully');
            showHomePage();
          }
        } catch (error) {
          console.error('Error setting new session:', error);
          showLoginPage();
        }
      } else {
        showLoginPage();
      }
    }
  });

  testLoginButton.addEventListener("click", function () {
    loginWithGoogle();
  });

  // Sign out button
  const signOutButton = document.getElementById("sign-out-btn");
  if (signOutButton) {
    signOutButton.addEventListener("click", async function() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear stored session
        await chrome.storage.local.remove(['session']);
        
        // Show login page
        showLoginPage();
      } catch (error) {
        console.error('Sign out error:', error);
        showError('Failed to sign out');
      }
    });
  }

  async function loginWithGoogle() {
    try {
      console.log('Starting Google OAuth...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: chrome.identity.getRedirectURL(),
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }

      console.log('Opening OAuth URL:', data.url);
      await chrome.tabs.create({ url: data.url });
    } catch (error) {
      console.error('Login error:', error);
      showError('Login failed: ' + error.message);
    }
  }

  async function loadDashboard() {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // Update user info in header
      document.getElementById("user-name").textContent = user.user_metadata?.full_name || "User";
      document.getElementById("user-email").textContent = user.email;
      if (user.user_metadata?.avatar_url) {
        document.getElementById("user-avatar").src = user.user_metadata.avatar_url;
      }

      // Fetch user stats from the view
      const { data: stats, error: statsError } = await supabase
        .from('user_dashboard_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (statsError) {
        console.error('Error fetching stats:', statsError);
        // Set default values if error
        document.getElementById("total-requests").textContent = "0";
        document.getElementById("total-templates").textContent = "0";
      } else {
        // Update stats
        document.getElementById("total-requests").textContent = stats.total_formatting_requests || "0";
        document.getElementById("total-templates").textContent = stats.total_templates || "0";
      }

      // Fetch user's templates
      const { data: templates, error: templatesError } = await supabase
        .from('templates')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (templatesError) {
        console.error('Error fetching templates:', templatesError);
        displayTemplates([]);
      } else {
        displayTemplates(templates || []);
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
      showError("Failed to load dashboard");
    }
  }

  // Display templates in the list
  function displayTemplates(templates) {
    const templatesList = document.getElementById("templates-list");
    
    if (templates.length === 0) {
      templatesList.innerHTML = '<p class="empty-state">No templates yet. Create your first template!</p>';
      return;
    }

    // Build HTML for templates
    const templatesHTML = templates.map(template => `
      <div class="template-item" data-template-id="${template.id}">
        <div class="template-name">${template.name}</div>
        ${template.description ? `<div class="template-description">${template.description}</div>` : ''}
      </div>
    `).join('');

    templatesList.innerHTML = templatesHTML;
  }

  function showHomePage() {
    document.getElementById("Login-page").style.display = "none";
    document.getElementById("user-dashboard").style.display = "block";
    loadDashboard();
  }

  function showLoginPage() {
    document.getElementById("Login-page").style.display = "block";
    document.getElementById("user-dashboard").style.display = "none";
  }

  function showError(message) {
    console.error(message);
    alert(message);
  }

  // Session loading is now handled above with proper restoration
});
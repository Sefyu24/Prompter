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

  async function loadUserData() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;

      // Debug: Print all user info to console
      console.log("Full user object:", user);
      console.log("User email:", user.email);
      console.log("User metadata:", user.user_metadata);

      // Update UI
      const userElement = document.getElementById("user-info");
      if (userElement && user) {
        userElement.innerHTML = `
          <h3>Welcome!</h3>
          <p>Email: ${user.email}</p>
          <p>Name: ${user.user_metadata?.full_name || "Not provided"}</p>
          <p>ID: ${user.id}</p>
        `;
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }

  function showHomePage() {
    document.getElementById("Login-page").style.display = "none";
    document.getElementById("user-info").style.display = "block";
    loadUserData();
  }

  function showLoginPage() {
    document.getElementById("Login-page").style.display = "block";
    document.getElementById("user-info").style.display = "none";
  }

  function showError(message) {
    console.error(message);
    alert(message);
  }

  // Session loading is now handled above with proper restoration
});
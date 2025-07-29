import { supabase } from './supabase.js';

// add tab listener when background script starts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('Tab updated:', changeInfo.url);
  console.log('Redirect URL:', chrome.identity.getRedirectURL());
  
  // Check for both extension redirect URL and localhost callback
  if (changeInfo.url?.startsWith(chrome.identity.getRedirectURL()) || 
      changeInfo.url?.startsWith('http://localhost:3000/#access_token=')) {
    console.log('OAuth callback detected!');
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
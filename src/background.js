import { supabase } from './supabase.js';
import { config } from './config.js';
import stringify from 'json-stringify-pretty-compact';

// Context menu setup
let userTemplates = [];
let currentUser = null;

// Initialize context menu when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/loaded');
  await loadUserData(); // Load user data FIRST
  // Context menu will be created by loadUserData() if user is logged in
});

// Listen for user session changes
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && changes.session) {
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
  const { session } = await chrome.storage.local.get(['session']);
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
    console.log('Loading user data...');
    const { session } = await chrome.storage.local.get(['session']);
    
    if (!session) {
      console.log('No session found, creating context menu without templates');
      // Create context menu without templates if user not logged in
      await createContextMenuWithTemplates();
      return;
    }

    console.log('Session found, restoring user session');
    // Set the session in Supabase
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    
    currentUser = user;
    console.log('Current user:', user.email);

    // Load user's templates
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (templatesError) throw templatesError;
    
    userTemplates = templates || [];
    console.log('Loaded templates:', userTemplates.length, 'templates');
    
    // Update context menu after loading templates
    await updateContextMenu();
  } catch (error) {
    console.error('Error loading user data:', error);
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
      chrome.contextMenus.create({
        id: 'prompter-format',
        title: 'Format prompt with Prompter',
        contexts: ['selection']
      }, () => {
        // Parent created, now add children
        if (userTemplates.length > 0) {
          // Add separator
          chrome.contextMenus.create({
            id: 'prompter-separator',
            type: 'separator',
            parentId: 'prompter-format',
            contexts: ['selection']
          });

          // Track templates added
          let templatesAdded = 0;
          
          // Add template options
          userTemplates.forEach((template) => {
            chrome.contextMenus.create({
              id: `template-${template.id}`,
              title: template.name,
              parentId: 'prompter-format',
              contexts: ['selection']
            }, () => {
              templatesAdded++;
              // Resolve when all templates are added
              if (templatesAdded === userTemplates.length) {
                resolve();
              }
            });
          });
        } else {
          // No templates message
          chrome.contextMenus.create({
            id: 'no-templates',
            title: 'No templates available',
            parentId: 'prompter-format',
            contexts: ['selection'],
            enabled: false
          }, resolve);
        }
      });
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
  if (info.menuItemId.startsWith('template-')) {
    const templateId = info.menuItemId.replace('template-', '');
    const selectedText = info.selectionText;
    
    console.log('Context menu clicked for template:', templateId);
    console.log('Current userTemplates count:', userTemplates.length);
    console.log('Current user:', currentUser?.email || 'Not logged in');
    
    // Find the template in current cache
    let template = userTemplates.find(t => t.id === templateId);
    
    // If template not found, try reloading user data (service worker might have restarted)
    if (!template) {
      console.log('Template not found in cache, reloading user data...');
      await loadUserData();
      template = userTemplates.find(t => t.id === templateId);
      console.log('After reload, userTemplates count:', userTemplates.length);
    }
    
    // If still not found, fetch directly from database
    if (!template) {
      console.log('Template still not found, fetching from database...');
      try {
        const { data, error } = await supabase
          .from('templates')
          .select('*')
          .eq('id', templateId)
          .single();
          
        if (error) throw error;
        template = data;
      } catch (error) {
        console.error('Failed to fetch template from database:', error);
        chrome.tabs.sendMessage(tab.id, { 
          action: 'showError', 
          message: 'Template not found. Please refresh and try again.' 
        });
        return;
      }
    }
    
    if (!template) {
      console.error('Template not found:', templateId);
      chrome.tabs.sendMessage(tab.id, { 
        action: 'showError', 
        message: 'Template not found. Please refresh and try again.' 
      });
      return;
    }

    // Send message to content script to show loading
    chrome.tabs.sendMessage(tab.id, { action: 'showLoading' });

    try {
      // Format the text using the template
      const formattedText = await formatTextWithTemplate(selectedText, template, currentUser);
      
      // Send formatted text back to content script
      chrome.tabs.sendMessage(tab.id, { 
        action: 'replaceText', 
        newText: formattedText 
      });

      // Track the formatting request
      await trackFormattingRequest(currentUser.id, templateId, selectedText, formattedText);
      
    } catch (error) {
      console.error('Error formatting text:', error);
      chrome.tabs.sendMessage(tab.id, { 
        action: 'showError', 
        message: 'Failed to format text' 
      });
    }
  }
});

/**
 * Formats the selected text using the specified template
 * @async
 * @param {string} text - The text to format
 * @param {Object} template - The template object containing prompt_template
 * @param {Object} user - The current user object
 * @returns {Promise<string>} The formatted text
 */
async function formatTextWithTemplate(text, template, user) {
  try {
    // Replace placeholder in template with actual text
    const prompt = template.prompt_template.replace('{text}', text);
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: config.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that formats text according to templates. Return only the formatted text without any additional explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: config.maxTokens
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenAI API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    let formattedText = data.choices[0].message.content.trim();
    
    // Debug: Log the raw response (remove in production)
    console.log('OpenAI raw response length:', formattedText.length);
    
    // Try to format JSON if the response looks like JSON
    try {
      // Check if the response starts and ends with JSON brackets/braces
      if ((formattedText.startsWith('{') && formattedText.endsWith('}')) || 
          (formattedText.startsWith('[') && formattedText.endsWith(']'))) {
        const jsonObject = JSON.parse(formattedText);
        
        // Use json-stringify-pretty-compact for better formatting
        formattedText = stringify(jsonObject, {
          maxLength: 80,  // Line length before wrapping
          indent: 2       // 2-space indentation
        });
        console.log('JSON formatted successfully');
      } else {
        console.log('Response does not look like JSON, returning as-is');
      }
    } catch (jsonError) {
      // If it's not valid JSON, just return the original formatted text
      console.log('JSON parsing failed:', jsonError.message);
      console.log('Response is not valid JSON, returning as-is');
    }
    
    return formattedText;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    // Fallback to simple template replacement
    return template.prompt_template.replace('{text}', text);
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
async function trackFormattingRequest(userId, templateId, inputText, outputText) {
  try {
    const { error } = await supabase
      .from('formatting_requests')
      .insert({
        user_id: userId,
        template_id: templateId,
        input_text: inputText,
        output_text: outputText
      });

    if (error) throw error;
    console.log('Tracked formatting request');
  } catch (error) {
    console.error('Error tracking request:', error);
  }
}

// add tab listener when background script starts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only log when there's an actual URL change (not undefined)
  if (changeInfo.url) {
    console.log('Tab updated:', changeInfo.url);
  }
  
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
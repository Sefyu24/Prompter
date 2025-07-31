import { createClient } from '@supabase/supabase-js';
import { chromeStorageAdapter } from './chromeStorageAdapter.js';

const supabaseUrl = "https://audlasqcnqqtfednxmdo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZGxhc3FjbnFxdGZlZG54bWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NDI1MjYsImV4cCI6MjA2OTIxODUyNn0.b1hhLYFxFUyhqVPK2mMDLkkoWvSc-HKkzxYY6Kcub8Y";

/**
 * Supabase client configured with Chrome extension storage adapter
 * 
 * This configuration:
 * - Uses Chrome storage instead of localStorage for session persistence
 * - Enables automatic session management and restoration
 * - Follows Supabase best practices for Chrome extensions
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    debug: false, // Set to true for detailed auth logs
    autoRefreshToken: true,
    detectSessionInUrl: false // We handle OAuth manually
  }
});

export { supabaseUrl, supabaseAnonKey };
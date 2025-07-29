import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://audlasqcnqqtfednxmdo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZGxhc3FjbnFxdGZlZG54bWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2NDI1MjYsImV4cCI6MjA2OTIxODUyNn0.b1hhLYFxFUyhqVPK2mMDLkkoWvSc-HKkzxYY6Kcub8Y";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl, supabaseAnonKey };
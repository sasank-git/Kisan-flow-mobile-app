import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://wcojyyqiueuxwvzblrxz.supabase.co';
const supabasePublishableKey = metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XwNKdlb9bMLA4OGL7YaxLA_GIyd12gr';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase URL or Key is missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

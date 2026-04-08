import { createClient } from '@supabase/supabase-js';

const URL  = import.meta.env.VITE_SUPABASE_URL;
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Primary client — persists session in localStorage
export const sb = createClient(URL, KEY);

// Secondary client — used by admin to create users without replacing the admin session
export const sbAdmin = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

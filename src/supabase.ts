import { createClient } from '@supabase/supabase-js';
import project from './supabase-project.json';

const url = import.meta.env.VITE_SUPABASE_URL || project.url;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || project.publishableKey;

export const isSupabaseConfigured =
  import.meta.env.VITE_DEMO_MODE !== 'true' && Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured ? createClient(url!, publishableKey!) : null;

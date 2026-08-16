import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Falls back to a placeholder project so the app still boots without
// Supabase configured — session persistence is simply unavailable until
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set, everything else in
// The Studio works the same either way.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const STUDIO_AUDIO_BUCKET = 'studio-audio';

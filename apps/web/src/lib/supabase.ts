import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseClient(authToken: string | null): SupabaseClient {
  // Falls back to a placeholder project so the app still boots without
  // Supabase configured — session persistence is simply unavailable until
  // VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set, everything else in
  // The Studio works the same either way.
  const client = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    authToken ? { global: { headers: { Authorization: `Bearer ${authToken}` } } } : undefined
  );
  // The `global.headers` override above only affects REST/Storage fetches —
  // Realtime's websocket connection carries its own auth, so RLS-scoped
  // postgres_changes subscriptions need the JWT set here too.
  if (authToken) client.realtime.setAuth(authToken);
  return client;
}

// Mutable so setSupabaseAuthToken can swap in a SIWE-authenticated client —
// existing `import { supabase } from './supabase'` call sites pick up the
// change automatically since ES module bindings are live references.
export let supabase = createSupabaseClient(null);

/** Attaches (or clears, with `null`) a signed-in wallet's Supabase JWT. */
export function setSupabaseAuthToken(token: string | null) {
  supabase = createSupabaseClient(token);
}

export const STUDIO_AUDIO_BUCKET = 'studio-audio';

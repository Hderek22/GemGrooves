import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client for server-only code (SIWE nonce issuance/
 * verification). Bypasses RLS entirely, so it must never be used from — or
 * have its key exposed to — the browser. VITE_SUPABASE_URL is reused here
 * since the project URL isn't secret; only the service-role key is.
 *
 * This code never uses Realtime, but supabase-js's constructor still checks
 * for a global WebSocket up front (added natively to Node only in v22) and
 * throws if it's missing — so the `ws` package is passed explicitly as the
 * realtime transport to keep this working on whatever Node version actually
 * runs it (local dev is on Node 20; Vercel's runtime may differ).
 */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured on the server (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    // `ws`'s WebSocket type and @supabase/realtime-js's minimal
    // WebSocketLike interface don't line up exactly (event-type
    // mismatches on onerror/onmessage) despite being compatible at
    // runtime — hence the cast.
    realtime: { transport: WebSocket as unknown as never },
  });
  return client;
}

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

import type { SiweNonceRequest, SiweNonceResponse, SiweVerifyRequest, SiweVerifyResponse } from '../lib/siwe-types';
import { setSupabaseAuthToken, supabaseConfigured } from '../lib/supabase';

interface StoredAuth {
  wallet: string;
  token: string;
  expiresAt: number;
}

const STORAGE_KEY = 'gemgrooves.siweAuth';

function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function saveStoredAuth(auth: StoredAuth | null) {
  try {
    if (auth) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (e.g. private mode) — sign-in just won't persist across a reload
  }
}

function decodeJwtExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
  } catch {
    return Date.now() + 24 * 60 * 60 * 1000;
  }
}

function buildSiweMessage(wallet: string, nonce: string, issuedAt: string): string {
  return [
    'GemGrooves wants you to sign in with your Ethereum account:',
    wallet,
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

async function postJson<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as TRes;
}

/**
 * Sign-in-with-Ethereum: proves control of the connected wallet and
 * exchanges that proof for a Supabase-compatible JWT, so RLS policies can
 * key off auth.jwt()->>'sub' instead of trusting a plain wallet-address
 * column. A stored token only ever authenticates the wallet it was issued
 * for — switching or disconnecting accounts requires signing in again.
 */
export function useSiweAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    setSupabaseAuthToken(null);
    saveStoredAuth(null);
    setIsSignedIn(false);
  }, []);

  useEffect(() => {
    if (!address) {
      signOut();
      return;
    }
    const stored = loadStoredAuth();
    if (stored && stored.wallet === address.toLowerCase() && stored.expiresAt > Date.now()) {
      setSupabaseAuthToken(stored.token);
      setIsSignedIn(true);
    } else {
      signOut();
    }
  }, [address, signOut]);

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Connect a wallet first.');
      return;
    }
    if (!supabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }

    setIsSigningIn(true);
    setError(null);
    try {
      const { nonce, issuedAt } = await postJson<SiweNonceRequest, SiweNonceResponse>('/api/siwe-nonce', {
        wallet: address,
      });

      const message = buildSiweMessage(address, nonce, issuedAt);
      const signature = await signMessageAsync({ message });

      const { token } = await postJson<SiweVerifyRequest, SiweVerifyResponse>('/api/siwe-verify', {
        wallet: address,
        message,
        signature,
      });

      setSupabaseAuthToken(token);
      saveStoredAuth({ wallet: address.toLowerCase(), token, expiresAt: decodeJwtExpiryMs(token) });
      setIsSignedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  }, [address, signMessageAsync]);

  return { isSignedIn, isSigningIn, error, signIn, signOut };
}

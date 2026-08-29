import { randomBytes } from 'node:crypto';

import { SignJWT } from 'jose';
import { verifyMessage } from 'viem';

import type { SiweNonceResponse, SiweVerifyResponse } from '../../src/lib/siwe-types';
import { supabaseAdmin } from './supabaseAdmin';

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL = '7d';

export function buildSiweMessage(wallet: string, nonce: string, issuedAt: string): string {
  return [
    'GemGrooves wants you to sign in with your Ethereum account:',
    wallet,
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

export async function issueNonce(wallet: string): Promise<SiweNonceResponse> {
  if (!wallet) throw new Error('wallet is required');

  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  const { error } = await supabaseAdmin()
    .from('siwe_nonces')
    .insert({ nonce, wallet: wallet.toLowerCase(), expires_at: expiresAt });
  if (error) throw new Error(error.message);

  return { nonce, issuedAt };
}

export interface VerifySiweInput {
  wallet: string;
  message: string;
  signature: string;
}

/**
 * Verifies a signed SIWE-style message against its server-issued, single-use
 * nonce, then mints a Supabase-compatible HS256 JWT (sub = lowercased wallet)
 * that RLS policies can key off via auth.jwt()->>'sub'.
 */
export async function verifySiwe({ wallet, message, signature }: VerifySiweInput): Promise<SiweVerifyResponse> {
  if (!wallet || !message || !signature) throw new Error('wallet, message, and signature are required');

  const walletLower = wallet.toLowerCase();
  const nonce = message.match(/^Nonce: (.+)$/m)?.[1];
  if (!nonce) throw new Error('Message is missing a nonce.');

  const db = supabaseAdmin();
  const { data: nonceRow, error: nonceError } = await db
    .from('siwe_nonces')
    .select('wallet, expires_at')
    .eq('nonce', nonce)
    .maybeSingle();
  if (nonceError) throw new Error(nonceError.message);
  if (!nonceRow) throw new Error('Nonce not found or already used — sign in again.');
  if (nonceRow.wallet !== walletLower) throw new Error('Nonce does not match this wallet.');
  if (new Date(nonceRow.expires_at).getTime() < Date.now()) throw new Error('Nonce expired — sign in again.');

  const verified = await verifyMessage({ address: wallet as `0x${string}`, message, signature: signature as `0x${string}` });
  if (!verified) throw new Error('Signature verification failed.');

  // Single-use: only burn the nonce once the signature actually checks out,
  // so a rejected/failed signMessage prompt doesn't force a fresh nonce fetch.
  await db.from('siwe_nonces').delete().eq('nonce', nonce);

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('Server is missing SUPABASE_JWT_SECRET.');

  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(walletLower)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(new TextEncoder().encode(secret));

  return { token };
}

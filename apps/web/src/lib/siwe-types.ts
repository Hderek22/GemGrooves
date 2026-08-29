/** Shared request/response contract for POST /api/siwe-nonce and
 *  POST /api/siwe-verify, used by both the client hook and the server-side
 *  handlers (Vercel functions + Vite dev middleware). No browser- or
 *  Node-only APIs here — safe to import from either side. */
export interface SiweNonceRequest {
  wallet: string;
}

export interface SiweNonceResponse {
  nonce: string;
  issuedAt: string;
}

export interface SiweVerifyRequest {
  wallet: string;
  message: string;
  signature: string;
}

export interface SiweVerifyResponse {
  token: string;
}

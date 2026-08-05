/** Shared request/response contract for POST /api/pin, used by both the
 *  client hook and the server-side pin handler (Vercel function + Vite
 *  dev middleware). No browser- or Node-only APIs here — safe to import
 *  from either side. */
export type PinRequest =
  | { kind: 'file'; filename: string; mimeType: string; dataBase64: string }
  | { kind: 'json'; payload: unknown };

export interface PinResponse {
  uri: string;
}

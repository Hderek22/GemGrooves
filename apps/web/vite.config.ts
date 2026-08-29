import type { IncomingMessage } from 'node:http';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { pin } from './api/_lib/pinata';
import { issueNonce, verifySiwe } from './api/_lib/siwe';
import type { PinRequest } from './src/lib/pin-types';
import type { SiweNonceRequest, SiweVerifyRequest } from './src/lib/siwe-types';

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

// Lets these POST /api/* routes work under plain `vite dev` by reusing the
// exact same handler logic Vercel runs in production via api/*.ts — no
// `vercel dev` needed for local development.
function apiDevMiddleware<T>(path: string, handle: (body: T) => Promise<unknown>): Plugin {
  return {
    name: `gemgrooves-dev-middleware${path.replace(/\//g, '-')}`,
    configureServer(server) {
      server.middlewares.use(path, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const body = await readJsonBody<T>(req);
          const result = await handle(body);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite only auto-loads .env vars into import.meta.env for the client
  // bundle (VITE_-prefixed only). These dev middlewares run server-side and
  // need un-prefixed secrets (PINATA_JWT, SUPABASE_SERVICE_ROLE_KEY,
  // SUPABASE_JWT_SECRET) via plain process.env, which Vite does not
  // populate automatically for a plain-object config — so we load and
  // merge it in ourselves, matching what Vercel's platform does in
  // production.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [
      react(),
      apiDevMiddleware<PinRequest>('/api/pin', (body) => pin(body).then((uri) => ({ uri }))),
      apiDevMiddleware<SiweNonceRequest>('/api/siwe-nonce', (body) => issueNonce(body.wallet)),
      apiDevMiddleware<SiweVerifyRequest>('/api/siwe-verify', (body) => verifySiwe(body)),
    ],
  };
});

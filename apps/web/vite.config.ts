import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { pin } from './api/_lib/pinata';
import type { PinRequest } from './src/lib/pin-types';

// Lets `POST /api/pin` work under plain `vite dev` by reusing the exact
// same pin() logic Vercel runs in production via api/pin.ts — no
// `vercel dev` needed for local development.
function pinDevMiddleware(): Plugin {
  return {
    name: 'gemgrooves-pin-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/pin', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as PinRequest;
          const uri = await pin(body);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ uri }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Pin failed' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite only auto-loads .env vars into import.meta.env for the client
  // bundle (VITE_-prefixed only). pinDevMiddleware runs server-side and
  // needs the un-prefixed PINATA_JWT via plain process.env, which Vite
  // does not populate automatically for a plain-object config — so we
  // load and merge it in ourselves, matching what Vercel's platform does
  // in production.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), pinDevMiddleware()],
  };
});

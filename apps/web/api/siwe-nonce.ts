import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { SiweNonceRequest } from '../src/lib/siwe-types';
import { issueNonce } from './_lib/siwe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { wallet } = req.body as SiweNonceRequest;
    res.status(200).json(await issueNonce(wallet));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not issue nonce' });
  }
}

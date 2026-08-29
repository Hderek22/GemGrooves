import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { SiweVerifyRequest } from '../src/lib/siwe-types';
import { verifySiwe } from './_lib/siwe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { wallet, message, signature } = req.body as SiweVerifyRequest;
    res.status(200).json(await verifySiwe({ wallet, message, signature }));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed' });
  }
}

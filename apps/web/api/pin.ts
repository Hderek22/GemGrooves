import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { PinRequest } from '../src/lib/pin-types';
import { pin } from './_lib/pinata';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const uri = await pin(req.body as PinRequest);
    res.status(200).json({ uri });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Pin failed' });
  }
}

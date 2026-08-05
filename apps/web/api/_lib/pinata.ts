import type { PinRequest } from '../../src/lib/pin-types';

const PINATA_BASE = 'https://api.pinata.cloud';

/**
 * Pins a file or JSON payload to IPFS via Pinata. Requires PINATA_JWT
 * (server-only env var, never shipped to the client).
 *
 * Without a JWT configured, falls back to embedding the content directly
 * as a data: URI — fine for small local/dev test files, not a substitute
 * for real pinning. A warning is logged so this is never silently mistaken
 * for the real thing.
 */
export async function pin(request: PinRequest): Promise<string> {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    console.warn(
      '[pin] PINATA_JWT is not set — using an embedded data: URI fallback. ' +
        'Fine for small local/dev files; set PINATA_JWT for real IPFS pinning.'
    );
    return devFallback(request);
  }

  if (request.kind === 'file') {
    const buffer = Buffer.from(request.dataBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: request.mimeType }), request.filename);

    const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Pinata pinFileToIPFS failed: ${res.status}`);
    const data = (await res.json()) as { IpfsHash: string };
    return `ipfs://${data.IpfsHash}`;
  }

  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pinataContent: request.payload }),
  });
  if (!res.ok) throw new Error(`Pinata pinJSONToIPFS failed: ${res.status}`);
  const data = (await res.json()) as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

function devFallback(request: PinRequest): string {
  if (request.kind === 'file') {
    return `data:${request.mimeType};base64,${request.dataBase64}`;
  }
  const base64 = Buffer.from(JSON.stringify(request.payload)).toString('base64');
  return `data:application/json;base64,${base64}`;
}

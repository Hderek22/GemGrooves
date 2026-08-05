export type { PinRequest, PinResponse } from './pin-types';

const DEFAULT_GATEWAY = 'https://ipfs.io/ipfs/';

/** Resolves an ipfs:// URI to an HTTP gateway URL. Non-ipfs URIs (https://, data:, ...) pass through unchanged. */
export function resolveIpfsUri(uri: string): string {
  if (!uri.startsWith('ipfs://')) return uri;
  const gateway = import.meta.env.VITE_IPFS_GATEWAY || DEFAULT_GATEWAY;
  const path = uri.slice('ipfs://'.length);
  return gateway.replace(/\/?$/, '/') + path;
}

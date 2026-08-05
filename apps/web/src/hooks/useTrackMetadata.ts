import { useQuery } from '@tanstack/react-query';

import { resolveIpfsUri } from '../lib/ipfs';

export interface TrackMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  artist?: string;
}

export function useTrackMetadata(tokenURI: string | undefined) {
  return useQuery({
    queryKey: ['track-metadata', tokenURI],
    queryFn: async (): Promise<TrackMetadata> => {
      const res = await fetch(resolveIpfsUri(tokenURI as string));
      if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(tokenURI),
    staleTime: Infinity,
  });
}

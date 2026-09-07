import type { Address } from 'viem';
import { useEnsAddress, useEnsAvatar, useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { ensConfig } from '../lib/ensConfig';

// Resolves an address's ENS name + avatar, always against mainnet (see
// ensConfig.ts) regardless of which chain the wallet is actually connected
// to.
export function useEnsProfile(address?: Address) {
  const nameQuery = useEnsName({
    address,
    chainId: mainnet.id,
    config: ensConfig,
    query: { enabled: Boolean(address) },
  });

  const avatarQuery = useEnsAvatar({
    name: nameQuery.data ?? undefined,
    chainId: mainnet.id,
    config: ensConfig,
    query: { enabled: Boolean(nameQuery.data) },
  });

  return { ensName: nameQuery.data ?? undefined, ensAvatar: avatarQuery.data ?? undefined };
}

const ENS_NAME_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i;

export function looksLikeEnsName(value: string) {
  return ENS_NAME_PATTERN.test(value.trim());
}

// Resolves a typed *.eth name to an address, for form fields that should
// accept either a raw address or an ENS name.
export function useEnsAddressLookup(value: string) {
  const name = value.trim();
  const isEnsName = looksLikeEnsName(name);

  const query = useEnsAddress({
    name,
    chainId: mainnet.id,
    config: ensConfig,
    query: { enabled: isEnsName },
  });

  return {
    isEnsName,
    resolvedAddress: (query.data ?? undefined) as Address | undefined,
    isResolving: isEnsName && query.isLoading,
    notFound: isEnsName && query.isFetched && !query.data,
  };
}

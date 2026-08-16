import { useMemo } from 'react';
import type { Address } from 'viem';
import { useChainId, useReadContract, useReadContracts } from 'wagmi';

import { deployments, gemGroovesNftAbi } from '../config/contracts.generated';

export interface OwnedTrack {
  tokenId: bigint;
  tokenURI: string;
}

export function useOwnedTracks(owner: Address | undefined) {
  const chainId = useChainId();
  const deployment = deployments[chainId];

  const { data: totalSupply, isLoading: totalSupplyLoading } = useReadContract({
    address: deployment?.nft,
    abi: gemGroovesNftAbi,
    functionName: 'totalSupply',
    chainId,
    query: { enabled: Boolean(deployment) },
  });

  const tokenIds = useMemo(
    () => (totalSupply !== undefined ? Array.from({ length: Number(totalSupply) }, (_, i) => BigInt(i)) : []),
    [totalSupply]
  );

  const { data: ownerData, isLoading: ownerLoading } = useReadContracts({
    contracts: deployment
      ? tokenIds.map(
          (tokenId) =>
            ({
              address: deployment.nft,
              abi: gemGroovesNftAbi,
              functionName: 'ownerOf',
              args: [tokenId],
              chainId,
            }) as const
        )
      : [],
    query: { enabled: tokenIds.length > 0 && Boolean(deployment) && Boolean(owner) },
  });

  const ownedTokenIds = useMemo(() => {
    if (!ownerData || !owner) return [];
    return tokenIds.filter((_tokenId, i) => {
      const result = ownerData[i];
      return result?.status === 'success' && (result.result as Address).toLowerCase() === owner.toLowerCase();
    });
  }, [ownerData, tokenIds, owner]);

  const { data: tokenUriData, isLoading: tokenUriLoading } = useReadContracts({
    contracts: deployment
      ? ownedTokenIds.map(
          (tokenId) =>
            ({
              address: deployment.nft,
              abi: gemGroovesNftAbi,
              functionName: 'tokenURI',
              args: [tokenId],
              chainId,
            }) as const
        )
      : [],
    query: { enabled: ownedTokenIds.length > 0 && Boolean(deployment) },
  });

  const ownedTracks: OwnedTrack[] = useMemo(
    () =>
      ownedTokenIds.map((tokenId, i) => {
        const uriResult = tokenUriData?.[i];
        const tokenURI = uriResult?.status === 'success' ? (uriResult.result as string) : '';
        return { tokenId, tokenURI };
      }),
    [ownedTokenIds, tokenUriData]
  );

  const isLoading =
    Boolean(deployment) &&
    Boolean(owner) &&
    (totalSupplyLoading || (tokenIds.length > 0 && ownerLoading) || (ownedTokenIds.length > 0 && tokenUriLoading));

  return { ownedTracks, isLoading, deploymentMissing: !deployment };
}

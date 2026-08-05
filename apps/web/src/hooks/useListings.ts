import { useMemo } from 'react';
import { zeroAddress, type Address } from 'viem';
import { useChainId, useReadContract, useReadContracts } from 'wagmi';

import {
  deployments,
  erc20MinimalAbi,
  gemGroovesMarketplaceAbi,
  gemGroovesNftAbi,
} from '../config/contracts.generated';

export interface TrackListing {
  tokenId: bigint;
  seller: Address;
  priceWei: bigint;
  payToken: Address;
  payTokenSymbol: string;
  payTokenDecimals: number;
  splitter: Address;
  tokenURI: string;
}

export function useListings() {
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

  const { data: listingsData, isLoading: listingsLoading } = useReadContracts({
    contracts: deployment
      ? tokenIds.map(
          (tokenId) =>
            ({
              address: deployment.marketplace,
              abi: gemGroovesMarketplaceAbi,
              functionName: 'listings',
              args: [tokenId],
              chainId,
            }) as const
        )
      : [],
    query: { enabled: tokenIds.length > 0 && Boolean(deployment) },
  });

  const { data: tokenUriData, isLoading: tokenUriLoading } = useReadContracts({
    contracts: deployment
      ? tokenIds.map(
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
    query: { enabled: tokenIds.length > 0 && Boolean(deployment) },
  });

  const activeRaw = useMemo(() => {
    if (!listingsData) return [];
    return tokenIds
      .map((tokenId, i) => {
        const result = listingsData[i];
        if (!result || result.status !== 'success') return null;
        const [seller, priceWei, payToken, splitter, active] = result.result as [
          Address,
          bigint,
          Address,
          Address,
          boolean,
        ];
        if (!active) return null;
        const uriResult = tokenUriData?.[i];
        const tokenURI = uriResult?.status === 'success' ? (uriResult.result as string) : '';
        return { tokenId, seller, priceWei, payToken, splitter, tokenURI };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [listingsData, tokenUriData, tokenIds]);

  const uniquePayTokens = useMemo(
    () => Array.from(new Set(activeRaw.map((l) => l.payToken).filter((t) => t !== zeroAddress))),
    [activeRaw]
  );

  const { data: payTokenMetaData, isLoading: payTokenMetaLoading } = useReadContracts({
    contracts: uniquePayTokens.flatMap(
      (token) =>
        [
          { address: token, abi: erc20MinimalAbi, functionName: 'symbol', chainId },
          { address: token, abi: erc20MinimalAbi, functionName: 'decimals', chainId },
        ] as const
    ),
    query: { enabled: uniquePayTokens.length > 0 },
  });

  const payTokenInfo = useMemo(() => {
    const map = new Map<Address, { symbol: string; decimals: number }>();
    uniquePayTokens.forEach((token, i) => {
      const symbolResult = payTokenMetaData?.[i * 2];
      const decimalsResult = payTokenMetaData?.[i * 2 + 1];
      map.set(token, {
        symbol: symbolResult?.status === 'success' ? (symbolResult.result as string) : '???',
        decimals: decimalsResult?.status === 'success' ? (decimalsResult.result as number) : 18,
      });
    });
    return map;
  }, [uniquePayTokens, payTokenMetaData]);

  const listings: TrackListing[] = useMemo(
    () =>
      activeRaw.map((l) => ({
        ...l,
        payTokenSymbol: l.payToken === zeroAddress ? 'ETH' : (payTokenInfo.get(l.payToken)?.symbol ?? '???'),
        payTokenDecimals: l.payToken === zeroAddress ? 18 : (payTokenInfo.get(l.payToken)?.decimals ?? 18),
      })),
    [activeRaw, payTokenInfo]
  );

  const isLoading = Boolean(deployment) && (
    totalSupplyLoading ||
    (tokenIds.length > 0 && (listingsLoading || tokenUriLoading || payTokenMetaLoading))
  );

  return { listings, isLoading, deploymentMissing: !deployment };
}

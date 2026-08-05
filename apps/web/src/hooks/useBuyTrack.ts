import { useCallback, useState } from 'react';
import { zeroAddress } from 'viem';
import { useAccount, useChainId, usePublicClient, useWriteContract } from 'wagmi';

import { deployments, erc20MinimalAbi, gemGroovesMarketplaceAbi } from '../config/contracts.generated';
import type { TrackListing } from './useListings';

export type BuyState = 'idle' | 'approving' | 'buying' | 'success' | 'error';

export function useBuyTrack() {
  const chainId = useChainId();
  const { address } = useAccount();
  const deployment = deployments[chainId];
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId });

  const [state, setState] = useState<BuyState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const buyTrack = useCallback(
    async (listing: TrackListing) => {
      setError(null);

      if (!deployment) {
        const err = new Error('No contract deployment for the current network');
        setState('error');
        setError(err);
        throw err;
      }
      if (!address || !publicClient) {
        const err = new Error('Connect your wallet first');
        setState('error');
        setError(err);
        throw err;
      }

      try {
        if (listing.payToken === zeroAddress) {
          setState('buying');
          const hash = await writeContractAsync({
            address: deployment.marketplace,
            abi: gemGroovesMarketplaceAbi,
            functionName: 'buyWithETH',
            args: [listing.tokenId],
            value: listing.priceWei,
            chainId,
          });
          await publicClient.waitForTransactionReceipt({ hash });
        } else {
          const allowance = await publicClient.readContract({
            address: listing.payToken,
            abi: erc20MinimalAbi,
            functionName: 'allowance',
            args: [address, deployment.marketplace],
          });

          if (allowance < listing.priceWei) {
            setState('approving');
            const approveHash = await writeContractAsync({
              address: listing.payToken,
              abi: erc20MinimalAbi,
              functionName: 'approve',
              args: [deployment.marketplace, listing.priceWei],
              chainId,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }

          setState('buying');
          const hash = await writeContractAsync({
            address: deployment.marketplace,
            abi: gemGroovesMarketplaceAbi,
            functionName: 'buyWithToken',
            args: [listing.tokenId, listing.payToken],
            chainId,
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
        setState('success');
      } catch (err) {
        setState('error');
        const wrapped = err instanceof Error ? err : new Error('Purchase failed');
        setError(wrapped);
        throw wrapped;
      }
    },
    [deployment, address, publicClient, writeContractAsync, chainId]
  );

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  return { buyTrack, state, error, reset };
}

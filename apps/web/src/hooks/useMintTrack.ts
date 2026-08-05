import { useCallback } from 'react';
import type { Address } from 'viem';
import { useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import { deployments, gemGroovesMarketplaceAbi } from '../config/contracts.generated';

export interface MintTrackInput {
  tokenURI: string;
  royaltyBPS: number;
  wallets: Address[];
  sharesBPS: number[];
  priceWei: bigint;
  payToken: Address;
}

export function useMintTrack() {
  const chainId = useChainId();
  const deployment = deployments[chainId];
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });

  const mintTrack = useCallback(
    async (input: MintTrackInput) => {
      if (!deployment) throw new Error('No contract deployment for the current network');
      return writeContractAsync({
        address: deployment.marketplace,
        abi: gemGroovesMarketplaceAbi,
        functionName: 'listTrack',
        args: [
          input.tokenURI,
          BigInt(input.royaltyBPS),
          input.wallets,
          input.sharesBPS.map(BigInt),
          input.priceWei,
          input.payToken,
        ],
        chainId,
      });
    },
    [deployment, chainId, writeContractAsync]
  );

  return {
    mintTrack,
    hash,
    receipt,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
    deploymentMissing: !deployment,
  };
}

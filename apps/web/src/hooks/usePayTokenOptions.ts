import { zeroAddress, type Address } from 'viem';
import { useChainId, useReadContracts } from 'wagmi';

import { deployments, erc20MinimalAbi } from '../config/contracts.generated';

export interface PayTokenOption {
  label: string;
  address: Address;
  decimals: number;
}

const ETH_OPTION: PayTokenOption = { label: 'ETH', address: zeroAddress, decimals: 18 };

export function usePayTokenOptions() {
  const chainId = useChainId();
  const deployment = deployments[chainId];
  const tokens = deployment ? [deployment.usdc, deployment.dai] : [];

  const { data, isLoading } = useReadContracts({
    contracts: tokens.flatMap(
      (token) =>
        [
          { address: token, abi: erc20MinimalAbi, functionName: 'symbol', chainId },
          { address: token, abi: erc20MinimalAbi, functionName: 'decimals', chainId },
        ] as const
    ),
    query: { enabled: tokens.length > 0 },
  });

  const options: PayTokenOption[] = [ETH_OPTION];
  tokens.forEach((token, i) => {
    const symbolResult = data?.[i * 2];
    const decimalsResult = data?.[i * 2 + 1];
    const fallbackLabel = i === 0 ? 'USDC' : 'DAI';
    options.push({
      label: symbolResult?.status === 'success' ? (symbolResult.result as string) : fallbackLabel,
      address: token,
      decimals: decimalsResult?.status === 'success' ? (decimalsResult.result as number) : 18,
    });
  });

  return { options, isLoading: tokens.length > 0 && isLoading };
}

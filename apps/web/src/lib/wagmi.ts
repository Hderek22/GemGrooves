import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia, hardhat } from 'wagmi/chains';

// Falls back to a placeholder so local dev works without a WalletConnect
// Cloud project — browser-extension wallets (MetaMask, etc.) still connect
// fine; only the WalletConnect QR/mobile flow needs a real project ID.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'gemgrooves-dev-placeholder';

// hardhat (chain 31337) is dev-only, first so reads default to it even
// before a wallet connects — matches a local `npx hardhat node`.
export const wagmiConfig = getDefaultConfig({
  appName: 'GemGrooves',
  projectId,
  chains: import.meta.env.DEV ? [hardhat, baseSepolia, base] : [baseSepolia, base],
  ssr: false,
});

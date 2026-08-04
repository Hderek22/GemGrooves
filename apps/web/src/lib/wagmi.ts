import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

// Falls back to a placeholder so local dev works without a WalletConnect
// Cloud project — browser-extension wallets (MetaMask, etc.) still connect
// fine; only the WalletConnect QR/mobile flow needs a real project ID.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'gemgrooves-dev-placeholder';

export const wagmiConfig = getDefaultConfig({
  appName: 'GemGrooves',
  projectId,
  chains: [baseSepolia, base],
  ssr: false,
});

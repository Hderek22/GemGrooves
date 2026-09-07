import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';

// ENS records live on Ethereum mainnet regardless of which chain the app
// otherwise talks to (hardhat in dev, base/baseSepolia in prod) — this
// separate read-only config keeps mainnet out of the wallet-connect chain
// list (wagmi.ts) while still letting ENS hooks resolve against it by
// passing `config: ensConfig` explicitly.
export const ensConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

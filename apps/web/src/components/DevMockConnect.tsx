import type { Address } from 'viem';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { mock } from 'wagmi/connectors';

// Dev-only: connects wagmi's `mock` connector to one of the local Hardhat
// node's default (unlocked) accounts. eth_sendTransaction for that address
// gets forwarded straight to the node's RPC, which signs it itself — so
// wallet-gated flows (The Studio, buying, ...) are drivable end-to-end via
// Playwright or by hand, with no real browser wallet extension needed.
// Rendered only when import.meta.env.DEV.
const HARDHAT_ACCOUNT_1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

function DevMockConnect() {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button type="button" onClick={() => disconnect()}>
        Dev: disconnect mock
      </button>
    );
  }

  return (
    <button type="button" onClick={() => connect({ connector: mock({ accounts: [HARDHAT_ACCOUNT_1] }) })}>
      Dev: connect mock wallet
    </button>
  );
}

export default DevMockConnect;

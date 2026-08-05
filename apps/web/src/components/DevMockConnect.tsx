import type { Address } from 'viem';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { mock } from 'wagmi/connectors';

// Dev-only: connects wagmi's `mock` connector to one of the local Hardhat
// node's default (unlocked) accounts. eth_sendTransaction for that address
// gets forwarded straight to the node's RPC, which signs it itself — so
// wallet-gated flows (The Studio, buying, ...) are drivable end-to-end via
// Playwright or by hand, with no real browser wallet extension needed.
// Two accounts are offered so buyer/seller flows can be tested against
// each other. Rendered only when import.meta.env.DEV.
const HARDHAT_ACCOUNTS: { label: string; address: Address }[] = [
  { label: 'Dev: connect Account #0', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
  { label: 'Dev: connect Account #1', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
];

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function DevMockConnect() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button type="button" onClick={() => disconnect()}>
        Dev: disconnect mock ({address ? truncate(address) : ''})
      </button>
    );
  }

  return (
    <>
      {HARDHAT_ACCOUNTS.map((account) => (
        <button
          key={account.address}
          type="button"
          onClick={() => connect({ connector: mock({ accounts: [account.address] }) })}
        >
          {account.label}
        </button>
      ))}
    </>
  );
}

export default DevMockConnect;

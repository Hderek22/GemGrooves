import { ConnectButton } from '@rainbow-me/rainbowkit';

function ConnectWalletButton() {
  return <ConnectButton showBalance={false} chainStatus="icon" />;
}

export default ConnectWalletButton;

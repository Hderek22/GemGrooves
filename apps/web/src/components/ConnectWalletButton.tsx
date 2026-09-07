import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import { useDisconnect } from 'wagmi';

import { useEnsProfile } from '../hooks/useEns';
import classes from './ConnectWalletButton.module.css';

interface ConnectedMenuProps {
  address: Address;
  displayName: string;
  chainName?: string;
  chainIconUrl?: string;
  onOpenChainModal: () => void;
}

// Split out from ConnectWalletButton so useEnsProfile (and the dropdown's
// own state) live on a stable component instance, not inside RainbowKit's
// ConnectButton.Custom render-prop branches — calling hooks there would
// attach them to ConnectButtonRenderer's fiber instead of this component's.
function ConnectedMenu({ address, displayName, chainName, chainIconUrl, onOpenChainModal }: ConnectedMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { disconnect } = useDisconnect();
  const { ensName, ensAvatar } = useEnsProfile(address);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const label = ensName ?? displayName;

  return (
    <div className={classes.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={classes.trigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {ensAvatar ? (
          <img className={classes.avatar} src={ensAvatar} alt="" />
        ) : (
          chainIconUrl && <img className={classes.chainIcon} src={chainIconUrl} alt="" />
        )}
        {label}
        <span className={classes.caret}>▾</span>
      </button>
      {isOpen && (
        <div className={classes.menu} role="menu">
          {ensName && <div className={classes.menuAddress}>{displayName}</div>}
          <button
            type="button"
            role="menuitem"
            className={classes.menuItem}
            onClick={() => {
              navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied!' : 'Copy address'}
          </button>
          <button
            type="button"
            role="menuitem"
            className={classes.menuItem}
            onClick={() => {
              setIsOpen(false);
              onOpenChainModal();
            }}
          >
            Network: {chainName}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${classes.menuItem} ${classes.disconnect}`}
            onClick={() => {
              setIsOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted }) => {
        if (!mounted) {
          return <div aria-hidden="true" style={{ opacity: 0, pointerEvents: 'none' }} />;
        }

        if (!account || !chain) {
          return (
            <button type="button" className={classes.trigger} onClick={openConnectModal}>
              Connect
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              className={`${classes.trigger} ${classes.wrongNetwork}`}
              onClick={openChainModal}
            >
              Wrong network
            </button>
          );
        }

        return (
          <ConnectedMenu
            address={account.address as Address}
            displayName={account.displayName}
            chainName={chain.name}
            chainIconUrl={chain.hasIcon ? chain.iconUrl : undefined}
            onOpenChainModal={openChainModal}
          />
        );
      }}
    </ConnectButton.Custom>
  );
}

export default ConnectWalletButton;

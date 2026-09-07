import { useEffect } from 'react';
import type { Address } from 'viem';

import { useEnsAddressLookup } from '../hooks/useEns';
import buttons from '../styles/buttons.module.css';
import classes from './CoCreatorRow.module.css';

interface CoCreatorRowProps {
  wallet: string;
  sharePercent: number;
  canRemove: boolean;
  onChangeWallet: (wallet: string) => void;
  onChangeShare: (sharePercent: number) => void;
  onRemove: () => void;
  onResolvedAddress: (address: Address | undefined) => void;
}

// One row of the mint form's royalty-split table. Accepts either a raw 0x
// address or an ENS name (e.g. "vitalik.eth") in the wallet field — a name
// is resolved here and reported up via onResolvedAddress so the form can
// mint against the real address while still displaying what was typed.
function CoCreatorRow({
  wallet,
  sharePercent,
  canRemove,
  onChangeWallet,
  onChangeShare,
  onRemove,
  onResolvedAddress,
}: CoCreatorRowProps) {
  const { isEnsName, resolvedAddress, isResolving, notFound } = useEnsAddressLookup(wallet);

  useEffect(() => {
    onResolvedAddress(isEnsName ? resolvedAddress : undefined);
  }, [isEnsName, resolvedAddress, onResolvedAddress]);

  return (
    <div>
      <div className={classes.row}>
        <input
          type="text"
          placeholder="0x… or name.eth"
          value={wallet}
          onChange={(e) => onChangeWallet(e.target.value)}
        />
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={sharePercent}
          onChange={(e) => onChangeShare(Number(e.target.value))}
        />
        <button type="button" className={buttons.pillOutline} onClick={onRemove} disabled={!canRemove}>
          &minus;
        </button>
      </div>
      {isEnsName && (
        <p className={notFound ? classes.hintError : classes.hint}>
          {isResolving
            ? 'Resolving…'
            : resolvedAddress
              ? `→ ${resolvedAddress}`
              : `Couldn't resolve "${wallet}"`}
        </p>
      )}
    </div>
  );
}

export default CoCreatorRow;

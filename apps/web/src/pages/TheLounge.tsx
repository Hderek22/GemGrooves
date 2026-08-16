import { useState } from 'react';
import { useAccount } from 'wagmi';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import OwnedTrackCard from '../components/OwnedTrackCard';
import { useOwnedTracks } from '../hooks/useOwnedTracks';
import layout from '../styles/layout.module.css';
import styles from './TheLounge.module.css';

function TheLounge() {
  const { address, isConnected } = useAccount();
  const { ownedTracks, isLoading, deploymentMissing } = useOwnedTracks(address);
  const [playingTokenId, setPlayingTokenId] = useState<bigint | null>(null);

  if (!isConnected) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>Connect your wallet above to see your GemGrooves.</p>
      </div>
    );
  }

  if (deploymentMissing) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>Switch to a supported network to see your GemGrooves.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={layout.centered}>
        <p className={styles.hint}>Loading your collection…</p>
      </div>
    );
  }

  if (ownedTracks.length === 0) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>
          You don't own any GemGrooves yet — mint one in The Studio or pick one up in The Record Shop.
        </p>
      </div>
    );
  }

  return (
    <div className={layout.centered}>
      <div className={styles.grid}>
        {ownedTracks.map((track) => (
          <OwnedTrackCard
            key={track.tokenId.toString()}
            track={track}
            isPlaying={playingTokenId === track.tokenId}
            onTogglePlay={() =>
              setPlayingTokenId((current) => (current === track.tokenId ? null : track.tokenId))
            }
            onEnded={() => setPlayingTokenId(null)}
          />
        ))}
      </div>
    </div>
  );
}

export default TheLounge;

import { useEffect, useRef } from 'react';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import type { OwnedTrack } from '../hooks/useOwnedTracks';
import { useTrackMetadata } from '../hooks/useTrackMetadata';
import { resolveIpfsUri } from '../lib/ipfs';
import buttons from '../styles/buttons.module.css';
import styles from './TrackCard.module.css';

interface OwnedTrackCardProps {
  track: OwnedTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onEnded: () => void;
}

function OwnedTrackCard({ track, isPlaying, onTogglePlay, onEnded }: OwnedTrackCardProps) {
  const { data: metadata, isLoading } = useTrackMetadata(track.tokenURI);
  const audioRef = useRef<HTMLAudioElement>(null);

  const title = metadata?.name ?? `Track #${track.tokenId}`;
  const artist = metadata?.artist ?? 'Unknown artist';
  const image = metadata?.image ? resolveIpfsUri(metadata.image) : gemGrooveThumb;
  const audioSrc = metadata?.animation_url ? resolveIpfsUri(metadata.animation_url) : undefined;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) void el.play();
    else el.pause();
  }, [isPlaying]);

  return (
    <article className={styles.card}>
      <img src={image} alt={title} className={styles.art} />
      <h3 className={styles.title}>{isLoading ? 'Loading…' : title}</h3>
      <p className={styles.artist}>{artist}</p>
      {audioSrc && <audio ref={audioRef} src={audioSrc} onEnded={onEnded} />}
      <button type="button" className={buttons.pill} onClick={onTogglePlay} disabled={!audioSrc}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </article>
  );
}

export default OwnedTrackCard;

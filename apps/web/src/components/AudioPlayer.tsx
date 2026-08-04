import type { RefObject } from 'react';

import buttons from '../styles/buttons.module.css';
import styles from './AudioPlayer.module.css';

interface AudioPlayerProps {
  file: File | null;
  objectUrl: string | null;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement>;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onClear: () => void;
  emptyLabel: string;
}

function AudioPlayer({
  file,
  objectUrl,
  isPlaying,
  audioRef,
  onPlay,
  onPause,
  onStop,
  onClear,
  emptyLabel,
}: AudioPlayerProps) {
  if (!file || !objectUrl) {
    return <p className={styles.hint}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.player}>
      <p className={styles.nowPlaying}>Now playing: {file.name}</p>
      <audio ref={audioRef} src={objectUrl} />
      <div className={styles.controls}>
        <button type="button" className={buttons.pill} onClick={onPlay} disabled={isPlaying}>
          Play
        </button>
        <button type="button" className={buttons.pill} onClick={onPause} disabled={!isPlaying}>
          Pause
        </button>
        <button type="button" className={buttons.pill} onClick={onStop}>
          Stop
        </button>
        <button type="button" className={buttons.pillOutline} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

export default AudioPlayer;

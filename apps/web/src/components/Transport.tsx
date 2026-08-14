import { useRef, type ChangeEvent } from 'react';

import buttons from '../styles/buttons.module.css';
import styles from './Transport.module.css';

interface TransportProps {
  isPlaying: boolean;
  isRecording: boolean;
  currentTime: number;
  durationSec: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecordToggle: () => void;
  onAddFile: (file: File) => void;
  onDownloadMix: () => void;
  canDownloadMix: boolean;
  isDownloadingMix: boolean;
  micError?: string;
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Transport({
  isPlaying,
  isRecording,
  currentTime,
  durationSec,
  onPlay,
  onPause,
  onStop,
  onRecordToggle,
  onAddFile,
  onDownloadMix,
  canDownloadMix,
  isDownloadingMix,
  micError,
}: TransportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAddFile(file);
    event.target.value = '';
  };

  return (
    <div className={styles.transport}>
      <div className={styles.buttons}>
        <button type="button" className={buttons.pill} onClick={onPlay} disabled={isPlaying}>
          Play
        </button>
        <button type="button" className={buttons.pillOutline} onClick={onPause} disabled={!isPlaying}>
          Pause
        </button>
        <button type="button" className={buttons.pillOutline} onClick={onStop}>
          Stop
        </button>
        <button
          type="button"
          className={isRecording ? styles.recordActive : styles.recordButton}
          onClick={onRecordToggle}
        >
          {isRecording ? 'Stop recording' : '● Record'}
        </button>
        <button type="button" className={buttons.pillOutline} onClick={() => fileInputRef.current?.click()}>
          + Add track
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
        <button
          type="button"
          className={buttons.pillOutline}
          onClick={onDownloadMix}
          disabled={!canDownloadMix || isDownloadingMix}
        >
          {isDownloadingMix ? 'Rendering…' : '⇩ Download mix'}
        </button>
        <span className={styles.time}>
          {formatTime(currentTime)} / {formatTime(durationSec)}
        </span>
      </div>
      {micError && <p className={styles.error}>{micError}</p>}
    </div>
  );
}

export default Transport;

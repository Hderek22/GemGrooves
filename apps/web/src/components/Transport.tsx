import { useRef, type ChangeEvent } from 'react';

import buttons from '../styles/buttons.module.css';
import styles from './Transport.module.css';

interface TransportProps {
  isPlaying: boolean;
  isRecording: boolean;
  isCountingIn: boolean;
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
  bpm: number;
  onBpmChange: (bpm: number) => void;
  countInEnabled: boolean;
  onCountInEnabledChange: (enabled: boolean) => void;
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
  isCountingIn,
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
  bpm,
  onBpmChange,
  countInEnabled,
  onCountInEnabledChange,
  micError,
}: TransportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = isCountingIn;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onAddFile(file);
    event.target.value = '';
  };

  return (
    <div className={styles.transport}>
      <div className={styles.buttons}>
        <button type="button" className={buttons.pill} onClick={onPlay} disabled={isPlaying || busy}>
          Play
        </button>
        <button type="button" className={buttons.pillOutline} onClick={onPause} disabled={!isPlaying || busy}>
          Pause
        </button>
        <button type="button" className={buttons.pillOutline} onClick={onStop} disabled={busy}>
          Stop
        </button>
        <button
          type="button"
          className={isRecording || isCountingIn ? styles.recordActive : styles.recordButton}
          onClick={onRecordToggle}
          disabled={isCountingIn}
        >
          {isCountingIn ? 'Counting in…' : isRecording ? 'Stop recording' : '● Record'}
        </button>
        <button
          type="button"
          className={buttons.pillOutline}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          + Add track
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileChange} />
        <button
          type="button"
          className={buttons.pillOutline}
          onClick={onDownloadMix}
          disabled={!canDownloadMix || isDownloadingMix || busy}
        >
          {isDownloadingMix ? 'Rendering…' : '⇩ Download mix'}
        </button>
        <span className={styles.time}>
          {formatTime(currentTime)} / {formatTime(durationSec)}
        </span>
      </div>
      <div className={styles.metronome}>
        <label className={styles.countInToggle}>
          <input
            type="checkbox"
            checked={countInEnabled}
            onChange={(event) => onCountInEnabledChange(event.target.checked)}
          />
          Count-in
        </label>
        <label className={styles.bpmField}>
          <input
            type="number"
            min={40}
            max={300}
            value={bpm}
            onChange={(event) => onBpmChange(Number(event.target.value))}
            disabled={!countInEnabled}
          />
          BPM
        </label>
      </div>
      {micError && <p className={styles.error}>{micError}</p>}
    </div>
  );
}

export default Transport;

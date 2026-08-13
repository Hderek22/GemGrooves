import type { StudioTrack, TrackPatch } from '../hooks/useMultiTrackSession';
import buttons from '../styles/buttons.module.css';
import styles from './TrackRow.module.css';
import Waveform from './Waveform';

interface TrackRowProps {
  track: StudioTrack;
  onUpdate: (patch: TrackPatch) => void;
  onRemove: () => void;
}

function TrackRow({ track, onUpdate, onRemove }: TrackRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        <input
          className={styles.name}
          value={track.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
        <span className={styles.duration}>{track.durationSec.toFixed(1)}s</span>
      </div>

      <div className={styles.waveform}>
        <Waveform buffer={track.buffer} />
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={track.muted ? styles.toggleActive : styles.toggle}
          onClick={() => onUpdate({ muted: !track.muted })}
          title="Mute"
        >
          M
        </button>
        <button
          type="button"
          className={track.solo ? styles.toggleActive : styles.toggle}
          onClick={() => onUpdate({ solo: !track.solo })}
          title="Solo"
        >
          S
        </button>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.01}
          value={track.gain}
          onChange={(event) => onUpdate({ gain: Number(event.target.value) })}
          title="Volume"
        />
        <button type="button" className={buttons.pillOutline} onClick={onRemove} title="Remove track">
          &minus;
        </button>
      </div>
    </div>
  );
}

export default TrackRow;

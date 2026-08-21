import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

import type { StudioTrack, TrackPatch } from '../hooks/useMultiTrackSession';
import buttons from '../styles/buttons.module.css';
import styles from './TrackRow.module.css';
import Waveform from './Waveform';

interface TrackRowProps {
  track: StudioTrack;
  pxPerSec: number;
  timelineWidthSec: number;
  headerWidthPx: number;
  draggable: boolean;
  onUpdate: (patch: TrackPatch) => void;
  onRemove: () => void;
}

function TrackRow({
  track,
  pxPerSec,
  timelineWidthSec,
  headerWidthPx,
  draggable,
  onUpdate,
  onRemove,
}: TrackRowProps) {
  const dragState = useRef<{ startClientX: number; startOffsetSec: number } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { startClientX: event.clientX, startOffsetSec: track.offsetSec };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const deltaSec = (event.clientX - dragState.current.startClientX) / pxPerSec;
    onUpdate({ offsetSec: Math.max(0, dragState.current.startOffsetSec + deltaSec) });
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  return (
    <div className={styles.row}>
      <div className={styles.header} style={{ width: headerWidthPx }}>
        <input
          className={styles.name}
          value={track.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
        <span className={styles.duration}>
          {track.durationSec.toFixed(1)}s @ {track.offsetSec.toFixed(1)}s
        </span>
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
          <button
            type="button"
            className={track.looped ? styles.toggleActive : styles.toggle}
            onClick={() => onUpdate({ looped: !track.looped })}
            title="Loop pedal: repeat this track while you dub over it"
          >
            🔁
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

      <div className={styles.lane} style={{ width: timelineWidthSec * pxPerSec }}>
        <div
          className={[
            draggable ? styles.clip : styles.clipLocked,
            track.looped ? styles.clipLooped : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: track.offsetSec * pxPerSec, width: track.durationSec * pxPerSec }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <Waveform buffer={track.buffer} />
        </div>
      </div>
    </div>
  );
}

export default TrackRow;

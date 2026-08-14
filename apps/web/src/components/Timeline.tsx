import { useMemo } from 'react';

import type { StudioTrack, TrackPatch } from '../hooks/useMultiTrackSession';
import { formatTime } from './Transport';
import styles from './Timeline.module.css';
import TrackRow from './TrackRow';

const PX_PER_SEC = 80;
const HEADER_WIDTH_PX = 200;

interface TimelineProps {
  tracks: StudioTrack[];
  currentTime: number;
  sessionDurationSec: number;
  isPlaying: boolean;
  onUpdateTrack: (id: string, patch: TrackPatch) => void;
  onRemoveTrack: (id: string) => void;
}

function Timeline({
  tracks,
  currentTime,
  sessionDurationSec,
  isPlaying,
  onUpdateTrack,
  onRemoveTrack,
}: TimelineProps) {
  const timelineWidthSec = Math.max(sessionDurationSec + 5, 20);
  const ticks = useMemo(
    () => Array.from({ length: Math.ceil(timelineWidthSec) + 1 }, (_, i) => i),
    [timelineWidthSec]
  );

  return (
    <div className={styles.scroll}>
      <div className={styles.inner}>
        <div className={styles.ruler}>
          <div className={styles.rulerCorner} style={{ width: HEADER_WIDTH_PX }} />
          <div className={styles.rulerTrack} style={{ width: timelineWidthSec * PX_PER_SEC }}>
            {ticks.map((sec) => (
              <div key={sec} className={styles.tick} style={{ left: sec * PX_PER_SEC }}>
                <span>{formatTime(sec)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rows}>
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              pxPerSec={PX_PER_SEC}
              timelineWidthSec={timelineWidthSec}
              headerWidthPx={HEADER_WIDTH_PX}
              draggable={!isPlaying}
              onUpdate={(patch) => onUpdateTrack(track.id, patch)}
              onRemove={() => onRemoveTrack(track.id)}
            />
          ))}
        </div>

        <div className={styles.playhead} style={{ left: HEADER_WIDTH_PX + currentTime * PX_PER_SEC }} />
      </div>
    </div>
  );
}

export default Timeline;

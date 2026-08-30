import type { TrackFx } from '../lib/audioEngine';
import styles from './EffectsPanel.module.css';

interface EffectsPanelProps {
  fx: TrackFx;
  onChange: (fx: TrackFx) => void;
}

function EffectsPanel({ fx, onChange }: EffectsPanelProps) {
  const set = (patch: Partial<TrackFx>) => onChange({ ...fx, ...patch });

  return (
    <div className={styles.panel}>
      <label className={styles.control} title="3-band EQ: low shelf">
        <span>Low</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.5}
          value={fx.eqLowGainDb}
          onChange={(event) => set({ eqLowGainDb: Number(event.target.value) })}
        />
      </label>
      <label className={styles.control} title="3-band EQ: mid peak">
        <span>Mid</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.5}
          value={fx.eqMidGainDb}
          onChange={(event) => set({ eqMidGainDb: Number(event.target.value) })}
        />
      </label>
      <label className={styles.control} title="3-band EQ: high shelf">
        <span>High</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.5}
          value={fx.eqHighGainDb}
          onChange={(event) => set({ eqHighGainDb: Number(event.target.value) })}
        />
      </label>
      <label className={styles.control} title="Compressor threshold">
        <span>Thresh</span>
        <input
          type="range"
          min={-60}
          max={0}
          step={1}
          value={fx.compThresholdDb}
          onChange={(event) => set({ compThresholdDb: Number(event.target.value) })}
        />
      </label>
      <label className={styles.control} title="Compressor ratio">
        <span>Ratio</span>
        <input
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={fx.compRatio}
          onChange={(event) => set({ compRatio: Number(event.target.value) })}
        />
      </label>
      <label className={styles.control} title="Reverb mix">
        <span>Reverb</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={fx.reverbWetPct}
          onChange={(event) => set({ reverbWetPct: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}

export default EffectsPanel;

import { LOOP_LIBRARY, type LoopDefinition } from '../lib/loopLibrary';
import buttons from '../styles/buttons.module.css';
import styles from './LoopBrowser.module.css';

interface LoopBrowserProps {
  sessionBpm: number;
  isAdding: boolean;
  onAddLoop: (loop: LoopDefinition) => void;
}

function LoopBrowser({ sessionBpm, isAdding, onAddLoop }: LoopBrowserProps) {
  return (
    <div className={styles.browser}>
      {LOOP_LIBRARY.map((loop) => (
        <div className={styles.loop} key={loop.id}>
          <span className={styles.name}>{loop.name}</span>
          <span className={styles.rate}>{(sessionBpm / loop.bpm).toFixed(2)}x @ {sessionBpm} BPM</span>
          <button
            type="button"
            className={buttons.pillOutline}
            onClick={() => onAddLoop(loop)}
            disabled={isAdding}
          >
            {isAdding ? 'Adding…' : 'Add to timeline'}
          </button>
        </div>
      ))}
    </div>
  );
}

export default LoopBrowser;

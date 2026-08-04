import type { DragEvent } from 'react';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import buttons from '../styles/buttons.module.css';
import layout from '../styles/layout.module.css';
import styles from './TheStudio.module.css';

function TheStudio() {
  const player = useAudioPlayer();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) player.loadFile(file);
  };

  return (
    <div className={layout.centered}>
      <div
        className={styles.dropzone}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      />
      <AudioPlayer
        file={player.file}
        objectUrl={player.objectUrl}
        isPlaying={player.isPlaying}
        audioRef={player.audioRef}
        onPlay={player.play}
        onPause={player.pause}
        onStop={player.stop}
        onClear={player.clear}
        emptyLabel="Drag and drop your jam here to turn it into a GemGroove!"
      />
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
      <button
        type="button"
        className={`${buttons.pill} ${styles.connectButton}`}
        disabled
        title="Wallet connection is coming in the next phase"
      >
        Connect Wallet
      </button>
    </div>
  );
}

export default TheStudio;

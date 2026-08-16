import type { DragEvent } from 'react';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import AudioPlayer from '../components/AudioPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import layout from '../styles/layout.module.css';
import styles from './TheLounge.module.css';

function TheLounge() {
  const player = useAudioPlayer();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) player.loadFile(file);
  };

  return (
    <div className={layout.centered}>
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
      <div
        className={styles.lounge}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        <AudioPlayer
          file={player.file}
          objectUrl={player.objectUrl}
          isPlaying={player.isPlaying}
          audioRef={player.audioRef}
          onPlay={player.play}
          onPause={player.pause}
          onStop={player.stop}
          onClear={player.clear}
          emptyLabel="Drag and drop your jam here to hear its awesomeness!"
        />
      </div>
    </div>
  );
}

export default TheLounge;

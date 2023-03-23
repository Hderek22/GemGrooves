import React, { useState } from 'react';
import GemGrooveThumb from './GemGrooveThumb.jpg';

function TheLounge() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    setAudioFile(file);
    setAudioElement(new Audio(URL.createObjectURL(file)));
  };

  const handlePlay = () => {
    audioElement.play();
  };

  const handlePause = () => {
    audioElement.pause();
  };

  const handleStop = () => {
    audioElement.pause();
    audioElement.currentTime = 0;
  };

  const handleClear = () => {
    setAudioFile(null);
    setAudioElement(null);
  };

  const centerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'black',
    color: 'orange',
  };

  const logoStyle = {
    width: '20rem',
    //marginBottom: '1rem',
  };

  const dropzoneStyle = {
    width: '4rem',
    height: '2rem',
    borderRadius: '100%',
    border: '2px solid orange',
    marginBottom: '2rem',
//    backgroundImage: `url(${GemGrooveThumb})`,
    backgroundSize: 'cover'
  };






  return (
    <div style={centerStyle}>
     
      <div style={dropzoneStyle} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}></div>      {audioFile ? (
        <div>
          <p style={{ color: 'orange' }}>Now playing: {audioFile.name}</p>
          <audio id="audio" src={URL.createObjectURL(audioFile)} ref={(el) => setAudioElement(el)}></audio>
          <button style={{ color: 'orange' }} onClick={handlePlay}>Play</button>
          <button style={{ color: 'orange' }} onClick={handlePause}>Pause</button>
          <button style={{ color: 'orange' }} onClick={handleStop}>Stop</button>
          <button style={{ color: 'orange' }} onClick={handleClear}>Clear</button>
        </div>
      ) : (
        <p style={{ color: 'orange' }}>Drag and Drop your Jam to hear its awesomeness!</p>
        )}
        <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
    </div>
  );
}

export default TheLounge;

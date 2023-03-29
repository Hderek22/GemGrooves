import React, { useState } from 'react';
import GemGrooveThumb from './GemGrooveThumb.jpg';

function TheStudio() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [connected, setConnected] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    if (!connected) {
      alert('Please connect your wallet first!');
      return;
    }
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

  const handleConnectWallet = () => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(() => setConnected(true))
        .catch((error) => console.error(error));
    } else {
      console.error('Metamask not detected');
    }
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

  const connectButtonStyle = {
    position: 'absolute',
    bottom: '2rem',
    right: '2rem',
    backgroundColor: 'orange',
    color: 'black',
    padding: '1rem 2rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  };
  
  return (
    <div style={centerStyle}>
      <div style={dropzoneStyle} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}></div>
      {audioFile ? (
        <div>
          <p style={{ color: 'orange' }}>Now playing: {audioFile.name}</p>
          <audio id="audio" src={URL.createObjectURL(audioFile)} ref={(el) => setAudioElement(el)}></audio>
          <button style={{ color: 'orange' }} onClick={handlePlay}>Play</button>
          <button style={{ color: 'orange' }} onClick={handlePause}>Pause</button>
          <button style={{ color: 'orange' }} onClick={handleStop}>Stop</button>
          <button style={{ color: 'orange' }} onClick={handleClear}>Clear</button>
        </div>
      ) : (
        <p style={{ color: 'orange' }}>Drag and Drop your Jam here to turn it into a GemGroove!</p>
      )}
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
      {!connected && (
        <button style={connectButtonStyle} onClick={handleConnectWallet}>
          MetaMask
        </button>
      )}
    </div>
  );
    
  }

export default TheStudio;

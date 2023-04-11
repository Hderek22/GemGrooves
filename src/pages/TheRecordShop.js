import { useState, useEffect } from 'react';
import Web3 from 'web3';
import { OpenSeaPort, Network } from 'opensea-js';
import GemGrooveThumb from './GemGrooveThumb.jpg';

function TheRecordShop() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    async function getNfts() {
      if (window.ethereum) {
        await window.ethereum.enable();
        const web3 = new Web3(window.ethereum);
        const networkId = await web3.eth.net.getId();
        const seaport = new OpenSeaPort(web3.currentProvider, {
          networkName: Network[networkId],
        });
        const accounts = await web3.eth.getAccounts();
        const address = accounts[0];
        const nfts = await seaport.api.getAssets({
          owner: address,
        });
        setNfts(nfts.assets);
      }
    }

    getNfts();
  }, []);

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
    width: '8rem',
    height: '8rem',
    borderRadius: '100%',
    border: '2px solid orange',
    marginBottom: '2rem',
//    backgroundImage: `url(${GemGrooveThumb})`,
    backgroundSize: 'cover'
  };

  return (
    <div style={centerStyle}>
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
      <div style={dropzoneStyle} onDrop={handleDrop}>
        <p>Drag and drop a file to play</p>
        <button onClick={handlePlay}>Play</button>
        <button onClick={handlePause}>Pause</button>
        <button onClick={handleStop}>Stop</button>
        <button onClick={handleClear}>Clear</button>
      </div>
      <div>
        <h1>My NFTs</h1>
        <ul>
          {nfts.map(nft => (
            <li key={nft.id}>
              <img src={nft.imageUrl} alt={nft.name} />
              <p>{nft.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TheRecordShop;

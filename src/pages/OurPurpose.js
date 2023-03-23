import React from 'react';
import GemGrooveThumb from './GemGrooveThumb.jpg';

function OurPurpose() {
  const centerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'black',
    color: 'orange',
  };


  const fairPayStyle = {
    maxWidth: '40rem',
    textAlign: 'center',
  };


  const logoStyle = {
    width: '20rem',
    marginBottom: '12rem',
  };


  return (
    <div style={centerStyle}>
      <p style={fairPayStyle}>
        Many artists in the music industry have ripped off. There are countless example of performers gettin ripped off by their record labels due to complex contracts, exploitative deals, and downright greed. 
        GemGroove is her to change that.  We strive to give singer/songwriters a platform to sell their songs directly to the listeners and be able to make a decent living without having to reach a gazzillion listeners.
      </p>
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
    </div>
  );
}

export default OurPurpose;

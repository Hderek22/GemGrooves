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
        
        With GemGrooves, musicians can easily 'mint a jam' into and NFT and sell directly to ther fans. 
        We are a user-friendly, non-technical environment that allows musicians to focus on creating and sharing their work without the need for specialized technical knowledge. 
        Musicians can take control of their music and reach their fans directly without the need for intermediaries or record labels that often take a significant cut of their revenue creating a need for an unrealistic amount of fans to make a living. 

      </p>
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
    </div>
  );
}

export default OurPurpose;

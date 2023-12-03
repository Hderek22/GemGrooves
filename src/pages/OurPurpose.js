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
        
      Our Purpose is simple. Put the control back into the hands of the artist...where it always belonged.
     </p>
      
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
    </div>
  );
}

export default OurPurpose;

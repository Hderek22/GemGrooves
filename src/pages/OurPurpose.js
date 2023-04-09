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
        
       GemGrooves provides musicians with an innovative platform to sell their songs using Non-Fungible Token (NFT) technologies. We are revolutionizing the music industry by allowing musicians to earn more for their work while giving fans a unique opportunity to own the rights to their favorite music.

Unlike traditional music platforms, GemGrooves allows musicians to have a direct connection between the artist and their fans. Using GemGrooves, musicians can maintain ownership of their work and receive direct payments for every sale, eliminating the need for intermediaries that take a significant portion of their earnings.

Moreover, GemGrooves provides unique features such as exclusive rights to music, allowing fans to own the rights to a particular song or album, giving them access to special perks such as backstage passes or VIP access to shows. This not only provides fans with a unique experience but also provides artists with a reliable source of income beyond music sales.

With unique features such as exclusive rights to music, GemGrooves is poised to revolutionize the music industry, providing artists with a sustainable and reliable source of income while giving fans a unique experience they won't find anywhere else.
      </p>
      <img src={GemGrooveThumb} alt="GemGroove Thumb" style={logoStyle} />
    </div>
  );
}

export default OurPurpose;

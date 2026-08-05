import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import TrackCard from '../components/TrackCard';
import { useListings } from '../hooks/useListings';
import layout from '../styles/layout.module.css';
import styles from './TheRecordShop.module.css';

function TheRecordShop() {
  const { listings, isLoading, deploymentMissing } = useListings();

  if (deploymentMissing) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>Switch to a supported network to browse the shop.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={layout.centered}>
        <p className={styles.hint}>Loading tracks…</p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>The shop is opening soon — check back for artist drops.</p>
      </div>
    );
  }

  return (
    <div className={layout.centered}>
      <div className={styles.grid}>
        {listings.map((listing) => (
          <TrackCard key={listing.tokenId.toString()} listing={listing} />
        ))}
      </div>
    </div>
  );
}

export default TheRecordShop;

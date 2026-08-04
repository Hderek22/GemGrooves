import { Link } from 'react-router-dom';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import buttons from '../styles/buttons.module.css';
import layout from '../styles/layout.module.css';
import styles from './Home.module.css';

function Home() {
  return (
    <div className={layout.centered}>
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
      <h1 className={styles.title}>GemGrooves</h1>
      <p className={styles.tagline}>
        Put the control back into the hands of the artist — where it always belonged.
      </p>
      <nav className={styles.cta} aria-label="Explore GemGrooves">
        <Link to="/TheStudio" className={buttons.pill}>
          Mint in The Studio
        </Link>
        <Link to="/TheRecordShop" className={buttons.pill}>
          Browse The Record Shop
        </Link>
        <Link to="/TheLounge" className={buttons.pillOutline}>
          Listen in The Lounge
        </Link>
      </nav>
    </div>
  );
}

export default Home;

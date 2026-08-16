import { Link } from 'react-router-dom';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import buttons from '../styles/buttons.module.css';
import layout from '../styles/layout.module.css';
import styles from './Home.module.css';

function Home() {
  return (
    <div className={layout.centered}>
      <h1 className={styles.srOnly}>GemGrooves</h1>
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
      <nav className={styles.cta} aria-label="Explore GemGrooves">
        <Link to="/TheStudio" className={buttons.pill}>
          Mint in The Studio
        </Link>
        <Link to="/TheRecordShop" className={buttons.pill}>
          Browse The Record Shop
        </Link>
        <Link to="/TheLounge" className={buttons.pill}>
          Listen in The Lounge
        </Link>
      </nav>
    </div>
  );
}

export default Home;

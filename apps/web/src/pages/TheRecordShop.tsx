import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import layout from '../styles/layout.module.css';
import styles from './TheRecordShop.module.css';

function TheRecordShop() {
  return (
    <div className={layout.centered}>
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
      <p className={styles.hint}>The shop is opening soon — check back for artist drops.</p>
    </div>
  );
}

export default TheRecordShop;

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import layout from '../styles/layout.module.css';
import styles from './OurPurpose.module.css';

function OurPurpose() {
  return (
    <div className={layout.centered}>
      <p className={styles.statement}>
        Our Purpose is simple. Put the control back into the hands of the artist &mdash; where it
        always belonged.
      </p>
      <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
    </div>
  );
}

export default OurPurpose;

import { formatUnits } from 'viem';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import type { TrackListing } from '../hooks/useListings';
import { useTrackMetadata } from '../hooks/useTrackMetadata';
import { resolveIpfsUri } from '../lib/ipfs';
import styles from './TrackCard.module.css';

interface TrackCardProps {
  listing: TrackListing;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function TrackCard({ listing }: TrackCardProps) {
  const { data: metadata, isLoading } = useTrackMetadata(listing.tokenURI);

  const price = formatUnits(listing.priceWei, listing.payTokenDecimals);
  const title = metadata?.name ?? `Track #${listing.tokenId}`;
  const artist = metadata?.artist ?? truncateAddress(listing.seller);
  const image = metadata?.image ? resolveIpfsUri(metadata.image) : gemGrooveThumb;

  return (
    <article className={styles.card}>
      <img src={image} alt={title} className={styles.art} />
      <h3 className={styles.title}>{isLoading ? 'Loading…' : title}</h3>
      <p className={styles.artist}>{artist}</p>
      <p className={styles.price}>
        {price} {listing.payTokenSymbol}
      </p>
    </article>
  );
}

export default TrackCard;

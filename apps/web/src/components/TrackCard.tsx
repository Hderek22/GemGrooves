import { useQueryClient } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { useAccount } from 'wagmi';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import { useBuyTrack } from '../hooks/useBuyTrack';
import type { TrackListing } from '../hooks/useListings';
import { useTrackMetadata } from '../hooks/useTrackMetadata';
import { resolveIpfsUri } from '../lib/ipfs';
import buttons from '../styles/buttons.module.css';
import styles from './TrackCard.module.css';

interface TrackCardProps {
  listing: TrackListing;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function TrackCard({ listing }: TrackCardProps) {
  const { data: metadata, isLoading } = useTrackMetadata(listing.tokenURI);
  const { address, isConnected } = useAccount();
  const { buyTrack, state, error } = useBuyTrack();
  const queryClient = useQueryClient();

  const price = formatUnits(listing.priceWei, listing.payTokenDecimals);
  const title = metadata?.name ?? `Track #${listing.tokenId}`;
  const artist = metadata?.artist ?? truncateAddress(listing.seller);
  const image = metadata?.image ? resolveIpfsUri(metadata.image) : gemGrooveThumb;

  const isOwnListing = Boolean(address) && listing.seller.toLowerCase() === address?.toLowerCase();
  const busy = state === 'approving' || state === 'buying';

  const handleBuy = async () => {
    try {
      await buyTrack(listing);
      await queryClient.invalidateQueries();
    } catch {
      // error is already captured in the hook's state
    }
  };

  const buyLabel = !isConnected
    ? 'Connect wallet to buy'
    : state === 'approving'
      ? 'Approving…'
      : state === 'buying'
        ? 'Buying…'
        : state === 'success'
          ? 'Bought!'
          : 'Buy';

  return (
    <article className={styles.card}>
      <img src={image} alt={title} className={styles.art} />
      <h3 className={styles.title}>{isLoading ? 'Loading…' : title}</h3>
      <p className={styles.artist}>{artist}</p>
      <p className={styles.price}>
        {price} {listing.payTokenSymbol}
      </p>
      {isOwnListing ? (
        <p className={styles.ownListing}>Your listing</p>
      ) : (
        <>
          <button
            type="button"
            className={buttons.pill}
            onClick={handleBuy}
            disabled={!isConnected || busy || state === 'success'}
          >
            {buyLabel}
          </button>
          {error && <p className={styles.error}>{error.message}</p>}
        </>
      )}
    </article>
  );
}

export default TrackCard;

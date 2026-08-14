import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAddress, parseUnits, type Address } from 'viem';
import { useAccount } from 'wagmi';

import gemGrooveThumb from '../assets/GemGrooveThumb.jpg';
import Timeline from '../components/Timeline';
import Transport from '../components/Transport';
import { useIpfsUpload } from '../hooks/useIpfsUpload';
import { useMintTrack } from '../hooks/useMintTrack';
import { useMultiTrackSession } from '../hooks/useMultiTrackSession';
import { usePayTokenOptions } from '../hooks/usePayTokenOptions';
import buttons from '../styles/buttons.module.css';
import layout from '../styles/layout.module.css';
import styles from './TheStudio.module.css';

interface SplitRow {
  wallet: string;
  sharePercent: number;
}

function TheStudio() {
  const { address, isConnected } = useAccount();
  const session = useMultiTrackSession();
  const { uploadTrack, isUploading } = useIpfsUpload();
  const { options: payTokenOptions } = usePayTokenOptions();
  const {
    mintTrack,
    isPending,
    isConfirming,
    isConfirmed,
    error: mintError,
    reset: resetMint,
    deploymentMissing,
  } = useMintTrack();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [royaltyPercent, setRoyaltyPercent] = useState(10);
  const [splits, setSplits] = useState<SplitRow[]>([{ wallet: '', sharePercent: 100 }]);
  const [price, setPrice] = useState('0.05');
  const [payTokenIndex, setPayTokenIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloadingMix, setIsDownloadingMix] = useState(false);

  useEffect(() => {
    if (address) {
      setSplits((prev) =>
        prev.length === 1 && !prev[0].wallet ? [{ wallet: address, sharePercent: 100 }] : prev
      );
    }
  }, [address]);

  const updateSplit = (index: number, patch: Partial<SplitRow>) => {
    setSplits((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addSplit = () => setSplits((prev) => [...prev, { wallet: '', sharePercent: 0 }]);

  const removeSplit = (index: number) =>
    setSplits((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const shareTotal = splits.reduce((sum, row) => sum + row.sharePercent, 0);
  const shareTotalValid = Math.round(shareTotal * 100) === 10000;

  function validate(): string | null {
    if (session.tracks.length === 0) return 'Record or add at least one track first.';
    if (!title.trim()) return 'Give your track a title.';
    if (!artist.trim()) return 'Add an artist name.';
    if (royaltyPercent < 0 || royaltyPercent > 50) return 'Royalty must be between 0% and 50%.';
    if (!shareTotalValid) return 'Co-creator shares must add up to exactly 100%.';
    for (const row of splits) {
      if (!isAddress(row.wallet)) return `"${row.wallet || '(empty)'}" is not a valid wallet address.`;
    }
    if (!(Number(price) > 0)) return 'Price must be greater than 0.';
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const royaltyBPS = Math.round(royaltyPercent * 100);
      const sharesBPS = splits.map((row) => Math.round(row.sharePercent * 100));
      const wallets = splits.map((row) => row.wallet as Address);
      const selectedToken = payTokenOptions[payTokenIndex];

      setIsRendering(true);
      const mixdownFile = await session.renderMixdownFile().finally(() => setIsRendering(false));

      const tokenURI = await uploadTrack({
        audioFile: mixdownFile,
        title,
        artist,
        royaltyBPS,
        splits: splits.map((row, i) => ({ wallet: row.wallet, shareBPS: sharesBPS[i] })),
      });

      await mintTrack({
        tokenURI,
        royaltyBPS,
        wallets,
        sharesBPS,
        priceWei: parseUnits(price, selectedToken.decimals),
        payToken: selectedToken.address,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    session.resetSession();
    setTitle('');
    setArtist('');
    setRoyaltyPercent(10);
    setSplits([{ wallet: address ?? '', sharePercent: 100 }]);
    setPrice('0.05');
    setPayTokenIndex(0);
    setFormError(null);
    resetMint();
  };

  if (!isConnected) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>Connect your wallet (top right) to start minting a GemGroove.</p>
      </div>
    );
  }

  if (deploymentMissing) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.hint}>Switch to a supported network to mint.</p>
      </div>
    );
  }

  if (isConfirmed) {
    return (
      <div className={layout.centered}>
        <img src={gemGrooveThumb} alt="GemGrooves" className={styles.logo} />
        <p className={styles.success}>Minted! Your track is live in The Record Shop.</p>
        <div className={styles.row}>
          <Link to="/TheRecordShop" className={buttons.pill}>
            View The Record Shop
          </Link>
          <button type="button" className={buttons.pillOutline} onClick={resetForm}>
            Mint another
          </button>
        </div>
      </div>
    );
  }

  const busy = isUploading || isPending || isConfirming || isSubmitting;

  const handleSessionDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void session.addTrackFromFile(file);
  };

  const handleRecordClick = () => {
    if (session.isRecording) {
      void session.stopRecordingTrack();
    } else {
      void session.startRecordingTrack();
    }
  };

  const handleDownloadMix = async () => {
    setIsDownloadingMix(true);
    setFormError(null);
    try {
      const file = await session.renderMixdownFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not render the mix.');
    } finally {
      setIsDownloadingMix(false);
    }
  };

  return (
    <div className={styles.page}>
      <div
        className={styles.studioZone}
        onDrop={handleSessionDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        <Transport
          isPlaying={session.isPlaying}
          isRecording={session.isRecording}
          currentTime={session.currentTime}
          durationSec={session.sessionDurationSec}
          onPlay={session.play}
          onPause={session.pause}
          onStop={session.stop}
          onRecordToggle={handleRecordClick}
          onAddFile={(file) => void session.addTrackFromFile(file)}
          onDownloadMix={() => void handleDownloadMix()}
          canDownloadMix={session.tracks.length > 0}
          isDownloadingMix={isDownloadingMix}
          micError={session.micError?.message}
        />

        {session.tracks.length === 0 ? (
          <p className={styles.hint}>Record or drop audio files here to start building your GemGroove.</p>
        ) : (
          <Timeline
            tracks={session.tracks}
            currentTime={session.currentTime}
            sessionDurationSec={session.sessionDurationSec}
            isPlaying={session.isPlaying}
            onUpdateTrack={session.updateTrack}
            onRemoveTrack={session.removeTrack}
          />
        )}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="title">Title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="artist">Artist name</label>
          <input id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="royalty">Royalty (%)</label>
            <input
              id="royalty"
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={royaltyPercent}
              onChange={(e) => setRoyaltyPercent(Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="price">Price</label>
            <input
              id="price"
              type="number"
              min={0}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={payTokenIndex}
              onChange={(e) => setPayTokenIndex(Number(e.target.value))}
            >
              {payTokenOptions.map((option, i) => (
                <option key={option.address} value={i}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.splitsHeading}>
            <label>Co-creators</label>
            <span className={shareTotalValid ? styles.shareTotal : styles.shareTotalInvalid}>
              {shareTotal}% of 100%
            </span>
          </div>
          {splits.map((row, i) => (
            <div className={styles.splitRow} key={i}>
              <input
                type="text"
                placeholder="0x…"
                value={row.wallet}
                onChange={(e) => updateSplit(i, { wallet: e.target.value })}
              />
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={row.sharePercent}
                onChange={(e) => updateSplit(i, { sharePercent: Number(e.target.value) })}
              />
              <button
                type="button"
                className={buttons.pillOutline}
                onClick={() => removeSplit(i)}
                disabled={splits.length === 1}
              >
                &minus;
              </button>
            </div>
          ))}
          <button type="button" className={buttons.pillOutline} onClick={addSplit}>
            + Add co-creator
          </button>
        </div>

        {formError && <p className={styles.error}>{formError}</p>}
        {mintError && <p className={styles.error}>{mintError.message}</p>}

        <button type="submit" className={buttons.pill} disabled={busy}>
          {isRendering
            ? 'Rendering mix…'
            : isUploading
              ? 'Uploading to IPFS…'
              : isPending
                ? 'Confirm in wallet…'
                : isConfirming
                  ? 'Minting…'
                  : 'Mint GemGroove'}
        </button>
      </form>
    </div>
  );
}

export default TheStudio;

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext();
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume();
  }
  return sharedContext;
}

export async function decodeBlobToBuffer(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export interface PlaybackTrack {
  id: string;
  buffer: AudioBuffer;
  gain: number;
  muted: boolean;
  solo: boolean;
  offsetSec: number;
}

interface ActiveNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

function isAudible(track: PlaybackTrack, anySolo: boolean): boolean {
  return anySolo ? track.solo : !track.muted;
}

/**
 * Schedules and tracks playback of multiple tracks against a single shared
 * transport clock, so tracks recorded at different times line back up at
 * their recorded offsets on every subsequent play.
 */
export class PlaybackController {
  private ctx: AudioContext;
  private nodes = new Map<string, ActiveNode>();
  private startedAtCtxTime = 0;
  private startedAtPositionSec = 0;
  private playing = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  getPositionSec(): number {
    if (!this.playing) return this.startedAtPositionSec;
    return this.startedAtPositionSec + (this.ctx.currentTime - this.startedAtCtxTime);
  }

  play(tracks: PlaybackTrack[], positionSec: number): void {
    this.stop();

    const anySolo = tracks.some((track) => track.solo);
    const ctxStart = this.ctx.currentTime;
    this.startedAtCtxTime = ctxStart;
    this.startedAtPositionSec = positionSec;

    for (const track of tracks) {
      const intoBuffer = positionSec - track.offsetSec;
      if (intoBuffer >= track.buffer.duration) continue;

      const source = this.ctx.createBufferSource();
      source.buffer = track.buffer;
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = isAudible(track, anySolo) ? track.gain : 0;
      source.connect(gainNode).connect(this.ctx.destination);

      if (intoBuffer >= 0) {
        source.start(ctxStart, intoBuffer);
      } else {
        source.start(ctxStart - intoBuffer);
      }
      this.nodes.set(track.id, { source, gain: gainNode });
    }

    this.playing = true;
  }

  stop(): void {
    if (this.playing) {
      this.startedAtPositionSec = this.getPositionSec();
    }
    for (const { source } of this.nodes.values()) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
      source.disconnect();
    }
    this.nodes.clear();
    this.playing = false;
  }

  seek(positionSec: number): void {
    const wasPlaying = this.playing;
    this.startedAtPositionSec = positionSec;
    if (wasPlaying) {
      this.startedAtCtxTime = this.ctx.currentTime;
    }
  }

  /** Re-applies gain/mute/solo to already-scheduled nodes without restarting playback. */
  updateLiveMix(tracks: PlaybackTrack[]): void {
    const anySolo = tracks.some((track) => track.solo);
    for (const track of tracks) {
      const node = this.nodes.get(track.id);
      if (!node) continue;
      node.gain.gain.value = isAudible(track, anySolo) ? track.gain : 0;
    }
  }
}

/** Schedules `beats` metronome clicks at `bpm` (beat 1 accented) and resolves once they've finished. */
export function playCountIn(ctx: AudioContext, bpm: number, beats: number): Promise<void> {
  const interval = 60 / bpm;
  const startTime = ctx.currentTime;

  for (let i = 0; i < beats; i++) {
    const t = startTime + i * interval;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = i === 0 ? 1000 : 800;
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  return new Promise((resolve) => setTimeout(resolve, beats * interval * 1000));
}

export interface MixdownTrack {
  buffer: AudioBuffer;
  gain: number;
  muted: boolean;
  offsetSec: number;
}

export async function renderMixdown(
  tracks: MixdownTrack[],
  durationSec: number,
  sampleRate = 44100
): Promise<AudioBuffer> {
  const channels = Math.max(1, ...tracks.map((track) => track.buffer.numberOfChannels));
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

  for (const track of tracks) {
    if (track.muted) continue;
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.gain;
    source.connect(gainNode).connect(offlineCtx.destination);
    source.start(Math.max(0, track.offsetSec));
  }

  return offlineCtx.startRendering();
}

/** Encodes an AudioBuffer as a 16-bit PCM WAV Blob. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

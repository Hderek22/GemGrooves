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

export interface TrackFx {
  eqLowGainDb: number;
  eqMidGainDb: number;
  eqHighGainDb: number;
  compThresholdDb: number;
  compRatio: number;
  reverbWetPct: number;
}

/** All values chosen to be audibly transparent — a track with untouched FX sounds identical to one with no FX chain at all. */
export const DEFAULT_TRACK_FX: TrackFx = {
  eqLowGainDb: 0,
  eqMidGainDb: 0,
  eqHighGainDb: 0,
  compThresholdDb: -24,
  compRatio: 1,
  reverbWetPct: 0,
};

export interface PlaybackTrack {
  id: string;
  buffer: AudioBuffer;
  gain: number;
  muted: boolean;
  solo: boolean;
  offsetSec: number;
  /** Loop-pedal mode: keep repeating this track's buffer instead of playing it once. */
  looped: boolean;
  fx: TrackFx;
  /** 1 = native speed. Tempo-synced loop-library tracks use sessionBpm / loopNativeBpm. */
  playbackRate: number;
}

interface TrackFxNodes {
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dryGain: GainNode;
  wetGain: GainNode;
}

interface ActiveNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  fx: TrackFxNodes;
}

function isAudible(track: PlaybackTrack, anySolo: boolean): boolean {
  return anySolo ? track.solo : !track.muted;
}

/** A short synthetic noise-decay impulse response — no bundled audio asset needed for the reverb send. */
function buildImpulseResponse(ctx: BaseAudioContext, durationSec = 2, decay = 3): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function applyTrackFxParams(nodes: TrackFxNodes, fx: TrackFx): void {
  nodes.eqLow.gain.value = fx.eqLowGainDb;
  nodes.eqMid.gain.value = fx.eqMidGainDb;
  nodes.eqHigh.gain.value = fx.eqHighGainDb;
  nodes.compressor.threshold.value = fx.compThresholdDb;
  nodes.compressor.ratio.value = fx.compRatio;
  const wet = Math.min(1, Math.max(0, fx.reverbWetPct / 100));
  nodes.wetGain.gain.value = wet;
  nodes.dryGain.gain.value = 1 - wet;
}

/**
 * Builds the per-track FX chain shared by live playback and offline
 * mixdown — `input -> 3-band EQ -> compressor -> [dry/reverb-wet mix] ->
 * output`, ready to connect onward to a master bus. Always fully wired
 * regardless of `fx` values (even fully "bypassed" ones) rather than
 * conditionally built, so a parameter change during playback never needs
 * to rebuild the graph — just `applyTrackFxParams`. `AudioContext` and
 * `OfflineAudioContext` both implement `BaseAudioContext`, so this one
 * function serves both the live and offline paths identically.
 */
function buildTrackFxChain(ctx: BaseAudioContext, input: AudioNode, fx: TrackFx): { output: GainNode; nodes: TrackFxNodes } {
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 320;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 0.8;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 3200;

  const compressor = ctx.createDynamicsCompressor();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = buildImpulseResponse(ctx);
  const output = ctx.createGain();

  input.connect(eqLow).connect(eqMid).connect(eqHigh).connect(compressor);
  compressor.connect(dryGain).connect(output);
  compressor.connect(reverb).connect(wetGain).connect(output);

  const nodes: TrackFxNodes = { eqLow, eqMid, eqHigh, compressor, dryGain, wetGain };
  applyTrackFxParams(nodes, fx);
  return { output, nodes };
}

/**
 * Schedules and tracks playback of multiple tracks against a single shared
 * transport clock, so tracks recorded at different times line back up at
 * their recorded offsets on every subsequent play.
 */
export class PlaybackController {
  private ctx: AudioContext;
  private nodes = new Map<string, ActiveNode>();
  private masterGain: GainNode | null = null;
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

    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);
    this.masterGain = masterGain;

    for (const track of tracks) {
      const rate = track.playbackRate || 1;
      // Wall-clock duration this track actually plays for — differs from
      // buffer.duration once playbackRate != 1 (tempo-synced loop tracks).
      const effectiveDuration = track.buffer.duration / rate;
      const intoBuffer = positionSec - track.offsetSec;
      if (!track.looped && intoBuffer >= effectiveDuration) continue;

      const source = this.ctx.createBufferSource();
      source.buffer = track.buffer;
      source.playbackRate.value = rate;
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = isAudible(track, anySolo) ? track.gain : 0;
      source.connect(gainNode);
      const { output, nodes: fxNodes } = buildTrackFxChain(this.ctx, gainNode, track.fx);
      output.connect(masterGain);

      // AudioBufferSourceNode.start()'s offset argument is buffer-native
      // seconds, unaffected by playbackRate — wall-clock elapsed time has
      // to be scaled by `rate` to land on the right sample in the buffer.
      if (track.looped) {
        source.loop = true;
        const wallOffsetIntoLoop = intoBuffer >= 0 ? intoBuffer % effectiveDuration : 0;
        source.start(ctxStart - Math.min(0, intoBuffer), wallOffsetIntoLoop * rate);
      } else if (intoBuffer >= 0) {
        source.start(ctxStart, intoBuffer * rate);
      } else {
        source.start(ctxStart - intoBuffer);
      }
      this.nodes.set(track.id, { source, gain: gainNode, fx: fxNodes });
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
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    this.playing = false;
  }

  seek(positionSec: number): void {
    const wasPlaying = this.playing;
    this.startedAtPositionSec = positionSec;
    if (wasPlaying) {
      this.startedAtCtxTime = this.ctx.currentTime;
    }
  }

  /** Re-applies gain/mute/solo/fx to already-scheduled nodes without restarting playback. */
  updateLiveMix(tracks: PlaybackTrack[]): void {
    const anySolo = tracks.some((track) => track.solo);
    for (const track of tracks) {
      const node = this.nodes.get(track.id);
      if (!node) continue;
      node.gain.gain.value = isAudible(track, anySolo) ? track.gain : 0;
      applyTrackFxParams(node.fx, track.fx);
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
  looped: boolean;
  fx: TrackFx;
  playbackRate: number;
}

export async function renderMixdown(
  tracks: MixdownTrack[],
  durationSec: number,
  sampleRate = 44100
): Promise<AudioBuffer> {
  const channels = Math.max(1, ...tracks.map((track) => track.buffer.numberOfChannels));
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.connect(offlineCtx.destination);

  for (const track of tracks) {
    if (track.muted) continue;
    const source = offlineCtx.createBufferSource();
    source.buffer = track.buffer;
    source.playbackRate.value = track.playbackRate || 1;
    if (track.looped) source.loop = true;
    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = track.gain;
    source.connect(gainNode);
    const { output } = buildTrackFxChain(offlineCtx, gainNode, track.fx);
    output.connect(masterGain);
    source.start(Math.max(0, track.offsetSec));
  }

  return offlineCtx.startRendering();
}

/** A smooth tanh-based soft-clip/saturation curve for WaveShaperNode. */
function makeSoftClipCurve(amount = 0.98, samples = 1024): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.5) * amount;
  }
  return curve;
}

/**
 * One-click "auto-master": no manual knobs, just gain-stage the mix up to
 * a sensible peak, then glue it together with a fixed compressor and tame
 * any remaining peaks with a soft-clip saturator. Not broadcast-grade
 * mastering — Web Audio has no true brickwall limiter, so the soft-clip is
 * a "loudness-maximizer lite," not a substitute for real mastering.
 *
 * Takes an already-rendered mixdown buffer (from `renderMixdown`) rather
 * than being folded into that function, so the two stay independently
 * simple: peak analysis reads the buffer's own PCM data directly (no
 * render pass needed just to measure it), then a single offline render
 * applies the master chain.
 */
export async function applyAutoMaster(buffer: AudioBuffer): Promise<AudioBuffer> {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  const targetPeak = 0.9;
  const preGain = peak > 0 ? Math.min(4, targetPeak / peak) : 1;

  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const preGainNode = offlineCtx.createGain();
  preGainNode.gain.value = preGain;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const shaper = offlineCtx.createWaveShaper();
  // WaveShaperNode.curve's DOM type pins the buffer to ArrayBuffer, which
  // TS can't infer from a plain `new Float32Array(n)` in this TS version.
  shaper.curve = makeSoftClipCurve() as Float32Array<ArrayBuffer>;
  shaper.oversample = '4x';

  const makeupGain = offlineCtx.createGain();
  makeupGain.gain.value = 1.4; // roughly compensates the compressor's average gain reduction

  source.connect(preGainNode).connect(compressor).connect(shaper).connect(makeupGain).connect(offlineCtx.destination);
  source.start(0);

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

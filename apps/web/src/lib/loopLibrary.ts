import { audioBufferToWav } from './audioEngine';

/**
 * A small built-in loop pack, synthesized in code rather than bundled as
 * audio assets — no licensing concerns, and it exercises the same
 * tempo-sync path (playbackRate) real sample-based loops would need.
 * Each loop is one bar of 4/4 at its own native BPM; dropping it into a
 * session computes playbackRate = sessionBpm / loop.bpm so it locks to
 * whatever tempo the session is actually at.
 */
export interface LoopDefinition {
  id: string;
  name: string;
  bpm: number;
  generate: (ctx: OfflineAudioContext, beatSec: number) => void;
}

const BEATS_PER_LOOP = 4;
export const LOOP_LIBRARY_BPM = 120;

function scheduleKick(ctx: OfflineAudioContext, time: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.3);
}

function scheduleHat(ctx: OfflineAudioContext, time: number): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.05));
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(time);
  noise.stop(time + 0.06);
}

function scheduleBass(ctx: OfflineAudioContext, time: number, freq: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.7, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + durationSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + durationSec + 0.05);
}

export const LOOP_LIBRARY: LoopDefinition[] = [
  {
    id: 'kick-pulse',
    name: 'Kick Pulse',
    bpm: LOOP_LIBRARY_BPM,
    generate: (ctx, beatSec) => {
      for (let beat = 0; beat < BEATS_PER_LOOP; beat++) scheduleKick(ctx, beat * beatSec);
    },
  },
  {
    id: 'kick-hat-groove',
    name: 'Kick + Hat Groove',
    bpm: LOOP_LIBRARY_BPM,
    generate: (ctx, beatSec) => {
      scheduleKick(ctx, 0);
      scheduleKick(ctx, 2 * beatSec);
      for (let eighth = 0; eighth < BEATS_PER_LOOP * 2; eighth++) scheduleHat(ctx, eighth * (beatSec / 2));
    },
  },
  {
    id: 'bass-pulse',
    name: 'Bass Pulse',
    bpm: LOOP_LIBRARY_BPM,
    generate: (ctx, beatSec) => {
      scheduleBass(ctx, 0, 55, beatSec * 0.9);
      scheduleBass(ctx, 2 * beatSec, 55, beatSec * 0.9);
    },
  },
];

export async function renderLoopAudio(loop: LoopDefinition): Promise<Blob> {
  const beatSec = 60 / loop.bpm;
  const durationSec = beatSec * BEATS_PER_LOOP;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  loop.generate(ctx, beatSec);
  const buffer = await ctx.startRendering();
  return audioBufferToWav(buffer);
}

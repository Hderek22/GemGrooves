import { useCallback, useEffect, useRef, useState } from 'react';

import {
  audioBufferToWav,
  decodeBlobToBuffer,
  getAudioContext,
  PlaybackController,
  renderMixdown,
  type PlaybackTrack,
} from '../lib/audioEngine';
import { useMicRecorder } from './useMicRecorder';

export interface StudioTrack {
  id: string;
  name: string;
  blob: Blob;
  buffer: AudioBuffer;
  durationSec: number;
  gain: number;
  muted: boolean;
  solo: boolean;
  offsetSec: number;
}

export type TrackPatch = Partial<Pick<StudioTrack, 'name' | 'gain' | 'muted' | 'solo' | 'offsetSec'>>;

function makeTrackId() {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toPlaybackTracks(tracks: StudioTrack[]): PlaybackTrack[] {
  return tracks.map((track) => ({
    id: track.id,
    buffer: track.buffer,
    gain: track.gain,
    muted: track.muted,
    solo: track.solo,
    offsetSec: track.offsetSec,
  }));
}

export function useMultiTrackSession() {
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);

  const controllerRef = useRef<PlaybackController | null>(null);
  const rafRef = useRef<number | null>(null);
  const recordStartOffsetRef = useRef(0);
  const recorder = useMicRecorder();

  const getController = useCallback(() => {
    if (!controllerRef.current) {
      controllerRef.current = new PlaybackController(getAudioContext());
    }
    return controllerRef.current;
  }, []);

  const sessionDurationSec = tracks.reduce(
    (max, track) => Math.max(max, track.offsetSec + track.durationSec),
    0
  );

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const controller = getController();
      const position = controller.getPositionSec();
      if (position >= sessionDurationSec && sessionDurationSec > 0) {
        controller.stop();
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }
      setCurrentTime(position);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, sessionDurationSec, getController]);

  useEffect(() => {
    if (isPlaying) getController().updateLiveMix(toPlaybackTracks(tracks));
  }, [tracks, isPlaying, getController]);

  const addTrack = useCallback(
    async (blob: Blob, name: string, offsetSec: number) => {
      setIsDecoding(true);
      try {
        const ctx = getAudioContext();
        const buffer = await decodeBlobToBuffer(ctx, blob);
        const track: StudioTrack = {
          id: makeTrackId(),
          name,
          blob,
          buffer,
          durationSec: buffer.duration,
          gain: 1,
          muted: false,
          solo: false,
          offsetSec,
        };
        setTracks((prev) => [...prev, track]);
        return track;
      } finally {
        setIsDecoding(false);
      }
    },
    []
  );

  const addTrackFromFile = useCallback(
    (file: File) => addTrack(file, file.name, 0),
    [addTrack]
  );

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));
  }, []);

  const updateTrack = useCallback((id: string, patch: TrackPatch) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...patch } : track)));
  }, []);

  const play = useCallback(() => {
    if (tracks.length === 0) return;
    getController().play(toPlaybackTracks(tracks), currentTime);
    setIsPlaying(true);
  }, [tracks, currentTime, getController]);

  const pause = useCallback(() => {
    const controller = getController();
    controller.stop();
    setCurrentTime(controller.getPositionSec());
    setIsPlaying(false);
  }, [getController]);

  const stop = useCallback(() => {
    getController().stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [getController]);

  const startRecordingTrack = useCallback(async () => {
    recordStartOffsetRef.current = currentTime;
    if (tracks.length > 0) {
      getController().play(toPlaybackTracks(tracks), currentTime);
      setIsPlaying(true);
    }
    await recorder.startRecording();
  }, [currentTime, tracks, recorder, getController]);

  const stopRecordingTrack = useCallback(async () => {
    const blob = await recorder.stopRecording();
    getController().stop();
    setIsPlaying(false);
    setCurrentTime(0);
    const takeNumber = tracks.length + 1;
    return addTrack(blob, `Take ${takeNumber}`, recordStartOffsetRef.current);
  }, [recorder, tracks.length, addTrack, getController]);

  const resetSession = useCallback(() => {
    getController().stop();
    setTracks([]);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [getController]);

  const renderMixdownFile = useCallback(async () => {
    const audioBuffer = await renderMixdown(
      tracks.map((track) => ({
        buffer: track.buffer,
        gain: track.gain,
        muted: track.muted,
        offsetSec: track.offsetSec,
      })),
      sessionDurationSec
    );
    const wavBlob = audioBufferToWav(audioBuffer);
    return new File([wavBlob], 'gemgroove-mixdown.wav', { type: 'audio/wav' });
  }, [tracks, sessionDurationSec]);

  return {
    tracks,
    isPlaying,
    currentTime,
    sessionDurationSec,
    isDecoding,
    isRecording: recorder.isRecording,
    micPermission: recorder.permission,
    micError: recorder.error,
    addTrackFromFile,
    removeTrack,
    updateTrack,
    play,
    pause,
    stop,
    startRecordingTrack,
    stopRecordingTrack,
    renderMixdownFile,
    resetSession,
  };
}

export type UseMultiTrackSessionReturn = ReturnType<typeof useMultiTrackSession>;

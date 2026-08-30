import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  audioBufferToWav,
  decodeBlobToBuffer,
  DEFAULT_TRACK_FX,
  getAudioContext,
  playCountIn,
  PlaybackController,
  renderMixdown,
  type PlaybackTrack,
  type TrackFx,
} from '../lib/audioEngine';
import { useMicRecorder } from './useMicRecorder';

const COUNT_IN_BEATS = 4;

export interface StudioTrack {
  id: string;
  name: string;
  blob: Blob;
  buffer: AudioBuffer;
  /** Wall-clock (tempo-adjusted) duration — equals buffer.duration unless playbackRate != 1. */
  durationSec: number;
  gain: number;
  muted: boolean;
  solo: boolean;
  offsetSec: number;
  /** Loop-pedal mode: keep repeating this track while other tracks are dubbed on top. */
  looped: boolean;
  fx: TrackFx;
  /** 1 = native speed. Tempo-synced loop-library tracks use sessionBpm / loopNativeBpm. */
  playbackRate: number;
  /** Which built-in loop (lib/loopLibrary.ts) this track came from, if any. */
  sourceLoopId?: string;
  /** Set once this track has been uploaded to Supabase Storage; absence means "not yet saved." */
  remoteId?: string;
  storagePath?: string;
}

export type TrackPatch = Partial<
  Pick<
    StudioTrack,
    | 'name'
    | 'gain'
    | 'muted'
    | 'solo'
    | 'offsetSec'
    | 'looped'
    | 'fx'
    | 'playbackRate'
    | 'sourceLoopId'
    | 'remoteId'
    | 'storagePath'
  >
>;

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
    looped: track.looped,
    fx: track.fx,
    playbackRate: track.playbackRate,
  }));
}

export function useMultiTrackSession() {
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDecoding, setIsDecoding] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('Untitled Session');

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
  const hasLoopedTrack = useMemo(() => tracks.some((track) => track.looped), [tracks]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      const controller = getController();
      const position = controller.getPositionSec();
      if (!hasLoopedTrack && position >= sessionDurationSec && sessionDurationSec > 0) {
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
  }, [isPlaying, sessionDurationSec, hasLoopedTrack, getController]);

  useEffect(() => {
    if (isPlaying) getController().updateLiveMix(toPlaybackTracks(tracks));
  }, [tracks, isPlaying, getController]);

  const addTrack = useCallback(
    async (blob: Blob, name: string, offsetSec: number, playbackRate = 1) => {
      setIsDecoding(true);
      try {
        const ctx = getAudioContext();
        const buffer = await decodeBlobToBuffer(ctx, blob);
        const track: StudioTrack = {
          id: makeTrackId(),
          name,
          blob,
          buffer,
          durationSec: buffer.duration / playbackRate,
          gain: 1,
          muted: false,
          solo: false,
          offsetSec,
          looped: false,
          fx: DEFAULT_TRACK_FX,
          playbackRate,
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

  const loadTracks = useCallback((next: StudioTrack[]) => {
    getController().stop();
    setTracks(next);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [getController]);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== id));
  }, []);

  const updateTrack = useCallback((id: string, patch: TrackPatch) => {
    setTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...patch } : track)));
  }, []);

  /**
   * Applies a collaborator's saved changes without the full-replace
   * `loadTracks` does — a plain replace would also wipe out any track a
   * collaborator has added locally but not yet saved (no `remoteId` yet).
   * Only tracks already synced (matched by `remoteId`) are touched:
   * patched in place, added if new, or dropped if removed remotely.
   */
  const applyRemoteTrackSync = useCallback(
    (params: { updated: { remoteId: string; patch: TrackPatch }[]; added: StudioTrack[]; removedRemoteIds: string[] }) => {
      setTracks((prev) => {
        const withoutRemoved = prev.filter(
          (track) => !track.remoteId || !params.removedRemoteIds.includes(track.remoteId)
        );
        const patched = withoutRemoved.map((track) => {
          if (!track.remoteId) return track;
          const match = params.updated.find((u) => u.remoteId === track.remoteId);
          return match ? { ...track, ...match.patch } : track;
        });
        const withoutDuplicates = params.added.filter(
          (track) => !patched.some((existing) => existing.remoteId === track.remoteId)
        );
        return [...patched, ...withoutDuplicates];
      });
    },
    []
  );

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
    const startOffset = currentTime;
    recordStartOffsetRef.current = startOffset;

    if (countInEnabled) {
      setIsCountingIn(true);
      await playCountIn(getAudioContext(), bpm, COUNT_IN_BEATS);
      setIsCountingIn(false);
    }

    if (tracks.length > 0) {
      getController().play(toPlaybackTracks(tracks), startOffset);
      setIsPlaying(true);
    }
    await recorder.startRecording();
  }, [currentTime, countInEnabled, bpm, tracks, recorder, getController]);

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
        looped: track.looped,
        fx: track.fx,
        playbackRate: track.playbackRate,
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
    bpm,
    setBpm,
    countInEnabled,
    setCountInEnabled,
    isCountingIn,
    sessionId,
    setSessionId,
    sessionName,
    setSessionName,
    addTrack,
    addTrackFromFile,
    loadTracks,
    removeTrack,
    updateTrack,
    applyRemoteTrackSync,
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

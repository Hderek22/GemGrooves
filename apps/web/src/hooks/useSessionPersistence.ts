import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { DEFAULT_TRACK_FX, decodeBlobToBuffer, getAudioContext, type TrackFx } from '../lib/audioEngine';
import { STUDIO_AUDIO_BUCKET, supabase, supabaseConfigured } from '../lib/supabase';
import type { StudioTrack, TrackPatch, UseMultiTrackSessionReturn } from './useMultiTrackSession';

export interface SavedSessionSummary {
  id: string;
  name: string;
  updatedAt: string;
}

interface TrackRow {
  id: string;
  name: string;
  storage_path: string;
  duration_sec: number;
  gain: number;
  muted: boolean;
  solo: boolean;
  offset_sec: number;
  looped: boolean | null;
  fx_eq_low: number | null;
  fx_eq_mid: number | null;
  fx_eq_high: number | null;
  fx_comp_threshold: number | null;
  fx_comp_ratio: number | null;
  fx_reverb_wet: number | null;
}

function fxFromRow(row: TrackRow): TrackFx {
  return {
    eqLowGainDb: row.fx_eq_low ?? DEFAULT_TRACK_FX.eqLowGainDb,
    eqMidGainDb: row.fx_eq_mid ?? DEFAULT_TRACK_FX.eqMidGainDb,
    eqHighGainDb: row.fx_eq_high ?? DEFAULT_TRACK_FX.eqHighGainDb,
    compThresholdDb: row.fx_comp_threshold ?? DEFAULT_TRACK_FX.compThresholdDb,
    compRatio: row.fx_comp_ratio ?? DEFAULT_TRACK_FX.compRatio,
    reverbWetPct: row.fx_reverb_wet ?? DEFAULT_TRACK_FX.reverbWetPct,
  };
}

function fxToRow(fx: TrackFx) {
  return {
    fx_eq_low: fx.eqLowGainDb,
    fx_eq_mid: fx.eqMidGainDb,
    fx_eq_high: fx.eqHighGainDb,
    fx_comp_threshold: fx.compThresholdDb,
    fx_comp_ratio: fx.compRatio,
    fx_reverb_wet: fx.reverbWetPct,
  };
}

interface SessionRow {
  id: string;
  name: string;
  bpm: number;
  count_in_enabled: boolean;
  is_shared: boolean | null;
}

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

async function downloadAndDecodeTrack(row: TrackRow): Promise<StudioTrack> {
  const { data: blob, error: downloadError } = await supabase.storage
    .from(STUDIO_AUDIO_BUCKET)
    .download(row.storage_path);
  if (downloadError || !blob) {
    throw new Error(downloadError?.message ?? `Could not download audio for "${row.name}"`);
  }

  const buffer = await decodeBlobToBuffer(getAudioContext(), blob);
  return {
    id: row.id,
    name: row.name,
    blob,
    buffer,
    durationSec: row.duration_sec,
    gain: row.gain,
    muted: row.muted,
    solo: row.solo,
    offsetSec: row.offset_sec,
    looped: row.looped ?? false,
    fx: fxFromRow(row),
    remoteId: row.id,
    storagePath: row.storage_path,
  };
}

function trackMetadataPatch(row: TrackRow): TrackPatch {
  return {
    name: row.name,
    gain: row.gain,
    muted: row.muted,
    solo: row.solo,
    offsetSec: row.offset_sec,
    looped: row.looped ?? false,
    fx: fxFromRow(row),
  };
}

export function useSessionPersistence(
  session: UseMultiTrackSessionReturn,
  walletAddress: string | undefined,
  isSignedIn: boolean
) {
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedRemoteIdsRef = useRef<Set<string>>(new Set());

  const { applyRemoteTrackSync, setSessionName, setBpm, setCountInEnabled } = session;

  const refreshSavedSessions = useCallback(async () => {
    if (!supabaseConfigured || !walletAddress || !isSignedIn) {
      setSavedSessions([]);
      return;
    }
    const { data, error: fetchError } = await supabase
      .from('studio_sessions')
      .select('id, name, updated_at')
      .eq('owner_wallet', walletAddress.toLowerCase())
      .order('updated_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setSavedSessions((data ?? []).map((row) => ({ id: row.id, name: row.name, updatedAt: row.updated_at })));
  }, [walletAddress, isSignedIn]);

  const saveSession = useCallback(async () => {
    if (!supabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }
    if (!walletAddress) {
      setError('Connect a wallet first.');
      return;
    }
    if (!isSignedIn) {
      setError('Sign in to collaborate first.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let currentSessionId = session.sessionId;

      if (!currentSessionId) {
        const { data, error: insertError } = await supabase
          .from('studio_sessions')
          .insert({
            owner_wallet: walletAddress.toLowerCase(),
            name: session.sessionName,
            bpm: session.bpm,
            count_in_enabled: session.countInEnabled,
          })
          .select('id')
          .single();
        if (insertError || !data) throw new Error(insertError?.message ?? 'Could not create session');
        currentSessionId = data.id as string;
        session.setSessionId(currentSessionId);
      } else {
        const { error: updateError } = await supabase
          .from('studio_sessions')
          .update({
            name: session.sessionName,
            bpm: session.bpm,
            count_in_enabled: session.countInEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSessionId);
        if (updateError) throw new Error(updateError.message);
      }

      const currentRemoteIds = new Set<string>();

      for (const track of session.tracks) {
        if (!track.remoteId) {
          const ext = extensionForMime(track.blob.type || 'application/octet-stream');
          const storagePath = `${currentSessionId}/${track.id}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from(STUDIO_AUDIO_BUCKET)
            .upload(storagePath, track.blob, {
              contentType: track.blob.type || 'application/octet-stream',
              upsert: true,
            });
          if (uploadError) throw new Error(uploadError.message);

          const { data: trackRow, error: trackInsertError } = await supabase
            .from('studio_tracks')
            .insert({
              session_id: currentSessionId,
              name: track.name,
              storage_path: storagePath,
              duration_sec: track.durationSec,
              gain: track.gain,
              muted: track.muted,
              solo: track.solo,
              offset_sec: track.offsetSec,
              looped: track.looped,
              ...fxToRow(track.fx),
            })
            .select('id')
            .single();
          if (trackInsertError || !trackRow) {
            throw new Error(trackInsertError?.message ?? 'Could not save track');
          }

          const remoteId = trackRow.id as string;
          session.updateTrack(track.id, { remoteId, storagePath });
          currentRemoteIds.add(remoteId);
        } else {
          const { error: trackUpdateError } = await supabase
            .from('studio_tracks')
            .update({
              name: track.name,
              gain: track.gain,
              muted: track.muted,
              solo: track.solo,
              offset_sec: track.offsetSec,
              looped: track.looped,
              ...fxToRow(track.fx),
            })
            .eq('id', track.remoteId);
          if (trackUpdateError) throw new Error(trackUpdateError.message);
          currentRemoteIds.add(track.remoteId);
        }
      }

      const removedIds = [...syncedRemoteIdsRef.current].filter((id) => !currentRemoteIds.has(id));
      if (removedIds.length > 0) {
        await supabase.from('studio_tracks').delete().in('id', removedIds);
      }
      syncedRemoteIdsRef.current = currentRemoteIds;

      await refreshSavedSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session');
    } finally {
      setIsSaving(false);
    }
  }, [session, walletAddress, isSignedIn, refreshSavedSessions]);

  const loadSession = useCallback(
    async (id: string) => {
      if (!isSignedIn) {
        setError('Sign in to collaborate first.');
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { data: sessionRow, error: sessionError } = await supabase
          .from('studio_sessions')
          .select('*')
          .eq('id', id)
          .single();
        if (sessionError || !sessionRow) throw new Error(sessionError?.message ?? 'Session not found');
        const row = sessionRow as SessionRow;

        const { data: trackRows, error: tracksError } = await supabase
          .from('studio_tracks')
          .select('*')
          .eq('session_id', id);
        if (tracksError) throw new Error(tracksError.message);

        const loadedTracks: StudioTrack[] = [];
        for (const trackRow of (trackRows ?? []) as TrackRow[]) {
          loadedTracks.push(await downloadAndDecodeTrack(trackRow));
        }

        session.loadTracks(loadedTracks);
        session.setSessionId(row.id);
        session.setSessionName(row.name);
        session.setBpm(row.bpm);
        session.setCountInEnabled(row.count_in_enabled);
        setIsShared(row.is_shared ?? false);
        syncedRemoteIdsRef.current = new Set(loadedTracks.map((track) => track.remoteId as string));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load session');
      } finally {
        setIsLoading(false);
      }
    },
    [session, isSignedIn]
  );

  /**
   * Self-service join for a session shared via link: adds the connected,
   * signed-in wallet as a collaborator (RLS only allows this when the
   * session's `is_shared` flag is on), then loads it. Already being a
   * member (or already the owner) is fine — the load right after is what
   * actually proves access either way.
   */
  const joinSession = useCallback(
    async (id: string) => {
      if (!supabaseConfigured) {
        setError('Supabase is not configured.');
        return;
      }
      if (!walletAddress || !isSignedIn) {
        setError('Sign in to collaborate first.');
        return;
      }

      const { error: joinError } = await supabase
        .from('studio_session_collaborators')
        .insert({ session_id: id, wallet: walletAddress.toLowerCase() });
      // Postgres 23505 = unique_violation (already a collaborator) — fine.
      // Any other error (e.g. session isn't shared) is left for loadSession
      // to surface as a clear "Session not found" instead of duplicating it.
      if (joinError && joinError.code !== '23505') {
        // no-op: fall through to loadSession
      }

      await loadSession(id);
    },
    [walletAddress, isSignedIn, loadSession]
  );

  /** Marks the current session shareable and returns a link others can join with. */
  const shareSession = useCallback(async (): Promise<string | null> => {
    if (!supabaseConfigured) {
      setError('Supabase is not configured.');
      return null;
    }
    if (!isSignedIn) {
      setError('Sign in to collaborate first.');
      return null;
    }
    if (!session.sessionId) {
      setError('Save the session first, then share it.');
      return null;
    }

    const { error: shareError } = await supabase
      .from('studio_sessions')
      .update({ is_shared: true })
      .eq('id', session.sessionId);
    if (shareError) {
      setError(shareError.message);
      return null;
    }
    setIsShared(true);
    return `${window.location.origin}/TheStudio/${session.sessionId}`;
  }, [isSignedIn, session.sessionId]);

  const newSession = useCallback(() => {
    session.resetSession();
    session.setSessionId(null);
    session.setSessionName('Untitled Session');
    setIsShared(false);
    syncedRemoteIdsRef.current = new Set();
    setError(null);
  }, [session]);

  // Realtime: reflect a collaborator's saved changes as soon as they land.
  // Sync-on-save, not live-per-keystroke — this fires from the same
  // postgres rows saveSession() itself writes, so it also echoes our own
  // saves back to us (harmless: applyRemoteTrackSync is idempotent, and
  // syncedRemoteIdsRef dedupes a self-inserted track from being re-added).
  useEffect(() => {
    const sessionId = session.sessionId;
    if (!sessionId || !supabaseConfigured || !isSignedIn) return;

    const handleTrackChange = async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === 'DELETE') {
        const oldId = (payload.old as Partial<TrackRow>).id;
        if (oldId && syncedRemoteIdsRef.current.has(oldId)) {
          syncedRemoteIdsRef.current.delete(oldId);
          applyRemoteTrackSync({ updated: [], added: [], removedRemoteIds: [oldId] });
        }
        return;
      }

      const row = payload.new as unknown as TrackRow;
      if (syncedRemoteIdsRef.current.has(row.id)) {
        applyRemoteTrackSync({ updated: [{ remoteId: row.id, patch: trackMetadataPatch(row) }], added: [], removedRemoteIds: [] });
        return;
      }

      try {
        const track = await downloadAndDecodeTrack(row);
        syncedRemoteIdsRef.current.add(row.id);
        applyRemoteTrackSync({ updated: [], added: [track], removedRemoteIds: [] });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not sync a collaborator's new track");
      }
    };

    const channel = supabase
      .channel(`studio-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'studio_tracks', filter: `session_id=eq.${sessionId}` },
        (payload) => void handleTrackChange(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'studio_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as SessionRow;
          setSessionName(row.name);
          setBpm(row.bpm);
          setCountInEnabled(row.count_in_enabled);
          setIsShared(row.is_shared ?? false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session.sessionId, isSignedIn, applyRemoteTrackSync, setSessionName, setBpm, setCountInEnabled]);

  return {
    savedSessions,
    refreshSavedSessions,
    saveSession,
    loadSession,
    joinSession,
    shareSession,
    isShared,
    newSession,
    isSaving,
    isLoading,
    error,
  };
}

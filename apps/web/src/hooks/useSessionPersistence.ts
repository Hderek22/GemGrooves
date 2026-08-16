import { useCallback, useRef, useState } from 'react';

import { decodeBlobToBuffer, getAudioContext } from '../lib/audioEngine';
import { STUDIO_AUDIO_BUCKET, supabase, supabaseConfigured } from '../lib/supabase';
import type { StudioTrack, UseMultiTrackSessionReturn } from './useMultiTrackSession';

export interface SavedSessionSummary {
  id: string;
  name: string;
  updatedAt: string;
}

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

export function useSessionPersistence(
  session: UseMultiTrackSessionReturn,
  walletAddress: string | undefined
) {
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedRemoteIdsRef = useRef<Set<string>>(new Set());

  const refreshSavedSessions = useCallback(async () => {
    if (!supabaseConfigured || !walletAddress) {
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
  }, [walletAddress]);

  const saveSession = useCallback(async () => {
    if (!supabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }
    if (!walletAddress) {
      setError('Connect a wallet first.');
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
  }, [session, walletAddress, refreshSavedSessions]);

  const loadSession = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: sessionRow, error: sessionError } = await supabase
          .from('studio_sessions')
          .select('*')
          .eq('id', id)
          .single();
        if (sessionError || !sessionRow) throw new Error(sessionError?.message ?? 'Session not found');

        const { data: trackRows, error: tracksError } = await supabase
          .from('studio_tracks')
          .select('*')
          .eq('session_id', id);
        if (tracksError) throw new Error(tracksError.message);

        const ctx = getAudioContext();
        const loadedTracks: StudioTrack[] = [];
        for (const row of trackRows ?? []) {
          const { data: blob, error: downloadError } = await supabase.storage
            .from(STUDIO_AUDIO_BUCKET)
            .download(row.storage_path);
          if (downloadError || !blob) {
            throw new Error(downloadError?.message ?? `Could not download audio for "${row.name}"`);
          }

          const buffer = await decodeBlobToBuffer(ctx, blob);
          loadedTracks.push({
            id: row.id,
            name: row.name,
            blob,
            buffer,
            durationSec: row.duration_sec,
            gain: row.gain,
            muted: row.muted,
            solo: row.solo,
            offsetSec: row.offset_sec,
            remoteId: row.id,
            storagePath: row.storage_path,
          });
        }

        session.loadTracks(loadedTracks);
        session.setSessionId(sessionRow.id);
        session.setSessionName(sessionRow.name);
        session.setBpm(sessionRow.bpm);
        session.setCountInEnabled(sessionRow.count_in_enabled);
        syncedRemoteIdsRef.current = new Set(loadedTracks.map((track) => track.remoteId as string));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load session');
      } finally {
        setIsLoading(false);
      }
    },
    [session]
  );

  const newSession = useCallback(() => {
    session.resetSession();
    session.setSessionId(null);
    session.setSessionName('Untitled Session');
    syncedRemoteIdsRef.current = new Set();
    setError(null);
  }, [session]);

  return {
    savedSessions,
    refreshSavedSessions,
    saveSession,
    loadSession,
    newSession,
    isSaving,
    isLoading,
    error,
  };
}

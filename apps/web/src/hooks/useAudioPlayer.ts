import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useAudioPlayer() {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const loadFile = useCallback((next: File) => {
    setFile(next);
    setIsPlaying(false);
  }, []);

  const clear = useCallback(() => {
    setFile(null);
    setIsPlaying(false);
  }, []);

  const play = useCallback(() => {
    void audioRef.current?.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  return { file, objectUrl, isPlaying, audioRef, loadFile, clear, play, pause, stop };
}

export type UseAudioPlayerReturn = ReturnType<typeof useAudioPlayer>;

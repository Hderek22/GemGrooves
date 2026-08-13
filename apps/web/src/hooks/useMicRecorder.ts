import { useCallback, useRef, useState } from 'react';

export type MicPermissionState = 'idle' | 'requesting' | 'granted' | 'denied';

export function useMicRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<MicPermissionState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    setPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission('granted');

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setPermission('denied');
      const wrapped = err instanceof Error ? err : new Error('Microphone access failed');
      setError(wrapped);
      throw wrapped;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        reject(new Error('Not currently recording'));
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, permission, error, startRecording, stopRecording };
}

export type UseMicRecorderReturn = ReturnType<typeof useMicRecorder>;

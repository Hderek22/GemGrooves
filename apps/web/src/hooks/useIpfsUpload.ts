import { useCallback, useState } from 'react';

import type { PinRequest, PinResponse } from '../lib/ipfs';

export interface TrackSplit {
  wallet: string;
  shareBPS: number;
}

export interface TrackUploadInput {
  audioFile: File;
  title: string;
  artist: string;
  royaltyBPS: number;
  splits: TrackSplit[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function callPin(request: PinRequest): Promise<string> {
  const res = await fetch('/api/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Pin request failed: ${res.status}`);
  const data = (await res.json()) as PinResponse;
  return data.uri;
}

export function useIpfsUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadTrack = useCallback(async (input: TrackUploadInput): Promise<string> => {
    setIsUploading(true);
    setError(null);
    try {
      const dataBase64 = await fileToBase64(input.audioFile);
      const animationUri = await callPin({
        kind: 'file',
        filename: input.audioFile.name,
        mimeType: input.audioFile.type || 'audio/mpeg',
        dataBase64,
      });

      const metadata = {
        name: input.title,
        artist: input.artist,
        animation_url: animationUri,
        royaltyBPS: input.royaltyBPS,
        splits: input.splits,
      };
      const metadataUri = await callPin({ kind: 'json', payload: metadata });

      return metadataUri;
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Upload failed');
      setError(wrapped);
      throw wrapped;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadTrack, isUploading, error };
}

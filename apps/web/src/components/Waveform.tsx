import { useEffect, useRef } from 'react';

interface WaveformProps {
  buffer: AudioBuffer;
  height?: number;
  color?: string;
}

function Waveform({ buffer, height = 48, color = '#f6ad1b' }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 300;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const data = buffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(data.length / width));
    const mid = height / 2;

    ctx.fillStyle = color;
    for (let x = 0; x < width; x++) {
      let min = 1;
      let max = -1;
      const start = x * samplesPerPixel;
      const end = Math.min(data.length, start + samplesPerPixel);
      for (let i = start; i < end; i++) {
        const value = data[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      const y1 = mid + min * mid;
      const y2 = mid + max * mid;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }, [buffer, height, color]);

  return <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />;
}

export default Waveform;

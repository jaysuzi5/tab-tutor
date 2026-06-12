// Mic capture + AudioContext setup. Raw audio NEVER leaves this device.
// getUserMedia requires a secure context (localhost in dev; HTTPS in prod).

export interface MicStream {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
  stop: () => void;
}

export function micSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    (window.isSecureContext ?? false)
  );
}

export async function startMic(fftSize = 2048): Promise<MicStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia unavailable (needs HTTPS or localhost)");
  }
  // Disable browser DSP that would corrupt pitch/chroma features.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  source.connect(analyser);
  // Note: analyser is NOT connected to destination — we don't echo the mic.

  const stop = () => {
    stream.getTracks().forEach((t) => t.stop());
    source.disconnect();
    analyser.disconnect();
    void ctx.close();
  };
  return { ctx, analyser, source, stream, stop };
}

// RMS input level 0..1, for the calibration level meter.
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

import { useState, useRef, useEffect, useCallback } from 'react';

interface VoiceRecorderProps {
  onRecordComplete: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

const MAX_DURATION = 60; // seconds

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ onRecordComplete, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'unsupported'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check support on mount
  useEffect(() => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setState('unsupported');
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Choose mime type with fallback
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const duration = elapsed;
        cleanup();
        if (blob.size > 0) {
          onRecordComplete(blob, duration);
        }
      };

      recorder.start(100); // collect data every 100ms
      setState('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_DURATION) {
            // Auto-stop
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      // Permission denied or error
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setState('idle');
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setState('idle');
    setElapsed(0);
    onCancel();
  };

  if (state === 'unsupported') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-muted text-xs">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
        </svg>
        Voice recording not supported
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Pulsing red indicator */}
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </span>

        {/* Timer */}
        <span className="text-sm font-mono text-white min-w-[40px]">{formatTime(elapsed)}</span>

        {/* Progress bar */}
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }}
          />
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={cancelRecording}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
          aria-label="Cancel recording"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Stop / Send */}
        <button
          type="button"
          onClick={stopRecording}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-gold/20 text-gold hover:bg-gold/30 transition-colors"
          aria-label="Stop and send recording"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>
    );
  }

  // Idle state — mic button
  return (
    <button
      type="button"
      onClick={startRecording}
      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-muted hover:text-gold hover:bg-gold/10 transition-colors"
      aria-label="Start voice recording"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}

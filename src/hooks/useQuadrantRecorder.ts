import { useCallback, useEffect, useRef, useState } from 'react';
import type { CellId } from '../utils/soundGrid';

const MAX_RECORD_SEC = 30;

function pickRecorderFormat(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', extension: 'webm' };
  }

  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/aac', extension: 'aac' }
  ];

  const match = candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType));
  return match ?? { mimeType: '', extension: 'webm' };
}

export function useQuadrantRecorder() {
  const [recordingQuadrant, setRecordingQuadrant] = useState<CellId | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((file: File | null) => void) | null>(null);
  const cancelledRef = useRef(false);
  const quadrantRef = useRef<CellId | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    clearTimer();
    releaseStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    quadrantRef.current = null;
    setRecordingQuadrant(null);
    setElapsedSec(0);
  }, [clearTimer, releaseStream]);

  const stopRecording = useCallback(async (): Promise<File | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return null;
    }

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    resetState();
  }, [resetState]);

  const startRecording = useCallback(
    async (quadrantId: CellId): Promise<void> => {
      if (recordingQuadrant) {
        throw new Error('Already recording');
      }

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Recording is not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType, extension } = pickRecorderFormat();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      cancelledRef.current = false;
      chunksRef.current = [];
      quadrantRef.current = quadrantId;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const id = quadrantRef.current;
        const wasCancelled = cancelledRef.current;
        cancelledRef.current = false;

        let file: File | null = null;
        if (!wasCancelled && id && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || mimeType || 'audio/webm'
          });
          if (blob.size > 0) {
            file = new File([blob], `recording-${id}-${Date.now()}.${extension}`, {
              type: blob.type
            });
          }
        }

        resetState();
        stopResolverRef.current?.(file);
        stopResolverRef.current = null;
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setRecordingQuadrant(quadrantId);
      setElapsedSec(0);
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        setElapsedSec((seconds) => {
          const next = seconds + 1;
          if (next >= MAX_RECORD_SEC) {
            void stopRecording();
          }
          return next;
        });
      }, 1000);
    },
    [recordingQuadrant, resetState, stopRecording]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resetState();
      }
    };
  }, [resetState]);

  return {
    recordingQuadrant,
    elapsedSec,
    maxRecordSec: MAX_RECORD_SEC,
    isSupported:
      typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    startRecording,
    stopRecording,
    cancelRecording
  };
};

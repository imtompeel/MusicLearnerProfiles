import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBlinkDetectorState,
  getSecondBlinkCountdown,
  processBlinkFrame,
  type BlinkDetectorState,
  type BlinkLogEvent,
} from '../utils/blinkDetection';

declare global {
  interface Window {
    FaceMesh: any;
  }
}

const PROCESS_INTERVAL_MS = 70;

interface UseBlinkPauseOptions {
  enabled: boolean;
  onTogglePause: () => void;
  onLog?: (message: string) => void;
}

export function useBlinkPause({ enabled, onTogglePause, onLog }: UseBlinkPauseOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const countdownRafRef = useRef<number | null>(null);
  const lastProcessRef = useRef(0);
  const blinkStateRef = useRef<BlinkDetectorState>(createBlinkDetectorState());
  const onTogglePauseRef = useRef(onTogglePause);
  const onLogRef = useRef(onLog);

  const [isReady, setIsReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [secondBlinkCountdown, setSecondBlinkCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const logBlink = useCallback((event: BlinkLogEvent, detail?: string) => {
    const message = detail ? `blink:${event} ${detail}` : `blink:${event}`;
    onLogRef.current?.(message);
  }, []);

  const resetBlinkDetection = useCallback(() => {
    blinkStateRef.current = createBlinkDetectorState();
    setSecondBlinkCountdown(0);
    onLogRef.current?.('blink:reset');
  }, []);

  useEffect(() => {
    onTogglePauseRef.current = onTogglePause;
  }, [onTogglePause]);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  const updateCountdown = useCallback(() => {
    const remaining = getSecondBlinkCountdown(blinkStateRef.current, performance.now());
    setSecondBlinkCountdown(remaining);
    if (enabled && remaining > 0) {
      countdownRafRef.current = requestAnimationFrame(updateCountdown);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSecondBlinkCountdown(0);
      if (countdownRafRef.current !== null) {
        cancelAnimationFrame(countdownRafRef.current);
        countdownRafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const remaining = getSecondBlinkCountdown(blinkStateRef.current, performance.now());
      setSecondBlinkCountdown(remaining);
      countdownRafRef.current = requestAnimationFrame(tick);
    };

    countdownRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (countdownRafRef.current !== null) {
        cancelAnimationFrame(countdownRafRef.current);
        countdownRafRef.current = null;
      }
    };
  }, [enabled]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    blinkStateRef.current = createBlinkDetectorState();
    setSecondBlinkCountdown(0);
    setIsFaceDetected(false);
    setIsReady(false);
  }, []);

  const onFaceResults = useCallback(
    (results: any) => {
      const landmarks = results.multiFaceLandmarks?.[0];
      const now = performance.now();

      if (!landmarks) {
        if (blinkStateRef.current.blinkCount > 0 || blinkStateRef.current.lastBlinkAt) {
          logBlink('face-lost');
        }
        blinkStateRef.current = createBlinkDetectorState();
        setSecondBlinkCountdown(0);
        setIsFaceDetected(false);
        return;
      }

      setIsFaceDetected(true);
      const { state, shouldToggle, secondBlinkCountdown: countdown, logEvent, logDetail } =
        processBlinkFrame(landmarks, blinkStateRef.current, now);
      blinkStateRef.current = state;
      setSecondBlinkCountdown(countdown);

      if (logEvent && logEvent !== 'armed') {
        logBlink(logEvent, logDetail);
      }

      if (shouldToggle) {
        onTogglePauseRef.current();
        setSecondBlinkCountdown(0);
      }
    },
    [logBlink],
  );

  useEffect(() => {
    if (!enabled) {
      stopCamera();
      setError(null);
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    videoRef.current = video;

    const start = async () => {
      setError(null);
      onLogRef.current?.('blink:camera-starting');

      let attempts = 0;
      while ((typeof window === 'undefined' || !window.FaceMesh) && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts += 1;
      }

      if (cancelled) return;

      if (!window.FaceMesh) {
        setError('Blink detection model failed to load.');
        onLogRef.current?.('blink:error model-missing');
        return;
      }

      try {
        const faceMesh = new window.FaceMesh({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(onFaceResults);
        faceMeshRef.current = faceMesh;
        onLogRef.current?.('blink:model-ready');
      } catch {
        if (!cancelled) {
          setError('Could not start blink detection.');
          onLogRef.current?.('blink:error model-start-failed');
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 320,
            height: 240,
            facingMode: 'user',
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setIsReady(true);
        onLogRef.current?.('blink:camera-ready');

        const processFrame = async () => {
          if (cancelled || !streamRef.current || !videoRef.current || !faceMeshRef.current) {
            return;
          }

          const now = performance.now();
          if (now - lastProcessRef.current >= PROCESS_INTERVAL_MS) {
            lastProcessRef.current = now;
            try {
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch {
              onLogRef.current?.('blink:frame-error');
            }
          }

          rafRef.current = requestAnimationFrame(processFrame);
        };

        rafRef.current = requestAnimationFrame(processFrame);
      } catch {
        if (!cancelled) {
          setError('Camera access is required for blink pause.');
          onLogRef.current?.('blink:error camera-denied');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
      faceMeshRef.current = null;
      videoRef.current = null;
      onLogRef.current?.('blink:camera-stopped');
    };
  }, [enabled, onFaceResults, stopCamera]);

  return {
    isReady,
    isFaceDetected,
    secondBlinkCountdown,
    error,
    resetBlinkDetection,
  };
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStatus } from '../hooks/useStatus';

interface HandGestureSessionProps {
  onBack: () => void;
}

// Declare MediaPipe Hands types (loaded from CDN)
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
  }
}

// Tone frequencies for each finger count (musical notes - C major scale)
const TONE_FREQUENCIES = [
  261.63, // C4 - 1 finger
  293.66, // D4 - 2 fingers
  329.63, // E4 - 3 fingers
  349.23, // F4 - 4 fingers
  392.00, // G4 - 5 fingers
  440.00, // A4 - 6 fingers
  493.88, // B4 - 7 fingers
  523.25, // C5 - 8 fingers
  587.33, // D5 - 9 fingers
  659.25  // E5 - 10 fingers
];

// Generate a simple tone using Web Audio API
const playTone = (frequency: number, duration: number = 0.3): void => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';

  // Envelope: fade in and out
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

export const HandGestureSession: React.FC<HandGestureSessionProps> = ({ onBack }) => {
  const { showSuccess, showError } = useStatus();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFingers, setDetectedFingers] = useState<number | null>(null);
  const [leftHandFingers, setLeftHandFingers] = useState<number | null>(null);
  const [rightHandFingers, setRightHandFingers] = useState<number | null>(null);
  const [lastPlayedGesture, setLastPlayedGesture] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Count extended fingers from MediaPipe landmarks
  const countExtendedFingers = useCallback((landmarks: any[]): number => {
    if (!landmarks || landmarks.length < 21) return 0;

    // MediaPipe hand landmark indices
    // Thumb: 4 (tip), 3 (IP), 2 (MP)
    // Index: 8 (tip), 6 (PIP), 5 (MCP)
    // Middle: 12 (tip), 10 (PIP), 9 (MCP)
    // Ring: 16 (tip), 14 (PIP), 13 (MCP)
    // Pinky: 20 (tip), 18 (PIP), 17 (MCP)
    
    let extendedCount = 0;

    // Thumb: check if tip is to the right of IP joint (for right hand)
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    if (thumbTip.x > thumbIP.x) {
      extendedCount++;
    }

    // Other fingers: check if tip is above PIP joint
    const fingerTips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
    const fingerPIPs = [6, 10, 14, 18];

    for (let i = 0; i < fingerTips.length; i++) {
      const tip = landmarks[fingerTips[i]];
      const pip = landmarks[fingerPIPs[i]];
      if (tip.y < pip.y) { // y is smaller when higher on screen
        extendedCount++;
      }
    }

    return extendedCount;
  }, []);

  // Process hand detection results
  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw video frame
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      let leftCount = 0;
      let rightCount = 0;
      let totalCount = 0;

      // Process each detected hand
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness?.[i];
        const isLeftHand = handedness?.label === 'Left' || handedness?.label === 'LEFT';
        
        // Count extended fingers
        const fingerCount = countExtendedFingers(landmarks);
        
        if (isLeftHand) {
          leftCount = fingerCount;
        } else {
          rightCount = fingerCount;
        }
        
        totalCount += fingerCount;

        // Draw hand landmarks with different colors for left/right
        const handColor = isLeftHand ? '#00FFFF' : '#00FF00'; // Cyan for left, Green for right
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctx, landmarks, window.Hands.HAND_CONNECTIONS, { color: handColor, lineWidth: 2 });
          window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
        }
      }

      // Update state
      setLeftHandFingers(leftCount > 0 ? leftCount : null);
      setRightHandFingers(rightCount > 0 ? rightCount : null);
      setDetectedFingers(totalCount);

      // Trigger tone based on total finger count (up to 10)
      const toneFingerCount = Math.min(totalCount, 10);
      if (totalCount > 0 && toneFingerCount > 0 && toneFingerCount !== lastPlayedGesture && !isPlaying) {
        setLastPlayedGesture(toneFingerCount);
        setIsPlaying(true);
        
        const frequency = TONE_FREQUENCIES[toneFingerCount - 1];
        playTone(frequency, 0.3);
        
        // Reset playing state after tone duration
        setTimeout(() => {
          setIsPlaying(false);
        }, 300);
      }
    } else {
      setDetectedFingers(null);
      setLeftHandFingers(null);
      setRightHandFingers(null);
      setLastPlayedGesture(null);
    }

    ctx.restore();
  }, [lastPlayedGesture, isPlaying, countExtendedFingers]);

  // Load MediaPipe Hands model
  useEffect(() => {
    const loadModel = async () => {
      // Wait for MediaPipe Hands to load from CDN
      let attempts = 0;
      const maxAttempts = 50;
      
      while ((typeof window === 'undefined' || !window.Hands) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (typeof window === 'undefined' || !window.Hands) {
        console.error('MediaPipe Hands not loaded. Please ensure scripts are loaded in index.html.');
        showError('Hand gesture recognition requires MediaPipe Hands. Please refresh the page.');
        return;
      }

      setIsModelLoading(true);
      try {
        const hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);
        handsRef.current = hands;
        setIsModelLoading(false);
        showSuccess('Hand gesture model loaded successfully!');
      } catch (err) {
        console.error('Failed to load MediaPipe Hands:', err);
        showError('Failed to load hand gesture model. Please refresh the page.');
        setIsModelLoading(false);
      }
    };

    loadModel();
  }, [onResults, showSuccess, showError]);

  // Start/stop camera
  const startCamera = async () => {
    if (!videoRef.current || !handsRef.current) {
      showError('Hand model not ready. Please wait for model to load.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      streamRef.current = stream;
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            videoRef.current.play();
            
            // Set canvas size
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;

            // Start camera processing
            if (window.Camera) {
              const camera = new window.Camera(videoRef.current, {
                onFrame: async () => {
                  if (handsRef.current && videoRef.current) {
                    await handsRef.current.send({ image: videoRef.current });
                  }
                },
                width: 640,
                height: 480
              });
              cameraRef.current = camera;
              camera.start();
            } else {
              // Fallback: manual frame processing
              const processFrame = async () => {
                if (handsRef.current && videoRef.current && isCameraActive) {
                  await handsRef.current.send({ image: videoRef.current });
                  requestAnimationFrame(processFrame);
                }
              };
              processFrame();
            }
          }
        };
      }
    } catch (err) {
      console.error('Failed to access camera:', err);
      showError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setDetectedFingers(null);
    setLastPlayedGesture(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="hand-gesture-session">
      <div className="session-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Sessions
        </button>
        <h2>✋ Hand Gesture Session</h2>
        <p>Show 1-10 fingers (on one or both hands) to trigger different tones!</p>
      </div>

      {isModelLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading hand gesture model...</p>
        </div>
      )}

      {!isModelLoading && handsRef.current && (
        <div className="gesture-controls">
          <div className="camera-section">
            <div className="video-container">
              <video
                ref={videoRef}
                className="gesture-video"
                autoPlay
                playsInline
                muted
                style={{ display: isCameraActive ? 'block' : 'none' }}
              />
              <canvas
                ref={canvasRef}
                className="gesture-canvas"
                style={{ display: isCameraActive ? 'block' : 'none' }}
              />
              {!isCameraActive && (
                <div className="camera-placeholder">
                  <p>📷 Camera not active</p>
                  <p>Click "Start Camera" to begin</p>
                </div>
              )}
            </div>

            <div className="camera-buttons">
              {!isCameraActive ? (
                <button className="btn-start-camera" onClick={startCamera}>
                  📷 Start Camera
                </button>
              ) : (
                <button className="btn-stop-camera" onClick={stopCamera}>
                  ⏹️ Stop Camera
                </button>
              )}
            </div>
          </div>

          <div className="gesture-info">
            <div className="detected-gesture">
              {detectedFingers !== null ? (
                <div className="finger-count-display">
                  <span className="finger-count-number">{detectedFingers}</span>
                  <span className="finger-count-label">
                    {detectedFingers === 1 ? 'finger' : 'fingers'} total
                  </span>
                  {(leftHandFingers !== null || rightHandFingers !== null) && (
                    <div className="hand-breakdown">
                      {leftHandFingers !== null && (
                        <span className="hand-count">Left: {leftHandFingers}</span>
                      )}
                      {rightHandFingers !== null && (
                        <span className="hand-count">Right: {rightHandFingers}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="no-detection">No hands detected</p>
              )}
            </div>

            <div className="gesture-instructions">
              <h3>How to use:</h3>
              <ul>
                <li>👆 1 finger = C note (262 Hz)</li>
                <li>✌️ 2 fingers = D note (294 Hz)</li>
                <li>🤟 3 fingers = E note (330 Hz)</li>
                <li>🖖 4 fingers = F note (349 Hz)</li>
                <li>🖐️ 5 fingers = G note (392 Hz)</li>
                <li>✋ 6 fingers = A note (440 Hz)</li>
                <li>🤚 7 fingers = B note (494 Hz)</li>
                <li>👋 8 fingers = C note (523 Hz)</li>
                <li>🤏 9 fingers = D note (587 Hz)</li>
                <li>👌 10 fingers = E note (659 Hz)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

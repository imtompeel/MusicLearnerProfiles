import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useFreesound } from '../hooks/useFreesound';
import type { FreesoundResult } from '../utils/freesound';
import { useCameraDevices } from '../hooks/useCameraDevices';

interface HandGestureSessionProps {
  onBack: () => void;
}

// Declare MediaPipe Hands and FaceMesh types (loaded from CDN)
declare global {
  interface Window {
    Hands: any;
    FaceMesh: any;
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
  // Louder peak while staying below clipping
  gainNode.gain.linearRampToValueAtTime(1.0, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

export const HandGestureSession: React.FC<HandGestureSessionProps> = ({ onBack }) => {
  const { showSuccess, showError } = useStatus();
  const { playSound, getBestSoundForLabel } = useFreesound();
  const {
    devices: cameraDevices,
    refreshDevices,
    getDefaultFrontCamera,
    getDefaultBackCamera,
    getNextCamera
  } = useCameraDevices();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const minIntervalRef = useRef<number>(120);
  const videoSizeRef = useRef<{ width: number; height: number }>({
    width: 320,
    height: 240
  });
  
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode] = useState<'user' | 'environment'>('user');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [detectedFingers, setDetectedFingers] = useState<number | null>(null);
  const [leftHandFingers, setLeftHandFingers] = useState<number | null>(null);
  const [rightHandFingers, setRightHandFingers] = useState<number | null>(null);
  const [lastPlayedGesture, setLastPlayedGesture] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'hand' | 'face'>('hand');

  const activeTabRef = useRef<'hand' | 'face'>('hand');
  const lastExpressionRef = useRef<'neutral' | 'smile' | 'frown' | 'shock'>('neutral');
  const expressionStableFramesRef = useRef<number>(0);
  const lastExpressionSoundRef = useRef<'neutral' | 'smile' | 'frown' | 'shock'>('neutral');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string | null>(null);
  const [faceEffectSounds, setFaceEffectSounds] = useState<{
    smile?: FreesoundResult;
    frown?: FreesoundResult;
    shock?: FreesoundResult;
  }>({});

  // Use lighter settings in dev to help camera performance
  const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

  // Keep ref in sync with tab for use in callbacks
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Preload a small set of Freesound effects for face gestures
  useEffect(() => {
    let isCancelled = false;

    const loadFaceEffects = async () => {
      try {
        const smile = await getBestSoundForLabel('cheer', {
          includeTags: ['cheer', 'applause', 'crowd'],
          maxDuration: 5
        });
        const frown = await getBestSoundForLabel('thud', {
          includeTags: ['hit', 'impact', 'thud', 'boom'],
          maxDuration: 3
        });
        const shock = await getBestSoundForLabel('whoosh', {
          includeTags: ['whoosh', 'swoosh', 'rise'],
          maxDuration: 3
        });

        if (!isCancelled) {
          setFaceEffectSounds({
            smile: smile ?? undefined,
            frown: frown ?? undefined,
            shock: shock ?? undefined
          });
        }
      } catch (e) {
        console.error('Failed to load face effect sounds', e);
      }
    };

    loadFaceEffects();

    return () => {
      isCancelled = true;
    };
  }, [getBestSoundForLabel]);

  // Choose an initial quality preset based on device capabilities
  useEffect(() => {
    try {
      const hwThreads =
        typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency
          ? (navigator as any).hardwareConcurrency
          : 4;
      const deviceMemory =
        typeof navigator !== 'undefined' && (navigator as any).deviceMemory
          ? (navigator as any).deviceMemory
          : 4;

      if (hwThreads >= 8 && deviceMemory >= 8) {
        // Higher-end machines: slightly bigger image and a bit more frequent processing
        videoSizeRef.current = { width: 640, height: 480 };
        minIntervalRef.current = isDev ? 120 : 70;
      } else if (hwThreads >= 4 && deviceMemory >= 4) {
        // Mid-range default
        videoSizeRef.current = { width: 480, height: 360 };
        minIntervalRef.current = isDev ? 140 : 90;
      } else {
        // Lower-end: keep it light
        videoSizeRef.current = { width: 320, height: 240 };
        minIntervalRef.current = isDev ? 170 : 120;
      }
    } catch {
      // Fall back to safe defaults if any detection fails
      videoSizeRef.current = { width: 320, height: 240 };
      minIntervalRef.current = isDev ? 170 : 120;
    }
  }, [isDev]);

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

  type FaceLandmark = { x: number; y: number; z?: number };
  type FaceExpression = 'neutral' | 'smile' | 'frown' | 'shock';

  const distance = (a: FaceLandmark, b: FaceLandmark): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };

  // Derive a very simple expression classification from face landmarks
  const getFaceExpression = useCallback((landmarks: FaceLandmark[]): FaceExpression => {
    if (!landmarks || landmarks.length < 300) {
      return 'neutral';
    }

    // Indices based on MediaPipe FaceMesh topology
    const leftMouth: FaceLandmark = landmarks[61];
    const rightMouth: FaceLandmark = landmarks[291];
    const upperLip: FaceLandmark = landmarks[13];
    const lowerLip: FaceLandmark = landmarks[14];

    const mouthWidth = distance(leftMouth, rightMouth);
    const mouthHeight = distance(upperLip, lowerLip);

    const mouthCentreY = (upperLip.y + lowerLip.y) / 2;
    const mouthCornersAvgY = (leftMouth.y + rightMouth.y) / 2;

    if (mouthWidth <= 0) {
      return 'neutral';
    }

    const aspect = mouthHeight / mouthWidth;

    // Shock: mouth very open relative to width
    if (aspect > 0.5) {
      return 'shock';
    }

    const verticalDelta = mouthCornersAvgY - mouthCentreY;

    // In image coordinates, smaller y is higher on screen
    if (verticalDelta < -0.015) {
      // corners higher than centre -> smile
      return 'smile';
    }

    if (verticalDelta > 0.02) {
      // corners lower than centre -> frown
      return 'frown';
    }

    return 'neutral';
  }, []);

  const playCheerTone = (baseFreq: number) => {
    // Simple rising two-note cheer
    playTone(baseFreq, 0.2);
    setTimeout(() => {
      playTone(baseFreq * (5 / 4), 0.25); // major third above
    }, 160);
  };

  const playBooTone = (baseFreq: number) => {
    // Simple descending two-note boo
    playTone(baseFreq, 0.25);
    setTimeout(() => {
      playTone(baseFreq * 0.7, 0.25);
    }, 180);
  };

  const playGaspTone = (baseFreq: number) => {
    // Short high blip
    playTone(baseFreq * 1.5, 0.2);
  };

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

      if (activeTabRef.current === 'hand' && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
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
      if (
        activeTabRef.current === 'hand' &&
        totalCount > 0 &&
        toneFingerCount > 0 &&
        toneFingerCount !== lastPlayedGesture &&
        !isPlaying
      ) {
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

  // Process face detection results
  const onFaceResults = useCallback(
    (results: any) => {
      if (!canvasRef.current || !videoRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear and draw video frame
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 && activeTabRef.current === 'face') {
        const landmarks: FaceLandmark[] = results.multiFaceLandmarks[0];

        // Draw face landmarks as a simple overlay
        if (window.drawLandmarks) {
          window.drawLandmarks(ctx, landmarks, { color: '#00FFAA', lineWidth: 1, radius: 1.5 });
        }

        const expr = getFaceExpression(landmarks);

        // Track stable expression over several frames
        if (expr === lastExpressionRef.current) {
          expressionStableFramesRef.current += 1;
        } else {
          lastExpressionRef.current = expr;
          expressionStableFramesRef.current = 1;
        }

        const stableEnough = expressionStableFramesRef.current >= 3;
        if (
          expr !== 'neutral' &&
          stableEnough &&
          expr !== lastExpressionSoundRef.current &&
          !isPlaying
        ) {
          lastExpressionSoundRef.current = expr;
          setIsPlaying(true);

          // Map expressions to Freesound effects, with tone fallback
          if (expr === 'smile') {
            if (faceEffectSounds.smile) {
              void playSound(faceEffectSounds.smile, { fadeInMs: 50 }).catch((e) => {
                console.error('Failed to play smile sound', e);
                playCheerTone(440);
              });
            } else {
              playCheerTone(440); // fallback tone
            }
          } else if (expr === 'frown') {
            if (faceEffectSounds.frown) {
              void playSound(faceEffectSounds.frown, { fadeInMs: 10 }).catch((e) => {
                console.error('Failed to play frown sound', e);
                playBooTone(196);
              });
            } else {
              playBooTone(196); // fallback
            }
          } else if (expr === 'shock') {
            if (faceEffectSounds.shock) {
              void playSound(faceEffectSounds.shock, { fadeInMs: 10 }).catch((e) => {
                console.error('Failed to play shock sound', e);
                playGaspTone(523.25);
              });
            } else {
              playGaspTone(523.25); // fallback
            }
          }

          setTimeout(() => {
            setIsPlaying(false);
          }, 350);
        }
      } else {
        lastExpressionRef.current = 'neutral';
        expressionStableFramesRef.current = 0;
      }

      ctx.restore();
    },
    [getFaceExpression, isPlaying, faceEffectSounds, playSound]
  );

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

  // Load MediaPipe Face Mesh model
  useEffect(() => {
    const loadFaceModel = async () => {
      let attempts = 0;
      const maxAttempts = 50;

      while ((typeof window === 'undefined' || !(window as any).FaceMesh) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts += 1;
      }

      if (typeof window === 'undefined' || !(window as any).FaceMesh) {
        console.error('MediaPipe FaceMesh not loaded. Please ensure scripts are loaded in index.html.');
        return;
      }

      try {
        const faceMesh = new (window as any).FaceMesh({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceResults);
        faceMeshRef.current = faceMesh;
      } catch (err) {
        console.error('Failed to load MediaPipe FaceMesh:', err);
      }
    };

    loadFaceModel();
  }, [onFaceResults]);

  // Start/stop camera
  type CameraSelection = {
    deviceId?: string | null;
    role?: 'front' | 'back';
  };

  const startCamera = async (selection?: CameraSelection) => {
    if (!videoRef.current || !handsRef.current) {
      showError('Hand model not ready. Please wait for model to load.');
      return;
    }

    try {
      // Pick resolution based on detected device capabilities
      const { width, height } = videoSizeRef.current;

      // Decide which device to open based on selection and known devices
      let targetDeviceId: string | undefined | null = selection?.deviceId ?? activeDeviceId;

      // If we don't yet have any classified devices, refresh them first
      let devicesToUse = cameraDevices;
      if (!devicesToUse.length) {
        devicesToUse = await refreshDevices();
      }

      if (!targetDeviceId && selection?.role) {
        if (selection.role === 'front') {
          const front = getDefaultFrontCamera(devicesToUse);
          targetDeviceId = front?.deviceId ?? null;
        } else if (selection.role === 'back') {
          const back = getDefaultBackCamera(devicesToUse);
          targetDeviceId = back?.deviceId ?? null;
        }
      }

      const videoConstraints: MediaStreamConstraints['video'] =
        targetDeviceId
          ? {
              width,
              height,
              deviceId: { exact: targetDeviceId }
            }
          : {
              width,
              height,
              facingMode: facingMode
            };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });

      streamRef.current = stream;
      setIsCameraActive(true);

      // Track which device is active and what other cameras exist
      try {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }

        const devices = await refreshDevices();
        const active = devices.find((d) => d.deviceId === settings.deviceId);
        if (active) {
          setActiveCameraLabel(active.label || 'Active camera');
        } else if (track.label) {
          setActiveCameraLabel(track.label);
        } else {
          setActiveCameraLabel(null);
        }
      } catch {
        // If device enumeration fails, just continue without switching support
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            videoRef.current.play();

            // Set canvas size
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;

            // Start camera processing using a single requestAnimationFrame loop
            const processFrame = async () => {
              if (videoRef.current && isCameraActive) {
                const now = performance.now();
                const minIntervalMs = minIntervalRef.current;
                if (now - lastProcessTimeRef.current >= minIntervalMs) {
                  lastProcessTimeRef.current = now;
                  const mode = activeTabRef.current;
                  if (mode === 'hand' && handsRef.current) {
                    await handsRef.current.send({ image: videoRef.current });
                  } else if (mode === 'face' && faceMeshRef.current) {
                    await faceMeshRef.current.send({ image: videoRef.current });
                  }
                }
                requestAnimationFrame(processFrame);
              }
            };
            void processFrame();
          }
        };
      }
    } catch (err) {
      console.error('Failed to access camera:', err);
      showError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const toggleCameraFacing = async () => {
    let devicesList = cameraDevices;
    if (!devicesList.length) {
      devicesList = await refreshDevices();
    }

    if (!devicesList.length) {
      return;
    }

    const front = getDefaultFrontCamera(devicesList);
    const back = getDefaultBackCamera(devicesList);

    let targetDeviceId: string | null | undefined = null;

    if (front && back) {
      const currentIsBack = activeDeviceId === back.deviceId;
      targetDeviceId = currentIsBack ? front.deviceId : back.deviceId;
    } else {
      const next = getNextCamera(activeDeviceId, devicesList);
      targetDeviceId = next?.deviceId;
    }

    if (!targetDeviceId) return;

    if (isCameraActive) {
      stopCamera();
    }
    await startCamera({ deviceId: targetDeviceId });
  };

  const stopCamera = () => {
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
        <h2>✋ Gesture Session</h2>
        <p>
          {isDev && activeTab === 'face'
            ? 'Facial gestures (experimental – dev only). Smile for a cheer, frown for a thud, look surprised for a whoosh.'
            : 'Show 1–10 fingers (on one or both hands) to trigger different tones.'}
        </p>
        {isDev && (
          <div className="gesture-tabs">
            <button
              type="button"
              className={`gesture-tab ${activeTab === 'hand' ? 'active' : ''}`}
              onClick={() => setActiveTab('hand')}
            >
              ✋ Hand gestures
            </button>
            <button
              type="button"
              className={`gesture-tab ${activeTab === 'face' ? 'active' : ''}`}
              onClick={() => setActiveTab('face')}
            >
              🙂 Facial gestures
            </button>
          </div>
        )}
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
                <button
                  className="btn-start-camera"
                  onClick={() => {
                    void startCamera();
                  }}
                >
                  📷 Start Camera
                </button>
              ) : (
                <>
                  <button className="btn-stop-camera" onClick={stopCamera}>
                    ⏹️ Stop Camera
                  </button>
                  <button
                    className="btn-start-camera"
                    style={{ marginLeft: '10px' }}
                    onClick={() => {
                      void toggleCameraFacing();
                    }}
                  >
                    🔄 Switch Camera
                  </button>
                </>
              )}
              {cameraDevices.length > 1 && (
                <select
                  value={activeDeviceId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    if (!id) return;
                    if (isCameraActive) {
                      stopCamera();
                    }
                    void startCamera({ deviceId: id });
                  }}
                  style={{
                    marginLeft: '12px',
                    padding: '4px 8px',
                    fontSize: '0.85rem'
                  }}
                >
                  {cameraDevices.map((d) => {
                    const friendly =
                      d.role === 'front'
                        ? 'Front camera'
                        : d.role === 'back'
                        ? 'Back camera'
                        : d.label || 'Camera';
                    return (
                      <option key={d.deviceId} value={d.deviceId}>
                        {friendly}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          <div className="gesture-info">
            <div className="detected-gesture">
              {activeTab === 'hand' ? (
                detectedFingers !== null ? (
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
                )
              ) : (
                <div className="finger-count-display">
                  <span className="finger-count-label">
                    {activeCameraLabel ? `Camera: ${activeCameraLabel}` : 'Face camera active'}
                  </span>
                  <span className="finger-count-label">
                    Smile for a cheer, frown for a thud, look surprised for a whoosh.
                  </span>
                </div>
              )}
            </div>

            <div className="gesture-instructions">
              <h3>How to use:</h3>
              {activeTab === 'hand' || !isDev ? (
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
              ) : (
                <ul>
                  <li>😄 Smile – triggers a crowd cheer</li>
                  <li>😖 Frown – triggers a thud/impact sound</li>
                  <li>😮 Surprise – triggers a whoosh/rise sound</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

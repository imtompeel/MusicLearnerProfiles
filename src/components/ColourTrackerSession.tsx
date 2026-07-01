import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useCameraDevices } from '../hooks/useCameraDevices';
import { useFreesound } from '../hooks/useFreesound';
import { useAuth } from '../contexts/AuthContext';
import { resumeAudioContext, playNote } from '../utils/audio';
import { deleteQuadrantSound, uploadQuadrantSound, validateQuadrantAudioFile } from '../utils/quadrantSoundStorage';
import {
  QuadrantAudioEngine,
  type CellId,
  type QuadrantSoundConfig,
  getSoundLabel,
  getConfigFrequencies,
  loadMirrorView,
  loadQuadrantSounds,
  remapConfigsForLayout,
  saveMirrorView,
  saveQuadrantSounds
} from '../utils/quadrantAudio';
import {
  type GridLayout,
  MAX_GRID_DIMENSION,
  MIN_GRID_DIMENSION,
  clampGridLayout,
  computeCellWeights,
  emptyCellWeights,
  getCellIds,
  getCellMeta,
  loadGridLayout,
  parseCellId,
  saveGridLayout
} from '../utils/soundGrid';
import {
  type ColorProfile,
  COLOR_PRESETS,
  DEFAULT_COLOR_PROFILE,
  detectColoredObject,
  loadSavedColorProfile,
  matchesColorProfile,
  profileFromHex,
  profileFromSample,
  profileToHex,
  saveColorProfile,
  sampleAreaRgb
} from '../utils/colorTracking';
import { QuadrantSoundPanel } from './QuadrantSoundPanel';
import { MixZoneOverlay } from './MixZoneOverlay';
import {
  DEFAULT_MIX_ZONE,
  loadMixZone,
  mixZoneBleedLabel,
  saveMixZone,
  type MixZone
} from '../utils/mixZone';

interface ColourTrackerSessionProps {
  onBack: () => void;
}

const SAMPLE_STEP = 4;
const CENTERED_MIX_ZONE: MixZone = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirror: boolean
): void {
  if (mirror) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();
    return;
  }

  ctx.drawImage(video, 0, 0, width, height);
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, display, onChange }) => (
  <label className="calibration-slider">
    <span className="calibration-slider-label">
      <span>{label}</span>
      <span className="calibration-slider-value">{display}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </label>
);

export const ColourTrackerSession: React.FC<ColourTrackerSessionProps> = ({ onBack }) => {
  const { showError, showSuccess, showInfo } = useStatus();
  const { playSound } = useFreesound();
  const {
    devices: cameraDevices,
    refreshDevices,
    getDefaultFrontCamera,
    getDefaultBackCamera,
    getNextCamera
  } = useCameraDevices();

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioEngineRef = useRef<QuadrantAudioEngine | null>(null);
  const colorProfileRef = useRef<ColorProfile>(loadSavedColorProfile());
  const showMaskRef = useRef(false);
  const mirrorRef = useRef(loadMirrorView());
  const mixZoneRef = useRef<MixZone>(loadMixZone());
  const gridLayoutRef = useRef<GridLayout>(loadGridLayout());
  const lastImageDataRef = useRef<ImageData | null>(null);

  const { user } = useAuth();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string | null>(null);
  const [objectDetected, setObjectDetected] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [matchedPixels, setMatchedPixels] = useState(0);
  const [weights, setWeights] = useState<Record<CellId, number>>(() =>
    emptyCellWeights(loadGridLayout())
  );
  const [gridLayout, setGridLayout] = useState<GridLayout>(loadGridLayout);
  const cellIds = getCellIds(gridLayout);
  const [colorProfile, setColorProfile] = useState<ColorProfile>(loadSavedColorProfile);
  const [activePreset, setActivePreset] = useState<string>('pink');
  const [showMask, setShowMask] = useState(false);
  const [mirrorView, setMirrorView] = useState(loadMirrorView);
  const [pickMode, setPickMode] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(true);
  const [blendZoneOpen, setBlendZoneOpen] = useState(true);
  const [pickerHex, setPickerHex] = useState(() => profileToHex(loadSavedColorProfile()));
  const [quadrantSounds, setQuadrantSounds] = useState<Record<CellId, QuadrantSoundConfig>>(() =>
    loadQuadrantSounds(loadGridLayout())
  );
  const [uploadingQuadrants, setUploadingQuadrants] = useState<Partial<Record<CellId, boolean>>>(
    {}
  );
  const [gridLayoutOpen, setGridLayoutOpen] = useState(true);
  const [isPlayMode, setIsPlayMode] = useState(false);
  const [mixZone, setMixZone] = useState<MixZone>(loadMixZone);

  const updateProfile = useCallback((next: ColorProfile, presetId = 'custom') => {
    colorProfileRef.current = next;
    setColorProfile(next);
    setActivePreset(presetId);
    setPickerHex(profileToHex(next));
    saveColorProfile(next);
  }, []);

  const handleQuadrantSoundChange = useCallback(
    (id: CellId, config: QuadrantSoundConfig) => {
      setQuadrantSounds((prev) => {
        const next = { ...prev, [id]: config };
        saveQuadrantSounds(next, gridLayoutRef.current);
        audioEngineRef.current?.setConfigs(next);
        return next;
      });
    },
    []
  );

  const handleGridLayoutChange = useCallback((patch: Partial<GridLayout>) => {
    const nextLayout = clampGridLayout({ ...gridLayoutRef.current, ...patch });
    gridLayoutRef.current = nextLayout;
    setGridLayout(nextLayout);
    saveGridLayout(nextLayout);

    setQuadrantSounds((prev) => {
      const next = remapConfigsForLayout(prev, nextLayout);
      saveQuadrantSounds(next, nextLayout);
      audioEngineRef.current?.setGridLayout(nextLayout);
      audioEngineRef.current?.setConfigs(next);
      return next;
    });

    setWeights(emptyCellWeights(nextLayout));
  }, []);

  const handleUpload = useCallback(
    async (id: CellId, file: File) => {
      const validationError = validateQuadrantAudioFile(file);
      if (validationError) {
        showError(validationError);
        return;
      }

      if (!user) {
        showError('Sign in to upload sounds to cloud storage.');
        return;
      }

      let previousPath: string | undefined;
      let keepRecordType = false;
      setQuadrantSounds((prev) => {
        previousPath = prev[id].uploadStoragePath;
        keepRecordType = prev[id].type === 'record';
        return prev;
      });

      const cellMeta = getCellMeta(id, gridLayoutRef.current);
      const isRecording = file.name.startsWith('recording-');
      const displayName = isRecording
        ? `Recording (${cellMeta.label})`
        : file.name;

      setUploadingQuadrants((prev) => ({ ...prev, [id]: true }));
      showInfo(isRecording ? `Saving recording for ${cellMeta.label}…` : `Uploading “${file.name}”…`);

      try {
        const { url, storagePath } = await uploadQuadrantSound(user.uid, id, file);

        if (previousPath && previousPath !== storagePath) {
          await deleteQuadrantSound(previousPath);
        }

        setQuadrantSounds((prev) => {
          const next = {
            ...prev,
            [id]: {
              ...prev[id],
              type: (keepRecordType ? 'record' : 'upload') as 'record' | 'upload',
              uploadName: displayName,
              uploadStoragePath: storagePath,
              uploadUrl: url
            }
          };
          saveQuadrantSounds(next, gridLayoutRef.current);
          audioEngineRef.current?.setConfigs(next);
          return next;
        });

        showSuccess(`“${displayName}” saved to cloud storage for ${cellMeta.label}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        showError(message);
      } finally {
        setUploadingQuadrants((prev) => ({ ...prev, [id]: false }));
      }
    },
    [showError, showInfo, showSuccess, user]
  );

  const handlePreviewSound = useCallback(
    async (id: CellId) => {
      const config = quadrantSounds[id];
      try {
        if (config.type === 'tone') {
          getConfigFrequencies(config).forEach((frequency) => playNote(frequency, 0.45));
          return;
        }
        if (config.type === 'freesound' && config.freesound) {
          await playSound({
            id: config.freesound.id,
            name: config.freesound.name,
            previews: config.freesound.previews,
            description: '',
            url: '',
            tags: [],
            duration: 0,
            filesize: 0,
            username: '',
            license: ''
          });
          return;
        }
        if (config.type === 'upload' || config.type === 'record') {
          const url = config.uploadUrl;
          if (!url) {
            showError(config.type === 'record' ? 'Record a sample first.' : 'Upload a sound file first.');
            return;
          }
          const audio = new Audio(url);
          await audio.play();
        }
      } catch {
        showError('Could not preview this sound.');
      }
    },
    [playSound, quadrantSounds, showError]
  );

  useEffect(() => {
    showMaskRef.current = showMask;
  }, [showMask]);

  useEffect(() => {
    mirrorRef.current = mirrorView;
    saveMirrorView(mirrorView);
  }, [mirrorView]);

  useEffect(() => {
    mixZoneRef.current = mixZone;
    saveMixZone(mixZone);
  }, [mixZone]);

  const updateMixZone = useCallback((zone: MixZone) => {
    mixZoneRef.current = zone;
    setMixZone(zone);
    saveMixZone(zone);
  }, []);

  useEffect(() => {
    gridLayoutRef.current = gridLayout;
  }, [gridLayout]);

  useEffect(() => {
    audioEngineRef.current?.setConfigs(quadrantSounds);
  }, [quadrantSounds]);

  useEffect(() => {
    if (isPlayMode) {
      setPickMode(false);
    }
  }, [isPlayMode]);

  const initAudio = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new QuadrantAudioEngine();
    }
    audioEngineRef.current.init(gridLayoutRef.current);
    audioEngineRef.current.setGridLayout(gridLayoutRef.current);
    audioEngineRef.current.setConfigs(quadrantSounds);
    audioEngineRef.current.resume();
  }, [quadrantSounds]);

  const stopAudio = useCallback(() => {
    audioEngineRef.current?.dispose();
    audioEngineRef.current = null;
  }, []);

  const drawMask = useCallback(
    (ctx: CanvasRenderingContext2D, imageData: ImageData, profile: ColorProfile) => {
      const { data, width, height } = imageData;
      ctx.fillStyle = 'rgba(0, 255, 120, 0.45)';

      for (let y = 0; y < height; y += SAMPLE_STEP) {
        for (let x = 0; x < width; x += SAMPLE_STEP) {
          const i = (y * width + x) * 4;
          if (matchesColorProfile(data[i], data[i + 1], data[i + 2], profile)) {
            ctx.fillRect(x, y, SAMPLE_STEP, SAMPLE_STEP);
          }
        }
      }
    },
    []
  );

  const drawOverlay = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      pos: { x: number; y: number } | null,
      quadrantWeights: Record<CellId, number>,
      layout: GridLayout,
      profile: ColorProfile
    ) => {
      const trackerColour = profileToHex(profile);
      const { rows, cols } = layout;
      const cellWidth = width / cols;
      const cellHeight = height / rows;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;

      for (let col = 1; col < cols; col++) {
        const x = col * cellWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let row = 1; row < rows; row++) {
        const y = row * cellHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      getCellIds(layout).forEach((id) => {
        const parsed = parseCellId(id);
        if (!parsed) return;

        const meta = getCellMeta(id, layout);
        const alpha = (quadrantWeights[id] ?? 0) * 0.35;
        ctx.fillStyle = meta.colour.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
        ctx.fillRect(parsed.col * cellWidth, parsed.row * cellHeight, cellWidth, cellHeight);

        const labelX = parsed.col * cellWidth + cellWidth / 2;
        const labelY = parsed.row * cellHeight + cellHeight * 0.2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(meta.label, labelX, labelY);
      });

      if (pos) {
        const px = pos.x * width;
        const py = pos.y * height;

        ctx.beginPath();
        ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.strokeStyle = trackerColour;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = trackerColour;
        ctx.fill();
      }
    },
    []
  );

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.readyState < 2) return;

    const { videoWidth, videoHeight } = video;
    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    const mirror = mirrorRef.current;
    drawVideoFrame(ctx, video, videoWidth, videoHeight, mirror);

    const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
    lastImageDataRef.current = imageData;

    const profile = colorProfileRef.current;
    const detected = detectColoredObject(imageData, profile, SAMPLE_STEP);

    let nextWeights = emptyCellWeights(gridLayoutRef.current);

    if (detected) {
      nextWeights = computeCellWeights(
        detected.x,
        detected.y,
        gridLayoutRef.current,
        mixZoneRef.current
      );
      setObjectDetected(true);
      setPosition({ x: detected.x, y: detected.y });
      setMatchedPixels(detected.matchedPixels);
      setWeights(nextWeights);
      audioEngineRef.current?.updateGains(nextWeights);
    } else {
      setObjectDetected(false);
      setPosition(null);
      setMatchedPixels(0);
      setWeights(nextWeights);
      audioEngineRef.current?.updateGains(nextWeights);
    }

    drawVideoFrame(ctx, video, videoWidth, videoHeight, mirror);

    if (showMaskRef.current) {
      drawMask(ctx, imageData, profile);
    }

    drawOverlay(
      ctx,
      videoWidth,
      videoHeight,
      detected ? { x: detected.x, y: detected.y } : null,
      nextWeights,
      gridLayoutRef.current,
      profile
    );
  }, [drawMask, drawOverlay]);

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!pickMode || !canvasRef.current || !lastImageDataRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      let x = Math.round((event.clientX - rect.left) * scaleX);
      const y = Math.round((event.clientY - rect.top) * scaleY);

      if (mirrorRef.current) {
        x = canvas.width - x;
      }

      const { r, g, b } = sampleAreaRgb(lastImageDataRef.current, x, y, 6);
      const next = profileFromSample(r, g, b);
      updateProfile(next, 'custom');
      setPickMode(false);
      showSuccess('Colour sampled from video — adjust sliders if needed.');
    },
    [pickMode, showSuccess, updateProfile]
  );

  const startProcessingLoop = useCallback(() => {
    const loop = () => {
      if (!streamRef.current) return;
      processFrame();
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
  }, [processFrame]);

  const stopCamera = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    stopAudio();
    setIsCameraActive(false);
    setObjectDetected(false);
    setPosition(null);
    setMatchedPixels(0);
    setPickMode(false);
    setWeights(emptyCellWeights(gridLayoutRef.current));
    lastImageDataRef.current = null;
  }, [stopAudio]);

  const startCamera = useCallback(
    async (selection?: { deviceId?: string }) => {
      try {
        resumeAudioContext();
        initAudio();

        let devicesToUse = cameraDevices;
        if (!devicesToUse.length) {
          devicesToUse = await refreshDevices();
        }

        let targetDeviceId: string | undefined | null = selection?.deviceId ?? activeDeviceId;
        if (!targetDeviceId) {
          const front = getDefaultFrontCamera(devicesToUse);
          targetDeviceId = front?.deviceId ?? null;
        }

        const constraints: MediaStreamConstraints = {
          video: targetDeviceId
            ? { width: 640, height: 480, deviceId: { exact: targetDeviceId } }
            : { width: 640, height: 480, facingMode: 'user' }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setIsCameraActive(true);

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }

        const devices = await refreshDevices();
        const active = devices.find((d) => d.deviceId === settings.deviceId);
        setActiveCameraLabel(active?.label ?? track.label ?? 'Camera');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            void videoRef.current?.play();
            startProcessingLoop();
          };
        }
      } catch (err) {
        console.error('Failed to access camera:', err);
        showError('Failed to access camera. Please grant camera permissions.');
      }
    },
    [
      activeDeviceId,
      cameraDevices,
      getDefaultFrontCamera,
      initAudio,
      refreshDevices,
      showError,
      startProcessingLoop
    ]
  );

  const toggleCamera = useCallback(async () => {
    let devicesList = cameraDevices;
    if (!devicesList.length) {
      devicesList = await refreshDevices();
    }

    if (!devicesList.length) return;

    const front = getDefaultFrontCamera(devicesList);
    const back = getDefaultBackCamera(devicesList);

    let targetDeviceId: string | null | undefined = null;
    if (front && back) {
      targetDeviceId = activeDeviceId === back.deviceId ? front.deviceId : back.deviceId;
    } else {
      targetDeviceId = getNextCamera(activeDeviceId, devicesList)?.deviceId;
    }

    if (!targetDeviceId) return;

    stopCamera();
    await startCamera({ deviceId: targetDeviceId });
  }, [
    activeDeviceId,
    cameraDevices,
    getDefaultBackCamera,
    getDefaultFrontCamera,
    getNextCamera,
    refreshDevices,
    startCamera,
    stopCamera
  ]);

  const applyPreset = (presetId: string) => {
    const preset = COLOR_PRESETS[presetId];
    if (!preset) return;
    const { label: _label, swatch: _swatch, ...profile } = preset;
    updateProfile(profile, presetId);
  };

  const patchProfile = (patch: Partial<ColorProfile>) => {
    updateProfile({ ...colorProfileRef.current, ...patch }, 'custom');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className={`colour-tracker-session ${isPlayMode ? 'play-mode' : 'teacher-mode'}`}>
      <div className="session-header">
        {!isPlayMode && (
          <button className="btn-back" onClick={onBack} type="button">
            ← Back to Sessions
          </button>
        )}
        <h2>🌈 Colour Tracker Session</h2>
        {!isPlayMode && (
          <p>
            Calibrate which colour to track, set your sound grid (rows and columns), then move the
            object to hear each cell fade in and out.
          </p>
        )}
        <div className="student-ui-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isPlayMode}
              onChange={(e) => setIsPlayMode(e.target.checked)}
            />
            <span className="toggle-slider" />
            <span className="toggle-label">Play mode</span>
          </label>
        </div>
      </div>

      <div className="colour-tracker-layout">
        <div className="camera-section">
          <div
            ref={videoContainerRef}
            className={`video-container colour-tracker-video ${pickMode ? 'pick-mode' : ''} ${
              isCameraActive && !pickMode && !isPlayMode ? 'has-blend-zone-overlay' : ''
            }`}
          >
            <video ref={videoRef} className="gesture-video" playsInline muted />
            <canvas
              ref={canvasRef}
              className={`gesture-canvas ${pickMode ? 'pick-mode' : ''}`}
              onClick={handleCanvasClick}
            />
            {isCameraActive && !pickMode && !isPlayMode && (
              <MixZoneOverlay
                mixZone={mixZone}
                editable
                containerRef={videoContainerRef}
                onChange={updateMixZone}
              />
            )}
            {isPlayMode && isCameraActive && (
              <div
                className="play-mode-meters"
                style={{ gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)` }}
              >
                {cellIds.map((id) => {
                  const meta = getCellMeta(id, gridLayout);
                  return (
                    <div key={id} className="play-mode-meter" style={{ borderColor: meta.colour }}>
                      <span>{meta.label}</span>
                      <div className="play-mode-meter-bar">
                        <div
                          style={{
                            width: `${Math.min(100, (weights[id] ?? 0) * 400)}%`,
                            background: meta.colour
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {pickMode && isCameraActive && (
              <div className="pick-mode-hint">Tap the object colour on the video</div>
            )}
            {!isCameraActive && (
              <div className="camera-placeholder">
                <p>📷 Camera off</p>
                <p>{isPlayMode ? 'Start the camera to play' : 'Start the camera, then calibrate the colour to track'}</p>
              </div>
            )}
          </div>

          <div className="camera-buttons">
            {!isCameraActive ? (
              <button className="btn-start-camera" type="button" onClick={() => void startCamera()}>
                Start camera
              </button>
            ) : (
              <>
                <button className="btn-stop-camera" type="button" onClick={stopCamera}>
                  Stop camera
                </button>
                {cameraDevices.length > 1 && (
                  <button
                    className="btn-start-camera"
                    type="button"
                    style={{ marginLeft: '10px' }}
                    onClick={() => void toggleCamera()}
                  >
                    Switch camera
                  </button>
                )}
              </>
            )}
          </div>

          {!isPlayMode && (
            <div className="camera-options">
              <label className="calibration-toggle camera-mirror-toggle">
                <input
                  type="checkbox"
                  checked={mirrorView}
                  onChange={(e) => setMirrorView(e.target.checked)}
                />
                Mirror view (recommended for front-facing camera)
              </label>
            </div>
          )}

          {activeCameraLabel && isCameraActive && (
            <p className="active-camera-label">Using: {activeCameraLabel}</p>
          )}
        </div>

        {!isPlayMode && (
        <div className="colour-tracker-sidebar">
          <section className="calibration-panel">
            <button
              type="button"
              className="calibration-panel-toggle"
              onClick={() => setGridLayoutOpen((open) => !open)}
              aria-expanded={gridLayoutOpen}
            >
              <span>⊞ Sound grid layout</span>
              <span>
                {gridLayoutOpen
                  ? `${gridLayout.rows}×${gridLayout.cols}`
                  : '▸'}
              </span>
            </button>
            {gridLayoutOpen && (
              <div className="calibration-panel-body sound-grid-layout-panel">
                <p className="calibration-intro">
                  Set how many rows and columns of sounds to use — for example 1 row with 5 columns,
                  or 5 rows with 1 column. Each cell gets its own sound.
                </p>
                <div className="sound-grid-layout-controls">
                  <label className="quadrant-sound-field">
                    Rows
                    <input
                      type="number"
                      min={MIN_GRID_DIMENSION}
                      max={MAX_GRID_DIMENSION}
                      value={gridLayout.rows}
                      onChange={(e) =>
                        handleGridLayoutChange({ rows: parseInt(e.target.value, 10) })
                      }
                    />
                  </label>
                  <label className="quadrant-sound-field">
                    Columns
                    <input
                      type="number"
                      min={MIN_GRID_DIMENSION}
                      max={MAX_GRID_DIMENSION}
                      value={gridLayout.cols}
                      onChange={(e) =>
                        handleGridLayoutChange({ cols: parseInt(e.target.value, 10) })
                      }
                    />
                  </label>
                </div>
                <div className="calibration-actions">
                  <button
                    type="button"
                    className="btn-calibration secondary"
                    onClick={() => handleGridLayoutChange({ rows: 2, cols: 2 })}
                  >
                    2×2 grid
                  </button>
                  <button
                    type="button"
                    className="btn-calibration secondary"
                    onClick={() => handleGridLayoutChange({ rows: 1, cols: 5 })}
                  >
                    1×5 strip
                  </button>
                  <button
                    type="button"
                    className="btn-calibration secondary"
                    onClick={() => handleGridLayoutChange({ rows: 5, cols: 1 })}
                  >
                    5×1 strip
                  </button>
                </div>
              </div>
            )}
          </section>

          <QuadrantSoundPanel
            gridLayout={gridLayout}
            cellIds={cellIds}
            configs={quadrantSounds}
            uploadingQuadrants={uploadingQuadrants}
            isSignedIn={Boolean(user)}
            onChange={handleQuadrantSoundChange}
            onUpload={(id, file) => void handleUpload(id, file)}
            onPreview={handlePreviewSound}
          />

          <section className="calibration-panel">
            <button
              type="button"
              className="calibration-panel-toggle blend-zone-toggle"
              onClick={() => setBlendZoneOpen((open) => !open)}
              aria-expanded={blendZoneOpen}
            >
              <span>📐 Sound bleed / blend zone</span>
              <span>{blendZoneOpen ? mixZoneBleedLabel(mixZone) : '▸'}</span>
            </button>
            {blendZoneOpen && (
            <div className="calibration-panel-body blend-zone-panel">
              <p className="calibration-intro">
                Drag the rectangle on the video to control how much sounds bleed between cells.
                Inside the blend zone sounds mix smoothly; outside it, each cell stays sharper.
              </p>
              <div className="calibration-actions">
                <button
                  type="button"
                  className="btn-calibration secondary"
                  onClick={() => updateMixZone({ ...DEFAULT_MIX_ZONE })}
                >
                  Full bleed
                </button>
                <button
                  type="button"
                  className="btn-calibration secondary"
                  onClick={() => updateMixZone({ ...CENTERED_MIX_ZONE })}
                >
                  Centre blend
                </button>
              </div>
            </div>
            )}
          </section>

          <section className="calibration-panel">
            <button
              type="button"
              className="calibration-panel-toggle"
              onClick={() => setCalibrationOpen((open) => !open)}
              aria-expanded={calibrationOpen}
            >
              <span>🎨 Colour calibration</span>
              <span>{calibrationOpen ? '▾' : '▸'}</span>
            </button>

            {calibrationOpen && (
              <div className="calibration-panel-body">
                <p className="calibration-intro">
                  Choose a preset or sample the object colour from the video, then fine-tune with
                  the sliders. Settings are saved automatically.
                </p>

                <div className="colour-target-row">
                  <span
                    className="colour-target-swatch"
                    style={{ background: pickerHex }}
                    title="Target colour"
                  />
                  <label className="colour-picker-label">
                    Target colour
                    <input
                      type="color"
                      value={pickerHex}
                      onChange={(e) => updateProfile(profileFromHex(e.target.value), 'custom')}
                    />
                  </label>
                </div>

                <div className="preset-colour-grid">
                  {Object.entries(COLOR_PRESETS).map(([id, preset]) => (
                    <button
                      key={id}
                      type="button"
                      className={`preset-colour-btn ${activePreset === id ? 'active' : ''}`}
                      onClick={() => applyPreset(id)}
                      title={preset.label}
                    >
                      <span className="preset-colour-swatch" style={{ background: preset.swatch }} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="calibration-actions">
                  <button
                    type="button"
                    className={`btn-calibration ${pickMode ? 'active' : ''}`}
                    disabled={!isCameraActive}
                    onClick={() => setPickMode((on) => !on)}
                  >
                    {pickMode ? 'Cancel pick' : 'Pick from video'}
                  </button>
                  <button
                    type="button"
                    className="btn-calibration secondary"
                    onClick={() => updateProfile({ ...DEFAULT_COLOR_PROFILE }, 'pink')}
                  >
                    Reset
                  </button>
                </div>

                <label className="calibration-toggle">
                  <input
                    type="checkbox"
                    checked={showMask}
                    onChange={(e) => setShowMask(e.target.checked)}
                  />
                  Show detection mask (green overlay on matched pixels)
                </label>

                <div className="calibration-sliders">
                  <SliderRow
                    label="Hue centre"
                    value={colorProfile.hueCenter}
                    min={0}
                    max={360}
                    step={1}
                    display={`${Math.round(colorProfile.hueCenter)}°`}
                    onChange={(hueCenter) => patchProfile({ hueCenter })}
                  />
                  <SliderRow
                    label="Hue tolerance"
                    value={colorProfile.hueTolerance}
                    min={5}
                    max={90}
                    step={1}
                    display={`±${Math.round(colorProfile.hueTolerance)}°`}
                    onChange={(hueTolerance) => patchProfile({ hueTolerance })}
                  />
                  <SliderRow
                    label="Saturation min"
                    value={colorProfile.satMin}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(colorProfile.satMin * 100)}%`}
                    onChange={(satMin) => patchProfile({ satMin: Math.min(satMin, colorProfile.satMax) })}
                  />
                  <SliderRow
                    label="Saturation max"
                    value={colorProfile.satMax}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(colorProfile.satMax * 100)}%`}
                    onChange={(satMax) => patchProfile({ satMax: Math.max(satMax, colorProfile.satMin) })}
                  />
                  <SliderRow
                    label="Brightness min"
                    value={colorProfile.valMin}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(colorProfile.valMin * 100)}%`}
                    onChange={(valMin) => patchProfile({ valMin: Math.min(valMin, colorProfile.valMax) })}
                  />
                  <SliderRow
                    label="Brightness max"
                    value={colorProfile.valMax}
                    min={0}
                    max={1}
                    step={0.01}
                    display={`${Math.round(colorProfile.valMax * 100)}%`}
                    onChange={(valMax) => patchProfile({ valMax: Math.max(valMax, colorProfile.valMin) })}
                  />
                  <SliderRow
                    label="Minimum pixels"
                    value={colorProfile.minPixels}
                    min={1}
                    max={120}
                    step={1}
                    display={`${Math.round(colorProfile.minPixels)}`}
                    onChange={(minPixels) => patchProfile({ minPixels })}
                  />
                </div>
              </div>
            )}
          </section>

          <div className="colour-tracker-info">
            <div className={`colour-tracker-status ${objectDetected ? 'detected' : ''}`}>
              <span className="status-dot" />
              {objectDetected ? 'Object detected' : 'No object detected'}
            </div>

            {objectDetected && position && (
              <p className="colour-tracker-position">
                Position: {(position.x * 100).toFixed(0)}% across, {(position.y * 100).toFixed(0)}% down
                <br />
                Matched pixels: {matchedPixels}
              </p>
            )}

            <div
              className="quadrant-sound-grid"
              style={{ gridTemplateColumns: `repeat(${Math.min(gridLayout.cols, 3)}, 1fr)` }}
            >
              {cellIds.map((id) => {
                const meta = getCellMeta(id, gridLayout);
                const weight = weights[id] ?? 0;
                return (
                  <div
                    key={id}
                    className="quadrant-sound-card"
                    style={{
                      borderColor: meta.colour,
                      opacity: 0.45 + weight * 0.55
                    }}
                  >
                    <span className="quadrant-sound-label">{meta.label}</span>
                    <span className="quadrant-sound-note">{getSoundLabel(quadrantSounds[id])}</span>
                    <div className="quadrant-sound-meter">
                      <div
                        className="quadrant-sound-meter-fill"
                        style={{
                          width: `${Math.min(100, weight * 400)}%`,
                          background: meta.colour
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="colour-tracker-tip">
              Tip: uploaded sounds are saved to your Firebase storage account and persist between
              sessions. Sign in is required to upload.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

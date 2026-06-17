import React, { useState, useCallback, useEffect } from 'react';
import { useWebMidi, isNetworkMidiDevice, slotMatchesMidiEvent, formatMidiChannel, type MidiNoteEvent } from '../hooks/useWebMidi';
import { useStatus } from '../hooks/useStatus';
import { getPatternImageSources, getImageSource, clearPatternImageCache, type ImageSource } from '../utils/images';
import { ControllerSlotImage } from './ControllerSlotImage';
import {
  DEFAULT_SLOT_ANIMATION,
  SLOT_ANIMATIONS,
  type SlotAnimation
} from '../data/controllerAnimations';

import {
  loadSavedControllerSessions,
  persistControllerSessions,
  type SavedControllerSession
} from '../utils/controllerSessionStorage';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteControllerSlotImage,
  uploadControllerSlotImage
} from '../utils/controllerImageStorage';

interface ControllerImageSessionProps {
  onBack: () => void;
}

type ImageSlot = {
  id: string;
  label: string;
  searchTerm: string;
  deviceId: string;
  deviceName?: string;
  midiChannel: number | null;
  uploadedImageUrl?: string;
  uploadedImageStoragePath?: string;
  image?: ImageSource;
  animation: SlotAnimation;
  revealed: boolean;
  triggerCount: number;
};

const IMAGE_SIZE = 240;

const DEFAULT_SLOTS: Omit<ImageSlot, 'revealed' | 'triggerCount' | 'image' | 'deviceId' | 'deviceName' | 'midiChannel' | 'animation'>[] = [
  { id: 'slot-1', label: 'Controller 1', searchTerm: 'dog' },
  { id: 'slot-2', label: 'Controller 2', searchTerm: 'cat' },
  { id: 'slot-3', label: 'Controller 3', searchTerm: 'star' },
  { id: 'slot-4', label: 'Controller 4', searchTerm: 'rainbow' },
  { id: 'slot-5', label: 'Controller 5', searchTerm: 'drum' },
  { id: 'slot-6', label: 'Controller 6', searchTerm: 'balloon' }
];

const createInitialSlots = (): ImageSlot[] =>
  DEFAULT_SLOTS.map((slot) => ({
    ...slot,
    deviceId: '',
    midiChannel: null,
    animation: DEFAULT_SLOT_ANIMATION,
    revealed: false,
    triggerCount: 0
  }));

const slotImageUrl = (slot: ImageSlot): string =>
  slot.uploadedImageUrl || slot.image?.url || '';

const slotFallback = (slot: ImageSlot): string => slot.image?.fallback || '🖼️';

const slotAssignmentMatches = (
  slot: ImageSlot,
  deviceId: string,
  midiChannel: number | null,
  deviceName?: string
): boolean => {
  if (slot.deviceId !== deviceId) return false;
  if (isNetworkMidiDevice(deviceName)) return slot.midiChannel === midiChannel;
  return true;
};

const isSlotConfigured = (slot: ImageSlot): boolean => {
  if (!slot.deviceId) return false;
  if (isNetworkMidiDevice(slot.deviceName)) return slot.midiChannel !== null;
  return true;
};

const toSavedSlots = (slots: ImageSlot[]) =>
  slots.map(
    ({
      id,
      label,
      searchTerm,
      deviceId,
      deviceName,
      midiChannel,
      uploadedImageUrl,
      uploadedImageStoragePath,
      animation,
      image
    }) => ({
      id,
      label,
      searchTerm,
      deviceId,
      deviceName,
      midiChannel,
      uploadedImageUrl,
      uploadedImageStoragePath,
      animation,
      image: uploadedImageUrl ? undefined : image
    })
  );

const toPlaySlots = (saved: SavedControllerSession['slots']): ImageSlot[] =>
  saved.map((slot) => ({
    ...slot,
    revealed: false,
    triggerCount: 0
  }));

export const ControllerImageSession: React.FC<ControllerImageSessionProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useStatus();
  const [slots, setSlots] = useState<ImageSlot[]>(createInitialSlots);
  const [isPlayMode, setIsPlayMode] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [activeSlots, setActiveSlots] = useState<Record<string, boolean>>({});
  const [savedSessions, setSavedSessions] = useState<SavedControllerSession[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [reloadingSlots, setReloadingSlots] = useState<Record<string, boolean>>({});
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSavedSessions(loadSavedControllerSessions());
  }, []);

  const setSlotActive = useCallback((slotId: string, active: boolean) => {
    setActiveSlots((prev) => {
      if (active) return { ...prev, [slotId]: true };
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }, []);

  const handleNoteOn = useCallback((event: MidiNoteEvent) => {
    setSlots((prev) => {
      const slotIndex = prev.findIndex((slot) =>
        slotMatchesMidiEvent(slot.deviceId, slot.midiChannel, slot.deviceName, event)
      );
      if (slotIndex === -1) return prev;

      const targetId = prev[slotIndex].id;
      setSlotActive(targetId, true);

      return prev.map((slot, index) => {
        if (index !== slotIndex) return slot;
        return {
          ...slot,
          revealed: true,
          triggerCount: slot.triggerCount + 1
        };
      });
    });
  }, [setSlotActive]);

  const handleNoteOff = useCallback((event: MidiNoteEvent) => {
    setSlots((prev) => {
      const slotIndex = prev.findIndex((slot) =>
        slotMatchesMidiEvent(slot.deviceId, slot.midiChannel, slot.deviceName, event)
      );
      if (slotIndex === -1) return prev;

      setSlotActive(prev[slotIndex].id, false);
      return prev;
    });
  }, [setSlotActive]);

  const { isEnabled, lastEvent, connectedInputs, simulateDevice } = useWebMidi({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff
  });

  const applyImageSources = useCallback(
    (sources: Record<string, ImageSource>) => {
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.uploadedImageUrl) return slot;
          return {
            ...slot,
            image: sources[slot.searchTerm.trim()] || slot.image
          };
        })
      );
    },
    []
  );

  const loadImages = useCallback(async () => {
    setIsLoadingImages(true);
    try {
      let terms: string[] = [];
      setSlots((prev) => {
        terms = prev.map((slot) => slot.searchTerm);
        return prev;
      });
      const sources = await getPatternImageSources(terms, IMAGE_SIZE, IMAGE_SIZE);
      applyImageSources(sources);
      showSuccess('Images loaded — play a controller to reveal its image');
    } catch {
      showError('Failed to load images');
    } finally {
      setIsLoadingImages(false);
    }
  }, [applyImageSources, showSuccess, showError]);

  useEffect(() => {
    const terms = DEFAULT_SLOTS.map((slot) => slot.searchTerm);
    setIsLoadingImages(true);
    getPatternImageSources(terms, IMAGE_SIZE, IMAGE_SIZE)
      .then(applyImageSources)
      .finally(() => setIsLoadingImages(false));
  }, [applyImageSources]);

  const handleSearchTermChange = (id: string, searchTerm: string) => {
    const slot = slots.find((s) => s.id === id);
    if (slot?.uploadedImageStoragePath) {
      void deleteControllerSlotImage(slot.uploadedImageStoragePath);
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              searchTerm,
              uploadedImageUrl: undefined,
              uploadedImageStoragePath: undefined,
              image: undefined
            }
          : s
      )
    );
  };

  const handleDeviceChange = (id: string, deviceId: string) => {
    const device = connectedInputs.find((d) => d.id === deviceId);
    const deviceName = device?.name;
    const network = isNetworkMidiDevice(deviceName);

    setSlots((prev) => {
      const target = prev.find((slot) => slot.id === id);
      const newChannel = network ? (target?.midiChannel ?? 0) : null;

      return prev.map((slot) => {
        if (slot.id === id) {
          if (!deviceId) {
            return { ...slot, deviceId: '', deviceName: undefined, midiChannel: null };
          }
          return {
            ...slot,
            deviceId,
            deviceName,
            midiChannel: network ? slot.midiChannel ?? 0 : null
          };
        }

        if (deviceId && slotAssignmentMatches(slot, deviceId, newChannel, deviceName)) {
          return { ...slot, deviceId: '', deviceName: undefined, midiChannel: null };
        }

        return slot;
      });
    });
  };

  const handleChannelChange = (id: string, midiChannel: number) => {
    if (midiChannel < 0 || midiChannel > 15) return;
    setSlots((prev) => {
      const target = prev.find((slot) => slot.id === id);
      if (!target?.deviceId) return prev;

      return prev.map((slot) => {
        if (slot.id === id) {
          return { ...slot, midiChannel };
        }
        if (
          slot.deviceId === target.deviceId &&
          slot.midiChannel === midiChannel &&
          isNetworkMidiDevice(target.deviceName)
        ) {
          return { ...slot, deviceId: '', deviceName: undefined, midiChannel: null };
        }
        return slot;
      });
    });
  };

  const handleReloadSlotImage = async (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot || slot.uploadedImageUrl) return;

    const term = slot.searchTerm.trim();
    if (!term) {
      showError('Enter an image search term first');
      return;
    }

    setReloadingSlots((prev) => ({ ...prev, [id]: true }));
    try {
      clearPatternImageCache([term]);
      const image = await getImageSource(term, IMAGE_SIZE, IMAGE_SIZE, { bypassCache: true });
      setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, image } : s)));
      showSuccess(`Reloaded image for "${term}"`);
    } catch {
      showError('Failed to reload image');
    } finally {
      setReloadingSlots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleFileUpload = async (id: string, file: File | undefined) => {
    if (!file) return;
    if (!user) {
      showError('Sign in to upload images to cloud storage');
      return;
    }

    const existingSlot = slots.find((slot) => slot.id === id);
    const previousPath = existingSlot?.uploadedImageStoragePath;

    setUploadingSlots((prev) => ({ ...prev, [id]: true }));
    try {
      const { url, storagePath } = await uploadControllerSlotImage(user.uid, id, file);

      if (previousPath && previousPath !== storagePath) {
        await deleteControllerSlotImage(previousPath);
      }

      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === id
            ? {
                ...slot,
                uploadedImageUrl: url,
                uploadedImageStoragePath: storagePath,
                image: undefined
              }
            : slot
        )
      );
      showSuccess('Image saved to cloud storage');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image';
      showError(message);
    } finally {
      setUploadingSlots((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleClearUpload = async (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (slot?.uploadedImageStoragePath) {
      await deleteControllerSlotImage(slot.uploadedImageStoragePath);
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, uploadedImageUrl: undefined, uploadedImageStoragePath: undefined, image: undefined }
          : s
      )
    );
    loadImages();
  };

  const handleAnimationChange = (id: string, animation: SlotAnimation) => {
    setSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, animation } : slot))
    );
  };

  const handleReset = () => {
    setSlots(createInitialSlots());
    setActiveSlots({});
    loadImages();
    showSuccess('Session reset — images hidden until played again');
  };

  const handleSaveSession = () => {
    const trimmedName = sessionName.trim() || 'Unnamed session';
    const newSession: SavedControllerSession = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      createdAt: new Date().toISOString(),
      slots: toSavedSlots(slots)
    };

    try {
      const updated = [...savedSessions, newSession];
      persistControllerSessions(updated);
      setSavedSessions(updated);
      setSessionName('');
      showSuccess(`Saved session "${trimmedName}"`);
    } catch {
      showError('Failed to save session');
    }
  };

  const handleLoadSession = async (session: SavedControllerSession) => {
    const loadedSlots = toPlaySlots(session.slots);
    setSlots(loadedSlots);
    setActiveSlots({});

    const terms = loadedSlots
      .filter((slot) => !slot.uploadedImageUrl)
      .map((slot) => slot.searchTerm.trim())
      .filter(Boolean);

    if (terms.length > 0) {
      setIsLoadingImages(true);
      try {
        const sources = await getPatternImageSources(terms, IMAGE_SIZE, IMAGE_SIZE, {
          bypassCache: true
        });
        setSlots((prev) =>
          prev.map((slot) => {
            if (slot.uploadedImageUrl) return slot;
            return {
              ...slot,
              image: sources[slot.searchTerm.trim()] || slot.image
            };
          })
        );
      } finally {
        setIsLoadingImages(false);
      }
    }

    showSuccess(`Loaded session "${session.name}"`);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = savedSessions.filter((session) => session.id !== sessionId);
    persistControllerSessions(updated);
    setSavedSessions(updated);
    showSuccess('Saved session deleted');
  };

  const handleTestSlot = (slot: ImageSlot) => {
    if (!isSlotConfigured(slot)) return;
    simulateDevice(slot.deviceId, slot.deviceName, slot.midiChannel ?? 0);
  };

  const assignedSlots = slots.filter(isSlotConfigured);
  const playSlots = assignedSlots.length > 0 ? assignedSlots : slots;

  const formatLastEvent = () => {
    if (!lastEvent) return '';
    const parts = [lastEvent.deviceName ?? 'Unknown device'];
    if (isNetworkMidiDevice(lastEvent.deviceName)) {
      parts.push(formatMidiChannel(lastEvent.channel));
    }
    return parts.join(' · ');
  };

  return (
    <div className={`controller-image-session ${isPlayMode ? 'play-mode' : ''}`}>
      <div className="session-header">
        {!isPlayMode && (
          <button className="btn-back" onClick={onBack} type="button">
            ← Back to Sessions
          </button>
        )}
        <h2>🎛️ Controller Image Play</h2>
        {!isPlayMode && (
          <p>
            Assign each CMPSR or Odd Ball to an image slot and pick its animation. The image
            animates while you hold a note and stops when you release.
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

      {isPlayMode ? (
        <div className="controller-play-stage">
          <button
            className="btn-back play-mode-back"
            onClick={() => setIsPlayMode(false)}
            type="button"
          >
            ← Setup
          </button>
          <div className="midi-image-grid">
            {playSlots.map((slot) => (
              <div
                key={slot.id}
                className={['midi-image-slot', slot.revealed ? 'revealed' : 'hidden'].join(' ')}
              >
                {slot.revealed ? (
                  <ControllerSlotImage
                    url={slotImageUrl(slot)}
                    alt={slot.image?.alt || slot.label}
                    fallback={slotFallback(slot)}
                    imageClassName="midi-slot-image"
                    repeatAnimation={slot.animation}
                    isAnimating={Boolean(activeSlots[slot.id])}
                    isFirstReveal={slot.triggerCount === 1}
                  />
                ) : (
                  <span className="midi-slot-placeholder">?</span>
                )}
              </div>
            ))}
          </div>
          {lastEvent && <p className="play-mode-hint">Last played: {formatLastEvent()}</p>}
        </div>
      ) : (
        <>
          <div className="midi-section">
            <h3>🎹 MIDI Status</h3>
            <div className="midi-status">
              <span className={`midi-indicator ${isEnabled ? 'connected' : 'disconnected'}`}>
                {isEnabled ? '🟢 MIDI ready' : '🔴 MIDI not available'}
              </span>
              {lastEvent && (
                <span className="midi-note">Last played: {formatLastEvent()}</span>
              )}
            </div>
            {connectedInputs.length > 0 ? (
              <ul className="midi-device-list">
                {connectedInputs.map((device) => (
                  <li key={device.id}>
                    <span className="midi-device-name">{device.name}</span>
                    {isNetworkMidiDevice(device.name) && (
                      <span className="midi-device-hint"> — assign a channel per slot</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="midi-instructions">
                No MIDI inputs detected. Route each controller through MIDI Studio as a separate
                input so the browser can tell them apart.
              </p>
            )}
            <p className="midi-instructions">
              For direct USB or Bluetooth controllers, pick the device name. For a Network session,
              pick Network and choose the MIDI channel each controller is using (1–16).
            </p>
          </div>

          <div className="controller-slot-setup">
            <div className="controller-setup-header">
              <h3>🖼️ Controller images</h3>
              <div className="controller-setup-actions">
                <button
                  type="button"
                  className="btn-search"
                  onClick={loadImages}
                  disabled={isLoadingImages}
                >
                  {isLoadingImages ? 'Loading…' : '🔄 Reload images'}
                </button>
                <button type="button" className="btn-dismiss" onClick={handleReset}>
                  Reset session
                </button>
              </div>
            </div>

            <div className="controller-slot-list">
              {slots.map((slot) => (
                <div key={slot.id} className="controller-slot-row">
                  <div className="controller-slot-preview">
                    <ControllerSlotImage
                      url={slotImageUrl(slot)}
                      alt={slot.label}
                      fallback={slotFallback(slot)}
                    />
                  </div>
                  <div className="controller-slot-fields">
                    <label>
                      Slot
                      <span className="slot-label">{slot.label}</span>
                    </label>
                    <label className="controller-midi-field">
                      <span className="controller-field-label">MIDI controller</span>
                      <div className="controller-midi-inline">
                        <select
                          className="controller-device-select"
                          value={slot.deviceId}
                          onChange={(e) => handleDeviceChange(slot.id, e.target.value)}
                        >
                          <option value="">— Select device —</option>
                          {connectedInputs.map((device) => (
                            <option key={device.id} value={device.id}>
                              {device.name}
                            </option>
                          ))}
                        </select>
                        {isNetworkMidiDevice(slot.deviceName) && (
                          <div className="midi-channel-stepper" title="MIDI channel">
                            <span className="midi-channel-label">Ch</span>
                            <button
                              type="button"
                              className="midi-channel-chevron"
                              aria-label="Previous channel"
                              disabled={(slot.midiChannel ?? 0) <= 0}
                              onClick={() =>
                                handleChannelChange(slot.id, (slot.midiChannel ?? 0) - 1)
                              }
                            >
                              ▲
                            </button>
                            <span className="midi-channel-value">
                              {(slot.midiChannel ?? 0) + 1}
                            </span>
                            <button
                              type="button"
                              className="midi-channel-chevron"
                              aria-label="Next channel"
                              disabled={(slot.midiChannel ?? 0) >= 15}
                              onClick={() =>
                                handleChannelChange(slot.id, (slot.midiChannel ?? 0) + 1)
                              }
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </div>
                    </label>
                    <label>
                      Repeat animation
                      <select
                        value={slot.animation}
                        onChange={(e) =>
                          handleAnimationChange(slot.id, e.target.value as SlotAnimation)
                        }
                      >
                        {SLOT_ANIMATIONS.map((anim) => (
                          <option key={anim.id} value={anim.id}>
                            {anim.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Image search
                      <div className="controller-image-search-inline">
                        <input
                          type="text"
                          value={slot.searchTerm}
                          onChange={(e) => handleSearchTermChange(slot.id, e.target.value)}
                          placeholder="e.g. dog, star"
                          disabled={Boolean(slot.uploadedImageUrl)}
                        />
                        <button
                          type="button"
                          className="btn-reload-slot-image"
                          title="Reload this image from Unsplash"
                          disabled={Boolean(slot.uploadedImageUrl) || reloadingSlots[slot.id]}
                          onClick={() => void handleReloadSlotImage(slot.id)}
                        >
                          {reloadingSlots[slot.id] ? '…' : '🔄'}
                        </button>
                      </div>
                    </label>
                    <label>
                      Upload image
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingSlots[slot.id]}
                        onChange={(e) => {
                          void handleFileUpload(slot.id, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      {uploadingSlots[slot.id] && (
                        <span className="upload-status">Uploading…</span>
                      )}
                      {slot.uploadedImageUrl && !uploadingSlots[slot.id] && (
                        <button
                          type="button"
                          className="btn-clear-upload"
                          onClick={() => void handleClearUpload(slot.id)}
                        >
                          Remove upload
                        </button>
                      )}
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn-test-midi"
                    disabled={!isSlotConfigured(slot)}
                    onClick={() => handleTestSlot(slot)}
                  >
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="preset-section controller-sessions-section">
            <h3>💾 Saved sessions</h3>
            <div className="preset-save-row">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Name this setup (e.g. Year 5 CMPSR)"
                className="preset-name-input"
              />
              <button type="button" className="btn-save-preset" onClick={handleSaveSession}>
                Save session
              </button>
            </div>
            {savedSessions.length > 0 ? (
              <div className="preset-list">
                {savedSessions.map((session) => (
                  <div key={session.id} className="preset-item">
                    <div className="preset-info">
                      <strong>{session.name}</strong>
                      <span className="preset-meta">
                        {session.slots.length} slots
                        {session.slots.filter((s) => s.deviceId).length > 0
                          ? ` · ${session.slots.filter((s) => s.deviceId).length} controllers assigned`
                          : ''}
                      </span>
                    </div>
                    <div className="preset-actions">
                      <button
                        type="button"
                        className="btn-load-preset"
                        onClick={() => handleLoadSession(session)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn-delete-preset"
                        onClick={() => handleDeleteSession(session.id)}
                        title="Delete this saved session"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="midi-instructions">
                Save your controller assignments, images, and animations to recall them later.
                Uploaded images are stored in Firebase Storage and linked in the saved session.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

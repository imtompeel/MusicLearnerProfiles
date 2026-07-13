import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useAuth } from '../contexts/AuthContext';
import { useBlinkPause } from '../hooks/useBlinkPause';
import {
  loadAutoScrollDraft,
  persistAutoScrollDraft,
  type SavedAutoScrollText,
} from '../utils/autoScrollStorage';
import {
  createAutoScrollText,
  deleteAutoScrollText,
  listAutoScrollTexts,
  migrateLocalAutoScrollTexts,
  updateAutoScrollText,
} from '../utils/firestoreAutoScroll';

interface AutoScrollSessionProps {
  onBack: () => void;
}

const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 120;
const DEFAULT_FONT_SIZE = 48;
const MIN_SPEED = 10;
const MAX_SPEED = 300;
const DEFAULT_SPEED = 60;

export const AutoScrollSession: React.FC<AutoScrollSessionProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useStatus();
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [saveName, setSaveName] = useState('');
  const [loadedTextId, setLoadedTextId] = useState<string | null>(null);
  const [savedTexts, setSavedTexts] = useState<SavedAutoScrollText[]>([]);
  const [loadingSavedTexts, setLoadingSavedTexts] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);
  const [blinkPauseEnabled, setBlinkPauseEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrollMode, setIsScrollMode] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isScrollModeRef = useRef(false);
  const speedRef = useRef(speed);
  const [showLogs, setShowLogs] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const entry = `${new Date().toLocaleTimeString()} ${message}`;
    setDebugLogs((prev) => [entry, ...prev].slice(0, 80));
  }, []);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isScrollModeRef.current = isScrollMode;
  }, [isScrollMode]);

  useEffect(() => {
    const draft = loadAutoScrollDraft();
    if (draft) {
      setText(draft.text);
      setFontSize(draft.fontSize);
      setSpeed(draft.speed);
      setBlinkPauseEnabled(Boolean(draft.blinkPauseEnabled ?? draft.eyeGazeEnabled));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedTexts([]);
      return;
    }

    let cancelled = false;

    const loadSavedTexts = async () => {
      setLoadingSavedTexts(true);
      try {
        let texts = await listAutoScrollTexts(user.uid);
        if (!cancelled && texts.length === 0) {
          const migratedCount = await migrateLocalAutoScrollTexts(user.uid);
          if (migratedCount > 0) {
            texts = await listAutoScrollTexts(user.uid);
            showSuccess(`Moved ${migratedCount} saved text(s) from this device to your account.`);
          }
        }
        if (!cancelled) {
          setSavedTexts(texts);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          showError('Could not load saved texts from Firebase.');
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedTexts(false);
        }
      }
    };

    void loadSavedTexts();

    return () => {
      cancelled = true;
    };
  }, [user, showError, showSuccess]);

  useEffect(() => {
    persistAutoScrollDraft({ text, fontSize, speed, blinkPauseEnabled });
  }, [text, fontSize, speed, blinkPauseEnabled]);

  const stopScroll = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    lastFrameRef.current = null;
    addLog('scroll:stopped-at-end');
  }, [addLog]);

  const setPlaybackPlaying = useCallback(
    (playing: boolean, source: string) => {
      const previous = isPlayingRef.current;
      isPlayingRef.current = playing;
      setIsPlaying(playing);
      lastFrameRef.current = null;
      addLog(
        `playback:${source} ${previous ? 'playing' : 'paused'} -> ${playing ? 'playing' : 'paused'}`,
      );
    },
    [addLog],
  );

  useEffect(() => {
    if (!isScrollMode) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        addLog('scroll:loop-stopped');
      }
      return;
    }

    addLog('scroll:loop-started');

    const step = (timestamp: number) => {
      if (!isScrollModeRef.current) {
        return;
      }

      const container = scrollContainerRef.current;
      const content = contentRef.current;

      if (container && content && isPlayingRef.current) {
        if (lastFrameRef.current === null) {
          lastFrameRef.current = timestamp;
        }

        const delta = (timestamp - lastFrameRef.current) / 1000;
        lastFrameRef.current = timestamp;

        const maxScroll = Math.max(0, content.scrollHeight - container.clientHeight);
        scrollPosRef.current += speedRef.current * delta;

        if (scrollPosRef.current >= maxScroll) {
          scrollPosRef.current = maxScroll;
          container.scrollTop = maxScroll;
          stopScroll();
        } else {
          container.scrollTop = scrollPosRef.current;
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      addLog('scroll:loop-cleanup');
    };
  }, [isScrollMode, stopScroll, addLog]);

  const handleStart = () => {
    if (!text.trim()) return;
    setIsScrollMode(true);
    scrollPosRef.current = 0;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    lastFrameRef.current = null;
    setPlaybackPlaying(true, 'start');
  };

  const handleExitScrollMode = () => {
    setPlaybackPlaying(false, 'exit');
    setIsScrollMode(false);
  };

  const resetBlinkDetectionRef = useRef<() => void>(() => {});

  const {
    isReady: isBlinkPauseReady,
    isFaceDetected,
    secondBlinkCountdown,
    error: blinkPauseError,
    resetBlinkDetection,
  } = useBlinkPause({
    enabled: isScrollMode && blinkPauseEnabled,
    onTogglePause: () => {
      setPlaybackPlaying(!isPlayingRef.current, 'blink');
      resetBlinkDetectionRef.current();
    },
    onLog: addLog,
  });

  useEffect(() => {
    resetBlinkDetectionRef.current = resetBlinkDetection;
  }, [resetBlinkDetection]);

  const handlePauseResume = useCallback(() => {
    const nextPlaying = !isPlayingRef.current;
    setPlaybackPlaying(nextPlaying, 'manual-button');
    resetBlinkDetectionRef.current();
  }, [setPlaybackPlaying]);

  useEffect(() => {
    if (blinkPauseError) {
      showError(blinkPauseError);
    }
  }, [blinkPauseError, showError]);

  const increaseFontSize = () => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 8));
  const decreaseFontSize = () => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 8));

  const handleViewportScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    scrollPosRef.current = container.scrollTop;
  }, []);

  const handleSaveText = async () => {
    if (!user) {
      showError('Sign in to save texts to your account.');
      return;
    }
    if (!text.trim()) {
      showError('Add some text before saving.');
      return;
    }

    const trimmedName = saveName.trim() || 'Untitled text';
    setIsSavingText(true);
    try {
      const newText = await createAutoScrollText(user.uid, {
        name: trimmedName,
        text,
        fontSize,
        speed,
      });
      setSavedTexts((prev) => [newText, ...prev]);
      setLoadedTextId(newText.id);
      setSaveName(trimmedName);
      showSuccess(`Saved "${trimmedName}"`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save text.');
    } finally {
      setIsSavingText(false);
    }
  };

  const handleUpdateText = async () => {
    if (!user) {
      showError('Sign in to update saved texts.');
      return;
    }
    if (!loadedTextId) return;

    const existing = savedTexts.find((item) => item.id === loadedTextId);
    if (!existing) {
      setLoadedTextId(null);
      setSaveName('');
      showError('Saved text no longer exists — save as a new text instead.');
      return;
    }

    if (!text.trim()) {
      showError('Add some text before saving.');
      return;
    }

    const trimmedName = saveName.trim() || existing.name;
    setIsSavingText(true);
    try {
      await updateAutoScrollText(user.uid, loadedTextId, {
        name: trimmedName,
        text,
        fontSize,
        speed,
      });
      const updatedAt = new Date().toISOString();
      setSavedTexts((prev) =>
        prev.map((item) =>
          item.id === loadedTextId
            ? { ...item, name: trimmedName, text, fontSize, speed, updatedAt }
            : item,
        ),
      );
      setSaveName(trimmedName);
      showSuccess(`Updated "${trimmedName}"`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update text.');
    } finally {
      setIsSavingText(false);
    }
  };

  const handleLoadText = (item: SavedAutoScrollText) => {
    setText(item.text);
    setFontSize(item.fontSize);
    setSpeed(item.speed);
    setSaveName(item.name);
    setLoadedTextId(item.id);
    showSuccess(`Loaded "${item.name}"`);
  };

  const handleDeleteText = async (itemId: string) => {
    const item = savedTexts.find((entry) => entry.id === itemId);

    try {
      await deleteAutoScrollText(itemId);
      setSavedTexts((prev) => prev.filter((entry) => entry.id !== itemId));
      if (loadedTextId === itemId) {
        setLoadedTextId(null);
        setSaveName('');
      }
      showSuccess(item ? `Deleted "${item.name}"` : 'Deleted saved text');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete text.');
    }
  };

  const handleClearEditor = () => {
    setText('');
    setSaveName('');
    setLoadedTextId(null);
    showSuccess('Editor cleared');
  };

  if (isScrollMode) {
    const showBlinkCountdown = blinkPauseEnabled && secondBlinkCountdown > 0;

    return (
      <div className="auto-scroll-session scroll-mode">
        <div className="auto-scroll-toolbar">
          <button className="btn-back" onClick={handleExitScrollMode} type="button">
            ← Exit
          </button>
          <label className="auto-scroll-speed-control">
            Speed
            <input
              type="range"
              min={MIN_SPEED}
              max={MAX_SPEED}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span>{speed} px/s</span>
          </label>
          <button className="btn-teacher" onClick={handlePauseResume} type="button">
            {isPlaying ? '⏸ Pause' : '▶ Resume'}
          </button>
          <button
            className="btn-teacher auto-scroll-logs-toggle"
            onClick={() => setShowLogs((visible) => !visible)}
            type="button"
          >
            {showLogs ? 'Hide logs' : 'Show logs'}
          </button>
        </div>

        {blinkPauseEnabled && (
          <div
            className={`auto-scroll-blink-countdown${showBlinkCountdown ? ' active' : ''}`}
            aria-hidden={!showBlinkCountdown}
          >
            <div
              className="auto-scroll-blink-countdown-fill"
              style={{ transform: `scaleY(${secondBlinkCountdown})` }}
            />
          </div>
        )}

        {!isBlinkPauseReady && blinkPauseEnabled && (
          <div className="auto-scroll-blink-camera-status" aria-live="polite">
            Starting blink camera…
          </div>
        )}

        {isBlinkPauseReady && blinkPauseEnabled && !isFaceDetected && (
          <div className="auto-scroll-blink-camera-status" aria-live="polite">
            Looking for face…
          </div>
        )}

        <div className="auto-scroll-size-buttons">
          <button
            className="auto-scroll-size-btn"
            onClick={decreaseFontSize}
            type="button"
            aria-label="Decrease text size"
          >
            A−
          </button>
          <button
            className="auto-scroll-size-btn"
            onClick={increaseFontSize}
            type="button"
            aria-label="Increase text size"
          >
            A+
          </button>
        </div>

        <div
          className="auto-scroll-viewport"
          ref={scrollContainerRef}
          onScroll={handleViewportScroll}
        >
          <div
            className="auto-scroll-content"
            ref={contentRef}
            style={{ fontSize: `${fontSize}px` }}
          >
            {text.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p>
            ))}
          </div>
        </div>

        {showLogs && (
          <div className="auto-scroll-debug-panel">
            <div className="auto-scroll-debug-header">
              <strong>Debug logs</strong>
              <button className="btn-teacher" onClick={() => setDebugLogs([])} type="button">
                Clear
              </button>
            </div>
            <div className="auto-scroll-debug-status">
              playing={String(isPlaying)} ref={String(isPlayingRef.current)} pos=
              {Math.round(scrollPosRef.current)}
              {contentRef.current && scrollContainerRef.current
                ? ` / ${Math.max(0, contentRef.current.scrollHeight - scrollContainerRef.current.clientHeight)}`
                : ''}
            </div>
            <ul className="auto-scroll-debug-list">
              {debugLogs.length === 0 ? (
                <li>No logs yet.</li>
              ) : (
                debugLogs.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auto-scroll-session">
      <div className="session-header">
        <button className="btn-back" onClick={onBack} type="button">
          ← Back to Sessions
        </button>
        <h2>Auto Scroll</h2>
        <p>Enter text and scroll it automatically — ideal for lyrics, scripts, or prompts.</p>
      </div>

      <div className="auto-scroll-setup">
        <label className="auto-scroll-label" htmlFor="auto-scroll-text">
          Text to scroll
        </label>
        <textarea
          id="auto-scroll-text"
          className="auto-scroll-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type your text here…"
          rows={12}
        />

        <div className="auto-scroll-save-panel">
          <label className="auto-scroll-label" htmlFor="auto-scroll-save-name">
            Save as
          </label>
          <small className="auto-scroll-save-hint">
            Saved to your Firebase account — available on any signed-in device.
          </small>
          <div className="auto-scroll-save-row">
            <input
              id="auto-scroll-save-name"
              className="auto-scroll-save-input"
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this text…"
            />
            {loadedTextId ? (
              <button
                className="btn-teacher"
                onClick={() => void handleUpdateText()}
                disabled={isSavingText}
                type="button"
              >
                {isSavingText ? 'Saving…' : '💾 Update'}
              </button>
            ) : (
              <button
                className="btn-teacher"
                onClick={() => void handleSaveText()}
                disabled={isSavingText}
                type="button"
              >
                {isSavingText ? 'Saving…' : '💾 Save'}
              </button>
            )}
            <button className="btn-teacher" onClick={handleClearEditor} type="button">
              🗑️ Clear
            </button>
          </div>
        </div>

        <div className="auto-scroll-saved-list">
          <h4>Saved texts</h4>
          {loadingSavedTexts ? (
            <p className="auto-scroll-saved-empty">Loading saved texts…</p>
          ) : savedTexts.length === 0 ? (
            <p className="auto-scroll-saved-empty">No saved texts yet.</p>
          ) : (
            <ul>
              {savedTexts.map((item) => (
                <li key={item.id} className={loadedTextId === item.id ? 'selected' : ''}>
                  <div className="auto-scroll-saved-info">
                    <strong>{item.name}</strong>
                    <span>{item.text.trim().slice(0, 60)}{item.text.length > 60 ? '…' : ''}</span>
                  </div>
                  <div className="auto-scroll-saved-actions">
                    <button
                      className="btn-teacher"
                      onClick={() => handleLoadText(item)}
                      type="button"
                    >
                      Load
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => void handleDeleteText(item.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="auto-scroll-settings">
          <label className="auto-scroll-speed-control">
            Scroll speed
            <input
              type="range"
              min={MIN_SPEED}
              max={MAX_SPEED}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span>{speed} px/s</span>
          </label>

          <div className="auto-scroll-size-setup">
            <span>Text size</span>
            <div className="auto-scroll-size-setup-buttons">
              <button
                className="auto-scroll-size-btn"
                onClick={decreaseFontSize}
                type="button"
                aria-label="Decrease text size"
              >
                A−
              </button>
              <span className="auto-scroll-size-preview" style={{ fontSize: `${fontSize}px` }}>
                Aa
              </span>
              <button
                className="auto-scroll-size-btn"
                onClick={increaseFontSize}
                type="button"
                aria-label="Increase text size"
              >
                A+
              </button>
            </div>
          </div>
        </div>

        <label className="auto-scroll-blink-toggle">
          <input
            type="checkbox"
            checked={blinkPauseEnabled}
            onChange={(e) => setBlinkPauseEnabled(e.target.checked)}
          />
          <span>
            <strong>Hands-free pause (blink twice)</strong>
            <small>
              During scrolling, blink twice with a short pause between blinks to pause or resume. Camera access is required.
            </small>
          </span>
        </label>

        <button
          className="btn-teacher auto-scroll-start-btn"
          onClick={handleStart}
          disabled={!text.trim()}
          type="button"
        >
          ▶ Start Scrolling
        </button>
      </div>
    </div>
  );
};

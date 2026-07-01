import React, { useState } from 'react';
import { notes } from '../utils/audio';
import type { FreesoundResult } from '../utils/freesound';
import { useFreesound } from '../hooks/useFreesound';
import { useQuadrantRecorder } from '../hooks/useQuadrantRecorder';
import { useStatus } from '../hooks/useStatus';
import {
  CHORD_PRESETS,
  defaultChordForCell,
  type CellId,
  type QuadrantSoundConfig,
  type SoundSourceType,
  type ToneMode,
  getSoundLabel,
  storedFreesoundFromResult
} from '../utils/quadrantAudio';
import { getCellMeta, type GridLayout } from '../utils/soundGrid';

interface QuadrantSoundPanelProps {
  gridLayout: GridLayout;
  cellIds: CellId[];
  configs: Record<CellId, QuadrantSoundConfig>;
  uploadingQuadrants?: Partial<Record<CellId, boolean>>;
  isSignedIn?: boolean;
  onChange: (id: CellId, config: QuadrantSoundConfig) => void;
  onUpload: (id: CellId, file: File) => void;
  onPreview: (id: CellId) => void;
}

const WAVE_TYPES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

const SOUND_TABS: { type: SoundSourceType; label: string }[] = [
  { type: 'tone', label: 'Note / chord' },
  { type: 'freesound', label: 'Freesound' },
  { type: 'upload', label: 'Upload' },
  { type: 'record', label: 'Record' }
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const QuadrantSoundPanel: React.FC<QuadrantSoundPanelProps> = ({
  gridLayout,
  cellIds,
  configs,
  uploadingQuadrants = {},
  isSignedIn = false,
  onChange,
  onUpload,
  onPreview
}) => {
  const { searchSoundsStrict, isLoading } = useFreesound();
  const { showError } = useStatus();
  const {
    recordingQuadrant,
    elapsedSec,
    maxRecordSec,
    isSupported: isRecordSupported,
    startRecording,
    stopRecording,
    cancelRecording
  } = useQuadrantRecorder();

  const [open, setOpen] = useState(true);
  const [activeSearchId, setActiveSearchId] = useState<CellId | null>(null);
  const [searchQueries, setSearchQueries] = useState<Partial<Record<CellId, string>>>({});
  const [searchResults, setSearchResults] = useState<Partial<Record<CellId, FreesoundResult[]>>>({});

  const runSearch = async (id: CellId) => {
    const query = (searchQueries[id] ?? '').trim();
    if (!query) return;
    setActiveSearchId(id);
    try {
      const results = await searchSoundsStrict(query, { limit: 6, maxDuration: 15 });
      setSearchResults((prev) => ({ ...prev, [id]: results }));
    } finally {
      setActiveSearchId(null);
    }
  };

  const setType = (id: CellId, type: SoundSourceType) => {
    onChange(id, { ...configs[id], type });
  };

  const handleStartRecord = async (id: CellId) => {
    if (!isSignedIn) {
      showError('Sign in to save recorded samples to cloud storage.');
      return;
    }
    if (recordingQuadrant && recordingQuadrant !== id) {
      showError('Stop the current recording first.');
      return;
    }
    try {
      await startRecording(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start recording';
      showError(message);
    }
  };

  const handleStopRecord = async (id: CellId) => {
    if (recordingQuadrant !== id) return;
    const file = await stopRecording();
    if (file) {
      onUpload(id, file);
    }
  };

  const gridLabel =
    gridLayout.rows === 1
      ? `1 row × ${gridLayout.cols} columns`
      : gridLayout.cols === 1
        ? `${gridLayout.rows} rows × 1 column`
        : `${gridLayout.rows} rows × ${gridLayout.cols} columns`;

  return (
    <section className="calibration-panel quadrant-sound-panel">
      <button
        type="button"
        className="calibration-panel-toggle quadrant-sound-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>🔊 Grid sounds ({gridLabel})</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="calibration-panel-body">
          <p className="calibration-intro">
            Choose a note, Freesound clip, upload a file, or record a sample for each cell in your
            grid. Uploads and recordings are saved to Firebase cloud storage.
          </p>

          {cellIds.map((id) => {
            const meta = getCellMeta(id, gridLayout);
            const config = configs[id];
            const results = searchResults[id] ?? [];
            const isRecording = recordingQuadrant === id;
            const isBusy = Boolean(uploadingQuadrants[id]) || isRecording;

            return (
              <div key={id} className="quadrant-sound-editor" style={{ borderColor: meta.colour }}>
                <div className="quadrant-sound-editor-header">
                  <strong>{meta.label}</strong>
                  <span className="quadrant-sound-current">{getSoundLabel(config)}</span>
                </div>

                <div className="sound-type-tabs sound-type-tabs-four">
                  {SOUND_TABS.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      className={`sound-type-tab ${config.type === type ? 'active' : ''}`}
                      onClick={() => setType(id, type)}
                      disabled={isRecording && type !== 'record'}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {config.type === 'tone' && (
                  <div className="quadrant-sound-tone-controls">
                    <div className="tone-mode-tabs">
                      {(['note', 'chord'] as ToneMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`tone-mode-tab ${(config.toneMode ?? 'note') === mode ? 'active' : ''}`}
                          onClick={() =>
                            onChange(id, {
                              ...config,
                              toneMode: mode,
                              chord: config.chord ?? defaultChordForCell(id)
                            })
                          }
                        >
                          {mode === 'note' ? 'Note' : 'Chord'}
                        </button>
                      ))}
                    </div>
                    {(config.toneMode ?? 'note') === 'chord' ? (
                      <label className="quadrant-sound-field">
                        Chord
                        <select
                          value={config.chord ?? defaultChordForCell(id)}
                          onChange={(e) => onChange(id, { ...config, chord: e.target.value })}
                        >
                          {Object.entries(CHORD_PRESETS).map(([chordId, chord]) => (
                            <option key={chordId} value={chordId}>
                              {chord.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="quadrant-sound-field">
                        Note
                        <select
                          value={config.note}
                          onChange={(e) => onChange(id, { ...config, note: e.target.value })}
                        >
                          {notes.map((note) => (
                            <option key={note} value={note}>
                              {note}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="quadrant-sound-field">
                      Wave
                      <select
                        value={config.waveType}
                        onChange={(e) =>
                          onChange(id, { ...config, waveType: e.target.value as OscillatorType })
                        }
                      >
                        {WAVE_TYPES.map((wave) => (
                          <option key={wave} value={wave}>
                            {wave}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {config.type === 'freesound' && (
                  <div className="quadrant-sound-freesound-controls">
                    <div className="quadrant-sound-search-row">
                      <input
                        type="search"
                        placeholder="Search Freesound…"
                        value={searchQueries[id] ?? ''}
                        onChange={(e) =>
                          setSearchQueries((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void runSearch(id);
                        }}
                      />
                      <button
                        type="button"
                        className="btn-calibration"
                        disabled={isLoading && activeSearchId === id}
                        onClick={() => void runSearch(id)}
                      >
                        Search
                      </button>
                    </div>
                    {config.freesound && (
                      <p className="quadrant-sound-assigned">Assigned: {config.freesound.name}</p>
                    )}
                    {results.length > 0 && (
                      <ul className="quadrant-sound-results">
                        {results.map((sound) => (
                          <li key={sound.id}>
                            <button
                              type="button"
                              className="quadrant-sound-result-btn"
                              onClick={() =>
                                onChange(id, {
                                  ...config,
                                  type: 'freesound',
                                  freesound: storedFreesoundFromResult(sound)
                                })
                              }
                            >
                              {sound.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {config.type === 'upload' && (
                  <div className="quadrant-sound-upload-controls">
                    {!isSignedIn && (
                      <p className="quadrant-sound-signin-hint">Sign in to upload sounds to cloud storage.</p>
                    )}
                    <label className="quadrant-sound-upload-label">
                      Audio file
                      <input
                        type="file"
                        accept="audio/*"
                        disabled={!isSignedIn || isBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUpload(id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {uploadingQuadrants[id] && (
                      <p className="quadrant-sound-assigned">Uploading…</p>
                    )}
                    {config.uploadName && !uploadingQuadrants[id] && (
                      <p className="quadrant-sound-assigned">Saved: {config.uploadName}</p>
                    )}
                  </div>
                )}

                {config.type === 'record' && (
                  <div className="quadrant-sound-record-controls">
                    {!isSignedIn && (
                      <p className="quadrant-sound-signin-hint">Sign in to save recordings to cloud storage.</p>
                    )}
                    {!isRecordSupported && (
                      <p className="quadrant-sound-signin-hint">Recording is not supported in this browser.</p>
                    )}
                    {isRecording ? (
                      <div className="quadrant-record-active">
                        <span className="quadrant-record-dot" aria-hidden />
                        <span>
                          Recording {formatElapsed(elapsedSec)} / {formatElapsed(maxRecordSec)}
                        </span>
                      </div>
                    ) : (
                      <p className="quadrant-sound-assigned">
                        Record a short sample with your microphone (up to {maxRecordSec}s).
                      </p>
                    )}
                    <div className="quadrant-record-actions">
                      {!isRecording ? (
                        <button
                          type="button"
                          className="btn-calibration record-start-btn"
                          disabled={!isSignedIn || !isRecordSupported || isBusy}
                          onClick={() => void handleStartRecord(id)}
                        >
                          Start recording
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-calibration record-stop-btn"
                            onClick={() => void handleStopRecord(id)}
                          >
                            Stop &amp; save
                          </button>
                          <button
                            type="button"
                            className="btn-calibration secondary"
                            onClick={cancelRecording}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                    {config.uploadName && !isRecording && !uploadingQuadrants[id] && (
                      <p className="quadrant-sound-assigned">Saved: {config.uploadName}</p>
                    )}
                    {uploadingQuadrants[id] && (
                      <p className="quadrant-sound-assigned">Saving recording…</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="btn-preview-sound"
                  disabled={isRecording}
                  onClick={() => onPreview(id)}
                >
                  Preview
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

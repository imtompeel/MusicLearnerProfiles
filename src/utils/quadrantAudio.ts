import { noteToFrequency } from './audio';
import type { FreesoundResult } from './freesound';
import {
  type CellId,
  type GridLayout,
  DEFAULT_GRID_LAYOUT,
  getCellIds,
  loadGridLayout,
  parseCellId,
  remapSoundConfigsForLayout
} from './soundGrid';

export type { CellId };
/** @deprecated Use CellId */
export type QuadrantId = CellId;

export type SoundSourceType = 'tone' | 'freesound' | 'upload' | 'record';

export interface StoredFreesoundRef {
  id: number;
  name: string;
  previews: FreesoundResult['previews'];
}

export type ToneMode = 'note' | 'chord';

export interface QuadrantSoundConfig {
  type: SoundSourceType;
  toneMode: ToneMode;
  note: string;
  chord: string;
  waveType: OscillatorType;
  freesound?: StoredFreesoundRef;
  uploadName?: string;
  uploadStoragePath?: string;
  uploadUrl?: string;
}

export const CHORD_PRESETS: Record<string, { label: string; notes: string[] }> = {
  C: { label: 'C major', notes: ['C4', 'E4', 'G4'] },
  Dm: { label: 'D minor', notes: ['D4', 'F4', 'A4'] },
  Em: { label: 'E minor', notes: ['E4', 'G4', 'B4'] },
  F: { label: 'F major', notes: ['F4', 'A4', 'C5'] },
  G: { label: 'G major', notes: ['G4', 'B4', 'D5'] },
  Am: { label: 'A minor', notes: ['A4', 'C5', 'E5'] },
  Dm7: { label: 'D minor 7', notes: ['D4', 'F4', 'A4', 'C5'] },
  G7: { label: 'G dominant 7', notes: ['G4', 'B4', 'D5', 'F5'] },
  Cmaj7: { label: 'C major 7', notes: ['C4', 'E4', 'G4', 'B4'] }
};

const DEFAULT_NOTES = ['C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C5', 'E5', 'G5', 'B5', 'D6'];
const DEFAULT_CHORDS = ['C', 'Em', 'G', 'Am', 'F', 'Dm', 'G7', 'Dm7', 'Cmaj7'];
const DEFAULT_WAVES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

const STORAGE_KEY = 'colourTrackerQuadrantSounds';
const MIRROR_STORAGE_KEY = 'colourTrackerMirrorView';

const MAX_CHANNEL_GAIN = 0.22;
const GAIN_SMOOTHING = 0.12;

export function defaultChordForCell(id: CellId): string {
  const parsed = parseCellId(id);
  const index = parsed ? parsed.row * 8 + parsed.col : 0;
  return DEFAULT_CHORDS[index % DEFAULT_CHORDS.length];
}

export function defaultNoteForCell(id: CellId): string {
  const parsed = parseCellId(id);
  const index = parsed ? parsed.row * 8 + parsed.col : 0;
  return DEFAULT_NOTES[index % DEFAULT_NOTES.length];
}

export function defaultWaveForCell(id: CellId): OscillatorType {
  const parsed = parseCellId(id);
  const index = parsed ? parsed.row * 8 + parsed.col : 0;
  return DEFAULT_WAVES[index % DEFAULT_WAVES.length];
}

export function defaultSoundForCell(id: CellId): QuadrantSoundConfig {
  return {
    type: 'tone',
    toneMode: 'note',
    note: defaultNoteForCell(id),
    chord: defaultChordForCell(id),
    waveType: defaultWaveForCell(id)
  };
}

export function defaultQuadrantSounds(layout: GridLayout = DEFAULT_GRID_LAYOUT): Record<CellId, QuadrantSoundConfig> {
  return getCellIds(layout).reduce(
    (acc, id) => {
      acc[id] = defaultSoundForCell(id);
      return acc;
    },
    {} as Record<CellId, QuadrantSoundConfig>
  );
}

export function loadQuadrantSounds(layout: GridLayout = loadGridLayout()): Record<CellId, QuadrantSoundConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultQuadrantSounds(layout);
    const parsed = JSON.parse(raw) as Record<string, Partial<QuadrantSoundConfig>>;
    const migrated = remapSoundConfigsForLayout(parsed, layout, defaultSoundForCell);
    return getCellIds(layout).reduce(
      (acc, id) => {
        const base = defaultSoundForCell(id);
        const stored = migrated[id];
        acc[id] = {
          ...base,
          ...stored,
          chord: stored.chord ?? base.chord,
          toneMode: stored.toneMode ?? 'note'
        };
        return acc;
      },
      {} as Record<CellId, QuadrantSoundConfig>
    );
  } catch {
    return defaultQuadrantSounds(layout);
  }
}

export function remapConfigsForLayout(
  configs: Record<CellId, QuadrantSoundConfig>,
  layout: GridLayout
): Record<CellId, QuadrantSoundConfig> {
  return getCellIds(layout).reduce(
    (acc, id) => {
      acc[id] = configs[id] ?? defaultSoundForCell(id);
      return acc;
    },
    {} as Record<CellId, QuadrantSoundConfig>
  );
}

export function saveQuadrantSounds(
  configs: Record<CellId, QuadrantSoundConfig>,
  layout: GridLayout = loadGridLayout()
): void {
  const serialisable = getCellIds(layout).reduce(
    (acc, id) => {
      const config = configs[id] ?? defaultSoundForCell(id);
      acc[id] = {
        type: config.type,
        toneMode: config.toneMode ?? 'note',
        note: config.note,
        chord: config.chord ?? defaultChordForCell(id),
        waveType: config.waveType,
        freesound: config.freesound,
        uploadName: config.uploadName,
        uploadStoragePath: config.uploadStoragePath,
        uploadUrl: config.uploadUrl
      };
      return acc;
    },
    {} as Record<CellId, QuadrantSoundConfig>
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
  } catch {
    // ignore
  }
}

export function weightToGain(weight: number): number {
  return Math.min(MAX_CHANNEL_GAIN, weight * 4 * MAX_CHANNEL_GAIN);
}

export function loadMirrorView(): boolean {
  try {
    const raw = localStorage.getItem(MIRROR_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function saveMirrorView(mirror: boolean): void {
  try {
    localStorage.setItem(MIRROR_STORAGE_KEY, String(mirror));
  } catch {
    // ignore
  }
}

export function freesoundPreviewUrl(sound: StoredFreesoundRef): string | null {
  return sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'] || null;
}

export function storedFreesoundFromResult(sound: FreesoundResult): StoredFreesoundRef {
  return {
    id: sound.id,
    name: sound.name,
    previews: sound.previews
  };
}

export function getSoundLabel(config: QuadrantSoundConfig): string {
  if (config.type === 'tone') {
    if (config.toneMode === 'chord') {
      const chord = CHORD_PRESETS[config.chord];
      return chord?.label ?? config.chord;
    }
    return config.note;
  }
  if (config.type === 'freesound') return config.freesound?.name ?? 'Freesound';
  if (config.type === 'upload' || config.type === 'record') {
    return config.uploadName ?? (config.type === 'record' ? 'Recorded sample' : 'Uploaded sound');
  }
  return 'Sound';
}

export function getConfigNoteNames(config: QuadrantSoundConfig): string[] {
  if (config.type !== 'tone') return [];
  if (config.toneMode === 'chord') {
    return CHORD_PRESETS[config.chord]?.notes ?? CHORD_PRESETS.C.notes;
  }
  return [config.note];
}

export function getConfigFrequencies(config: QuadrantSoundConfig): number[] {
  return getConfigNoteNames(config).map((note) => noteToFrequency(note));
}

type ToneChannel = {
  kind: 'tone';
  oscillators: OscillatorNode[];
  gain: GainNode;
};

type SampleChannel = {
  kind: 'sample';
  audio: HTMLAudioElement;
  currentGain: number;
};

type Channel = ToneChannel | SampleChannel;

export class QuadrantAudioEngine {
  private ctx: AudioContext | null = null;
  private channels: Partial<Record<CellId, Channel>> = {};
  private configs: Record<CellId, QuadrantSoundConfig> = {};
  private uploadUrls: Partial<Record<CellId, string>> = {};
  private toneGains: Record<CellId, number> = {};
  private cellIds: CellId[] = [];

  init(layout: GridLayout = loadGridLayout()): void {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.setGridLayout(layout);
  }

  resume(): void {
    void this.ctx?.resume();
  }

  setGridLayout(layout: GridLayout): void {
    const nextIds = getCellIds(layout);
    const prevIds = new Set(this.cellIds);

    nextIds.forEach((id) => {
      if (!prevIds.has(id)) {
        this.toneGains[id] = 0;
      }
    });

    this.cellIds.forEach((id) => {
      if (!nextIds.includes(id)) {
        this.disposeChannel(id);
        delete this.toneGains[id];
      }
    });

    this.cellIds = nextIds;
    this.rebuildAll();
  }

  setConfigs(configs: Record<CellId, QuadrantSoundConfig>): void {
    this.cellIds.forEach((id) => {
      const prev = this.configs[id] ?? defaultSoundForCell(id);
      const next = configs[id] ?? defaultSoundForCell(id);
      const changed =
        prev.type !== next.type ||
        prev.toneMode !== next.toneMode ||
        prev.note !== next.note ||
        prev.chord !== next.chord ||
        prev.waveType !== next.waveType ||
        prev.freesound?.id !== next.freesound?.id ||
        prev.uploadName !== next.uploadName ||
        prev.uploadUrl !== next.uploadUrl ||
        prev.uploadStoragePath !== next.uploadStoragePath;
      if (changed) {
        this.disposeChannel(id);
      }
    });
    this.configs = { ...configs };
    this.rebuildAll();
  }

  setUploadUrl(id: CellId, url: string | null): void {
    const prev = this.uploadUrls[id];
    if (prev && prev.startsWith('blob:')) {
      URL.revokeObjectURL(prev);
    }
    if (url) {
      this.uploadUrls[id] = url;
    } else {
      delete this.uploadUrls[id];
    }
    const config = this.configs[id];
    if (config && (config.type === 'upload' || config.type === 'record')) {
      this.disposeChannel(id);
      this.ensureChannel(id);
    }
  }

  updateGains(weights: Record<CellId, number>): void {
    const ctx = this.ctx;
    if (!ctx) return;

    this.cellIds.forEach((id) => {
      const channel = this.channels[id];
      if (!channel) return;

      const target = weightToGain(weights[id] ?? 0);

      if (channel.kind === 'tone') {
        const current = this.toneGains[id] ?? 0;
        const next = current + (target - current) * GAIN_SMOOTHING;
        this.toneGains[id] = next;
        channel.gain.gain.setTargetAtTime(next, ctx.currentTime, 0.03);
        return;
      }

      const normalised = Math.min(1, target / MAX_CHANNEL_GAIN);
      channel.currentGain = channel.currentGain + (normalised - channel.currentGain) * GAIN_SMOOTHING;
      channel.audio.volume = channel.currentGain;

      if (channel.currentGain > 0.03 && channel.audio.paused) {
        void channel.audio.play().catch(() => undefined);
      } else if (channel.currentGain < 0.01 && !channel.audio.paused) {
        channel.audio.pause();
      }
    });
  }

  dispose(): void {
    this.cellIds.forEach((id) => this.disposeChannel(id));
    this.channels = {};
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    Object.values(this.uploadUrls).forEach((url) => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    this.uploadUrls = {};
    this.toneGains = {};
    this.cellIds = [];
  }

  private rebuildAll(): void {
    if (!this.ctx) return;
    this.cellIds.forEach((id) => this.ensureChannel(id));
  }

  private ensureChannel(id: CellId): void {
    if (!this.ctx || this.channels[id]) return;

    const config = this.configs[id] ?? defaultSoundForCell(id);
    if (config.type === 'tone') {
      const frequencies = getConfigFrequencies(config);
      const gain = this.ctx.createGain();
      gain.connect(this.ctx.destination);
      gain.gain.value = 0;

      const oscillators = frequencies.map((frequency) => {
        const osc = this.ctx!.createOscillator();
        osc.type = config.waveType;
        osc.frequency.value = frequency;
        osc.connect(gain);
        osc.start();
        return osc;
      });

      this.channels[id] = { kind: 'tone', oscillators, gain };
      return;
    }

    const url = this.resolveSampleUrl(id, config);
    if (!url) return;

    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    this.channels[id] = { kind: 'sample', audio, currentGain: 0 };
  }

  private resolveSampleUrl(id: CellId, config: QuadrantSoundConfig): string | null {
    if (config.type === 'freesound' && config.freesound) {
      return freesoundPreviewUrl(config.freesound);
    }
    if (config.type === 'upload' || config.type === 'record') {
      return config.uploadUrl ?? this.uploadUrls[id] ?? null;
    }
    return null;
  }

  private disposeChannel(id: CellId): void {
    const channel = this.channels[id];
    if (!channel) return;

    if (channel.kind === 'tone') {
      channel.oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
        osc.disconnect();
      });
      channel.gain.disconnect();
      this.toneGains[id] = 0;
    } else {
      channel.audio.pause();
      channel.audio.src = '';
    }

    delete this.channels[id];
  }
}

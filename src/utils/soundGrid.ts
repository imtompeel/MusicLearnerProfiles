import type { MixZone } from './mixZone';
import { clampMixZone } from './mixZone';

export type CellId = string;

export interface GridLayout {
  rows: number;
  cols: number;
}

export const MIN_GRID_DIMENSION = 1;
export const MAX_GRID_DIMENSION = 6;
export const DEFAULT_GRID_LAYOUT: GridLayout = { rows: 2, cols: 2 };

const GRID_LAYOUT_KEY = 'colourTrackerGridLayout';

const LEGACY_CELL_MAP: Record<string, CellId> = {
  tl: 'r0c0',
  tr: 'r0c1',
  bl: 'r1c0',
  br: 'r1c1'
};

export function cellId(row: number, col: number): CellId {
  return `r${row}c${col}`;
}

export function parseCellId(id: CellId): { row: number; col: number } | null {
  const match = /^r(\d+)c(\d+)$/.exec(id);
  if (!match) return null;
  return { row: parseInt(match[1], 10), col: parseInt(match[2], 10) };
}

export function clampGridLayout(layout: Partial<GridLayout>): GridLayout {
  const rows = Math.max(
    MIN_GRID_DIMENSION,
    Math.min(MAX_GRID_DIMENSION, Math.round(layout.rows ?? DEFAULT_GRID_LAYOUT.rows))
  );
  const cols = Math.max(
    MIN_GRID_DIMENSION,
    Math.min(MAX_GRID_DIMENSION, Math.round(layout.cols ?? DEFAULT_GRID_LAYOUT.cols))
  );
  return { rows, cols };
}

export function getCellIds(layout: GridLayout): CellId[] {
  const ids: CellId[] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      ids.push(cellId(row, col));
    }
  }
  return ids;
}

export function getCellLabel(id: CellId, layout: GridLayout): string {
  const parsed = parseCellId(id);
  if (!parsed) return id;
  if (layout.rows === 1) {
    return `Column ${parsed.col + 1}`;
  }
  if (layout.cols === 1) {
    return `Row ${parsed.row + 1}`;
  }
  return `Row ${parsed.row + 1}, Column ${parsed.col + 1}`;
}

export function getCellColour(id: CellId, layout: GridLayout): string {
  const parsed = parseCellId(id);
  if (!parsed) return '#8e24aa';
  const index = parsed.row * layout.cols + parsed.col;
  const total = layout.rows * layout.cols;
  const hue = Math.round((index / Math.max(1, total)) * 300);
  return `hsl(${hue}, 68%, 52%)`;
}

export function getCellMeta(
  id: CellId,
  layout: GridLayout
): { label: string; colour: string } {
  return {
    label: getCellLabel(id, layout),
    colour: getCellColour(id, layout)
  };
}

export function loadGridLayout(): GridLayout {
  try {
    const raw = localStorage.getItem(GRID_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_GRID_LAYOUT };
    return clampGridLayout(JSON.parse(raw) as Partial<GridLayout>);
  } catch {
    return { ...DEFAULT_GRID_LAYOUT };
  }
}

export function saveGridLayout(layout: GridLayout): void {
  try {
    localStorage.setItem(GRID_LAYOUT_KEY, JSON.stringify(clampGridLayout(layout)));
  } catch {
    // ignore
  }
}

function tent(value: number, centre: number, width: number): number {
  const distance = Math.abs(value - centre) / width;
  return Math.max(0, 1 - distance);
}

function isInMixZone(cx: number, cy: number, zone: MixZone): boolean {
  return cx >= zone.x && cx <= zone.x + zone.w && cy >= zone.y && cy <= zone.y + zone.h;
}

function distanceOutsideZone(cx: number, cy: number, zone: MixZone): number {
  const left = zone.x;
  const right = zone.x + zone.w;
  const top = zone.y;
  const bottom = zone.y + zone.h;

  let dx = 0;
  let dy = 0;

  if (cx < left) dx = left - cx;
  else if (cx > right) dx = cx - right;

  if (cy < top) dy = top - cy;
  else if (cy > bottom) dy = cy - bottom;

  return Math.hypot(dx, dy);
}

function sharpenWeights(
  weights: Record<CellId, number>,
  cellIds: CellId[],
  amount: number
): Record<CellId, number> {
  const exponent = 1 + amount * 5;
  const sharpened = cellIds.reduce(
    (acc, id) => {
      acc[id] = Math.pow(Math.max(0, weights[id] ?? 0), exponent);
      return acc;
    },
    {} as Record<CellId, number>
  );

  const sum = cellIds.reduce((total, id) => total + sharpened[id], 0);
  if (sum <= 0) return weights;

  return cellIds.reduce(
    (acc, id) => {
      acc[id] = sharpened[id] / sum;
      return acc;
    },
    {} as Record<CellId, number>
  );
}

export function emptyCellWeights(layout: GridLayout): Record<CellId, number> {
  return getCellIds(layout).reduce(
    (acc, id) => {
      acc[id] = 0;
      return acc;
    },
    {} as Record<CellId, number>
  );
}

export function computeCellWeights(
  cx: number,
  cy: number,
  layout: GridLayout,
  zone: MixZone
): Record<CellId, number> {
  const x = Math.max(0, Math.min(1, cx));
  const y = Math.max(0, Math.min(1, cy));
  const cellIds = getCellIds(layout);
  const weights = emptyCellWeights(layout);

  const colWidth = 1 / layout.cols;
  const rowHeight = 1 / layout.rows;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const id = cellId(row, col);
      const wx = tent(x, (col + 0.5) * colWidth, colWidth);
      const wy = tent(y, (row + 0.5) * rowHeight, rowHeight);
      weights[id] = wx * wy;
    }
  }

  const sum = cellIds.reduce((total, id) => total + weights[id], 0);
  if (sum > 0) {
    cellIds.forEach((id) => {
      weights[id] /= sum;
    });
  }

  if (isInMixZone(x, y, clampMixZone(zone))) {
    return weights;
  }

  const outside = distanceOutsideZone(x, y, zone);
  const sharpenAmount = Math.min(1, 0.25 + outside * 2.5);
  return sharpenWeights(weights, cellIds, sharpenAmount);
}

export function migrateLegacyCellId(id: string): CellId {
  return LEGACY_CELL_MAP[id] ?? id;
}

export function remapSoundConfigsForLayout<T>(
  configs: Record<string, T>,
  layout: GridLayout,
  createDefault: (id: CellId) => T
): Record<CellId, T> {
  const remapped: Record<string, T> = {};
  Object.entries(configs).forEach(([id, config]) => {
    remapped[migrateLegacyCellId(id)] = config;
  });

  return getCellIds(layout).reduce(
    (acc, id) => {
      acc[id] = remapped[id] ?? createDefault(id);
      return acc;
    },
    {} as Record<CellId, T>
  );
}

export interface MixZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_MIX_ZONE: MixZone = { x: 0, y: 0, w: 1, h: 1 };
const STORAGE_KEY = 'colourTrackerMixZone';
const MIN_ZONE_SIZE = 0.12;

export function clampMixZone(zone: MixZone): MixZone {
  let { x, y, w, h } = zone;
  w = Math.max(MIN_ZONE_SIZE, Math.min(1, w));
  h = Math.max(MIN_ZONE_SIZE, Math.min(1, h));
  x = Math.max(0, Math.min(1 - w, x));
  y = Math.max(0, Math.min(1 - h, y));
  return { x, y, w, h };
}

export function loadMixZone(): MixZone {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MIX_ZONE };
    return clampMixZone({ ...DEFAULT_MIX_ZONE, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_MIX_ZONE };
  }
}

export function saveMixZone(zone: MixZone): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampMixZone(zone)));
  } catch {
    // ignore
  }
}

export function mixZoneBleedLabel(zone: MixZone): string {
  const area = zone.w * zone.h;
  if (area >= 0.98) return 'Maximum bleed';
  if (area >= 0.7) return 'High bleed';
  if (area >= 0.4) return 'Moderate bleed';
  if (area >= 0.2) return 'Low bleed';
  return 'Minimal bleed';
}

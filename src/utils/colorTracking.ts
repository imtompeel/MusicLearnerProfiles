export interface ColorProfile {
  hueCenter: number;
  hueTolerance: number;
  satMin: number;
  satMax: number;
  valMin: number;
  valMax: number;
  minPixels: number;
}

export const DEFAULT_COLOR_PROFILE: ColorProfile = {
  hueCenter: 330,
  hueTolerance: 28,
  satMin: 0.12,
  satMax: 1,
  valMin: 0.18,
  valMax: 0.98,
  minPixels: 8
};

export const COLOR_PRESETS: Record<string, ColorProfile & { label: string; swatch: string }> = {
  pink: {
    label: 'Pink',
    swatch: '#e91e8c',
    hueCenter: 330,
    hueTolerance: 28,
    satMin: 0.12,
    satMax: 1,
    valMin: 0.18,
    valMax: 0.98,
    minPixels: 8
  },
  red: {
    label: 'Red',
    swatch: '#e53935',
    hueCenter: 0,
    hueTolerance: 18,
    satMin: 0.25,
    satMax: 1,
    valMin: 0.2,
    valMax: 0.98,
    minPixels: 8
  },
  orange: {
    label: 'Orange',
    swatch: '#fb8c00',
    hueCenter: 28,
    hueTolerance: 22,
    satMin: 0.3,
    satMax: 1,
    valMin: 0.2,
    valMax: 0.98,
    minPixels: 8
  },
  yellow: {
    label: 'Yellow',
    swatch: '#fdd835',
    hueCenter: 52,
    hueTolerance: 25,
    satMin: 0.25,
    satMax: 1,
    valMin: 0.35,
    valMax: 1,
    minPixels: 10
  },
  green: {
    label: 'Green',
    swatch: '#43a047',
    hueCenter: 120,
    hueTolerance: 30,
    satMin: 0.2,
    satMax: 1,
    valMin: 0.15,
    valMax: 0.95,
    minPixels: 8
  },
  blue: {
    label: 'Blue',
    swatch: '#1e88e5',
    hueCenter: 210,
    hueTolerance: 28,
    satMin: 0.2,
    satMax: 1,
    valMin: 0.15,
    valMax: 0.95,
    minPixels: 8
  },
  purple: {
    label: 'Purple',
    swatch: '#8e24aa',
    hueCenter: 280,
    hueTolerance: 25,
    satMin: 0.15,
    satMax: 1,
    valMin: 0.15,
    valMax: 0.95,
    minPixels: 8
  }
};

const STORAGE_KEY = 'colourTrackerColorProfile';
const LEGACY_STORAGE_KEY = 'pinkTrackerColorProfile';

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;

  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rn = 0;
  let gn = 0;
  let bn = 0;

  if (h < 60) {
    rn = c;
    gn = x;
  } else if (h < 120) {
    rn = x;
    gn = c;
  } else if (h < 180) {
    gn = c;
    bn = x;
  } else if (h < 240) {
    gn = x;
    bn = c;
  } else if (h < 300) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255)
  };
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function matchesColorProfile(
  r: number,
  g: number,
  b: number,
  profile: ColorProfile
): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  if (hueDistance(h, profile.hueCenter) > profile.hueTolerance) return false;
  if (s < profile.satMin || s > profile.satMax) return false;
  if (v < profile.valMin || v > profile.valMax) return false;
  return true;
}

export function profileFromSample(r: number, g: number, b: number): ColorProfile {
  const { h, s, v } = rgbToHsv(r, g, b);
  return {
    hueCenter: h,
    hueTolerance: 24,
    satMin: Math.max(0.08, s - 0.22),
    satMax: Math.min(1, s + 0.18),
    valMin: Math.max(0.1, v - 0.28),
    valMax: Math.min(1, v + 0.18),
    minPixels: 8
  };
}

export function profileFromHex(hex: string): ColorProfile {
  const normalised = hex.replace('#', '');
  const r = parseInt(normalised.slice(0, 2), 16);
  const g = parseInt(normalised.slice(2, 4), 16);
  const b = parseInt(normalised.slice(4, 6), 16);
  return profileFromSample(r, g, b);
}

export function profileToHex(profile: ColorProfile): string {
  const { r, g, b } = hsvToRgb(
    profile.hueCenter,
    (profile.satMin + profile.satMax) / 2,
    (profile.valMin + profile.valMax) / 2
  );
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function loadSavedColorProfile(): ColorProfile {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLOR_PROFILE };
    const parsed = JSON.parse(raw) as Partial<ColorProfile>;
    const profile = { ...DEFAULT_COLOR_PROFILE, ...parsed };
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_STORAGE_KEY)) {
      saveColorProfile(profile);
    }
    return profile;
  } catch {
    return { ...DEFAULT_COLOR_PROFILE };
  }
}

export function saveColorProfile(profile: ColorProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export interface DetectionResult {
  x: number;
  y: number;
  matchedPixels: number;
}

export function detectColoredObject(
  imageData: ImageData,
  profile: ColorProfile,
  sampleStep: number
): DetectionResult | null {
  const { data, width, height } = imageData;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (matchesColorProfile(r, g, b, profile)) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count < profile.minPixels) return null;

  return {
    x: sumX / count / width,
    y: sumY / count / height,
    matchedPixels: count
  };
}

export function sampleAreaRgb(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number
): { r: number; g: number; b: number } {
  const { data, width, height } = imageData;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y++) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x++) {
      const i = (y * width + x) * 4;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      count++;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0 };
  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count)
  };
}

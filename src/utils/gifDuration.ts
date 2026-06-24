/** Sum frame delays from GIF graphic control extensions (duration of one loop). */
export const parseGifLoopDurationMs = (buffer: ArrayBuffer): number => {
  const bytes = new Uint8Array(buffer);
  let totalCentiseconds = 0;

  for (let i = 0; i < bytes.length - 7; i += 1) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) {
      const delay = bytes[i + 4] | (bytes[i + 5] << 8);
      totalCentiseconds += delay > 0 ? delay : 10;
    }
  }

  const durationMs = totalCentiseconds * 10;
  return durationMs > 0 ? durationMs : 2000;
};

/** Small JPEG thumbnail for idle GIF preview and saved sessions. */
export const GIF_POSTER_MAX_PX = 96;

export const captureImagePosterDataUrl = (
  objectUrl: string,
  maxSize = GIF_POSTER_MAX_PX
): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const longest = Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
        const scale = Math.min(1, maxSize / longest);
        const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = objectUrl;
  });

const capturePosterFromBitmap = (
  source: CanvasImageSource,
  width: number,
  height: number,
  maxSize = GIF_POSTER_MAX_PX
): string | null => {
  try {
    const longest = Math.max(width, height, 1);
    const scale = Math.min(1, maxSize / longest);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
};

export const capturePosterFromFile = async (
  file: File,
  maxSize = GIF_POSTER_MAX_PX
): Promise<string | null> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return capturePosterFromBitmap(bitmap, bitmap.width, bitmap.height, maxSize);
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to object URL decode.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const posterDataUrl = await captureImagePosterDataUrl(objectUrl, maxSize);
  URL.revokeObjectURL(objectUrl);
  return posterDataUrl;
};

/** Freeze the current frame of a loaded image (e.g. mid-GIF playback). */
export const captureFrameFromImageElement = (img: HTMLImageElement): string | null => {
  try {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
};

export type GifMetadata = {
  loopDurationMs: number;
  posterDataUrl: string | null;
};

export const parseGifMetadataFromFile = async (file: File): Promise<GifMetadata> => {
  const buffer = await file.arrayBuffer();
  const loopDurationMs = parseGifLoopDurationMs(buffer);
  const posterDataUrl = await capturePosterFromFile(file);
  return { loopDurationMs, posterDataUrl };
};

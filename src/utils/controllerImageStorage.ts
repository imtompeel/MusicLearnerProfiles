import { deleteObject, getBytes, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import { describeUploadFile, logControllerUpload } from './controllerUploadDebug';

const blobUrlCache = new Map<string, string>();
const blobLoadPromises = new Map<string, Promise<string>>();

const MAX_STATIC_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_GIF_BYTES = 50 * 1024 * 1024;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const IMAGE_EXTENSION_PATTERN = /\.(gif|png|jpe?g|webp|bmp|svg)$/i;

export const isGifFile = (file: File): boolean =>
  file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

export const isAllowedImageFile = (file: File): boolean =>
  file.type.startsWith('image/') || isGifFile(file) || IMAGE_EXTENSION_PATTERN.test(file.name);

export const resolveImageContentType = (file: File): string => {
  if (file.type.startsWith('image/')) return file.type;
  if (isGifFile(file)) return 'image/gif';

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'gif':
      return 'image/gif';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
};

export const validateControllerUploadFile = (file: File): string | null => {
  logControllerUpload('validateControllerUploadFile', {
    file: describeUploadFile(file),
    isGif: isGifFile(file),
    isAllowed: isAllowedImageFile(file)
  });

  if (!isAllowedImageFile(file)) {
    return 'Please choose an image or GIF file';
  }

  const maxBytes = isGifFile(file) ? MAX_GIF_BYTES : MAX_STATIC_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const actual = formatFileSize(file.size);
    const limit = formatFileSize(maxBytes);
    return isGifFile(file)
      ? `GIF is ${actual} — maximum size is ${limit}. Try compressing the GIF or use a shorter clip.`
      : `Image is ${actual} — maximum size is ${limit}`;
  }

  if (file.size === 0) {
    return 'That file appears to be empty';
  }

  return null;
};

const fileExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (/^[a-z0-9]+$/.test(fromName)) return fromName;

  const contentType = resolveImageContentType(file);
  const fromType = contentType.split('/')[1]?.toLowerCase() ?? '';
  if (/^[a-z0-9+.-]+$/.test(fromType)) return fromType.replace('jpeg', 'jpg').replace('svg+xml', 'svg');

  return 'jpg';
};

export const uploadControllerSlotImage = async (
  userId: string,
  slotId: string,
  file: File
): Promise<{ url: string; storagePath: string }> => {
  const validationError = validateControllerUploadFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = resolveImageContentType(file);
  const storagePath = `controller_images/${userId}/slots/${slotId}/${Date.now()}.${fileExtension(file)}`;
  const storageRef = ref(storage, storagePath);

  logControllerUpload('uploadControllerSlotImage start', {
    userId,
    slotId,
    storagePath,
    contentType,
    bucket: storage.app.options.storageBucket ?? null
  });

  await uploadBytes(storageRef, file, { contentType });
  logControllerUpload('uploadBytes complete', { storagePath });

  const url = await getDownloadURL(storageRef);
  logControllerUpload('getDownloadURL complete', { storagePath, urlPreview: url.slice(0, 120) });

  return { url, storagePath };
};

export const deleteControllerSlotImage = async (storagePath: string): Promise<void> => {
  revokeControllerSlotImageBlobUrl(storagePath);
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn('Failed to delete controller image from storage', error);
  }
};

/** Keep an in-memory blob URL after upload so GIF playback does not need a network fetch. */
export const primeControllerSlotImageBlobUrl = (storagePath: string, file: Blob): string => {
  revokeControllerSlotImageBlobUrl(storagePath);
  const blobUrl = URL.createObjectURL(file);
  blobUrlCache.set(storagePath, blobUrl);
  return blobUrl;
};

export const revokeControllerSlotImageBlobUrl = (storagePath: string): void => {
  const cached = blobUrlCache.get(storagePath);
  if (cached?.startsWith('blob:')) {
    URL.revokeObjectURL(cached);
  }
  blobUrlCache.delete(storagePath);
  blobLoadPromises.delete(storagePath);
};

/** Authenticated download via Firebase Storage SDK (required for secured rules + canvas use). */
export const loadControllerSlotImageBlobUrl = async (
  storagePath: string,
  contentType = 'image/gif'
): Promise<string> => {
  const cached = blobUrlCache.get(storagePath);
  if (cached) return cached;

  const inFlight = blobLoadPromises.get(storagePath);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const bytes = await getBytes(ref(storage, storagePath));
    const blob = new Blob([bytes], { type: contentType });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(storagePath, blobUrl);
    blobLoadPromises.delete(storagePath);
    return blobUrl;
  })().catch((error) => {
    blobLoadPromises.delete(storagePath);
    throw error;
  });

  blobLoadPromises.set(storagePath, promise);
  return promise;
};

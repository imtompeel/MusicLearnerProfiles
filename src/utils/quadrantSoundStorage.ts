import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import type { CellId } from './soundGrid';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isAllowedAudioFile = (file: File): boolean =>
  file.type.startsWith('audio/') || AUDIO_EXTENSION_PATTERN.test(file.name);

export const resolveAudioContentType = (file: File): string => {
  if (file.type.startsWith('audio/')) return file.type;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
};

export const validateQuadrantAudioFile = (file: File): string | null => {
  if (!isAllowedAudioFile(file)) {
    return 'Please choose an audio file (MP3, WAV, OGG, M4A, etc.)';
  }

  if (file.size === 0) {
    return 'That file appears to be empty';
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return `Audio file is ${formatFileSize(file.size)} — maximum size is ${formatFileSize(MAX_AUDIO_BYTES)}`;
  }

  return null;
};

const fileExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (/^[a-z0-9]+$/.test(fromName)) return fromName;

  const contentType = resolveAudioContentType(file);
  const fromType = contentType.split('/')[1]?.toLowerCase() ?? '';
  if (/^[a-z0-9+.-]+$/.test(fromType)) {
    return fromType.replace('mpeg', 'mp3').replace('mp4', 'm4a');
  }

  return 'mp3';
};

export const uploadQuadrantSound = async (
  userId: string,
  quadrantId: CellId,
  file: File
): Promise<{ url: string; storagePath: string }> => {
  const validationError = validateQuadrantAudioFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const contentType = resolveAudioContentType(file);
  const storagePath = `colour_tracker_sounds/${userId}/${quadrantId}/${Date.now()}.${fileExtension(file)}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType });
  const url = await getDownloadURL(storageRef);

  return { url, storagePath };
};

export const deleteQuadrantSound = async (storagePath: string): Promise<void> => {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn('Failed to delete quadrant sound from storage', error);
  }
};

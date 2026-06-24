import type { SlotAnimation } from '../data/controllerAnimations';
import type { ImageSource } from './images';

export const CONTROLLER_SESSIONS_STORAGE_KEY = 'controller_image_sessions_v1';

/** Small JPEG posters only — full-size PNG posters are stripped. */
const MAX_PERSISTED_POSTER_CHARS = 80_000;

export type SavedControllerSlot = {
  id: string;
  label: string;
  searchTerm: string;
  deviceId: string;
  deviceName?: string;
  midiChannel: number | null;
  uploadedImageUrl?: string;
  uploadedImageStoragePath?: string;
  uploadedImageIsGif?: boolean;
  uploadedGifPosterUrl?: string;
  uploadedGifLoopDurationMs?: number;
  animation: SlotAnimation;
  image?: ImageSource;
};

export type SavedControllerSession = {
  id: string;
  name: string;
  createdAt: string;
  slots: SavedControllerSlot[];
};

/** Remove bulky fields before writing to localStorage. */
export const compactSlotForStorage = (slot: SavedControllerSlot): SavedControllerSlot => {
  const { uploadedGifPosterUrl, image, ...rest } = slot;

  const compactPoster =
    uploadedGifPosterUrl && uploadedGifPosterUrl.length <= MAX_PERSISTED_POSTER_CHARS
      ? uploadedGifPosterUrl
      : undefined;

  const compactImage =
    image?.url && !image.url.startsWith('data:')
      ? image
      : undefined;

  return {
    ...rest,
    uploadedGifPosterUrl: compactPoster,
    image: compactImage
  };
};

export const compactSessionsForStorage = (
  sessions: SavedControllerSession[]
): SavedControllerSession[] =>
  sessions.map((session) => ({
    ...session,
    slots: session.slots.map(compactSlotForStorage)
  }));

export const loadSavedControllerSessions = (): SavedControllerSession[] => {
  try {
    const raw = localStorage.getItem(CONTROLLER_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedControllerSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistControllerSessions = (sessions: SavedControllerSession[]): void => {
  const compact = compactSessionsForStorage(sessions);
  const payload = JSON.stringify(compact);

  try {
    localStorage.setItem(CONTROLLER_SESSIONS_STORAGE_KEY, payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem(CONTROLLER_SESSIONS_STORAGE_KEY);
        localStorage.setItem(CONTROLLER_SESSIONS_STORAGE_KEY, payload);
        return;
      } catch {
        throw new Error(
          'Session could not be saved — browser storage is full. Delete old saved sessions and try again.'
        );
      }
    }

    console.error('Failed to save controller sessions', error);
    throw error;
  }
};

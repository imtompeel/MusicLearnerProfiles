export const AUTO_SCROLL_DRAFT_KEY = 'autoScrollSessionDraft';
export const AUTO_SCROLL_SAVED_KEY = 'autoScrollSavedTexts_v1';

export type SavedAutoScrollText = {
  id: string;
  name: string;
  text: string;
  fontSize: number;
  speed: number;
  createdAt: string;
  updatedAt: string;
};

export type AutoScrollDraft = {
  text: string;
  fontSize: number;
  speed: number;
  blinkPauseEnabled?: boolean;
  /** @deprecated Use blinkPauseEnabled */
  eyeGazeEnabled?: boolean;
};

export const loadAutoScrollDraft = (): AutoScrollDraft | null => {
  try {
    const raw = localStorage.getItem(AUTO_SCROLL_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoScrollDraft;
  } catch {
    return null;
  }
};

export const persistAutoScrollDraft = (draft: AutoScrollDraft): void => {
  localStorage.setItem(AUTO_SCROLL_DRAFT_KEY, JSON.stringify(draft));
};

export const loadSavedAutoScrollTexts = (): SavedAutoScrollText[] => {
  try {
    const raw = localStorage.getItem(AUTO_SCROLL_SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAutoScrollText[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const persistSavedAutoScrollTexts = (texts: SavedAutoScrollText[]): void => {
  try {
    localStorage.setItem(AUTO_SCROLL_SAVED_KEY, JSON.stringify(texts));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error(
        'Could not save text — browser storage is full. Delete old saved texts and try again.',
      );
    }
    throw error;
  }
};

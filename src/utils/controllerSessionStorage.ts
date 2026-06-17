import type { SlotAnimation } from '../data/controllerAnimations';
import type { ImageSource } from './images';

export const CONTROLLER_SESSIONS_STORAGE_KEY = 'controller_image_sessions_v1';

export type SavedControllerSlot = {
  id: string;
  label: string;
  searchTerm: string;
  deviceId: string;
  deviceName?: string;
  midiChannel: number | null;
  uploadedImageUrl?: string;
  uploadedImageStoragePath?: string;
  animation: SlotAnimation;
  image?: ImageSource;
};

export type SavedControllerSession = {
  id: string;
  name: string;
  createdAt: string;
  slots: SavedControllerSlot[];
};

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
  try {
    localStorage.setItem(CONTROLLER_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save controller sessions', error);
    throw error;
  }
};

import { useState, useCallback } from 'react';
import { freesoundService, type FreesoundResult } from '../utils/freesound';

interface UseFreesoundReturn {
  isLoading: boolean;
  error: string | null;
  playSound: (sound: FreesoundResult) => Promise<HTMLAudioElement>;
  getSoundsByTerms: (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number) => Promise<FreesoundResult[]>;
  getOneSoundPerTerm: (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number) => Promise<FreesoundResult[]>;
}

export const useFreesound = (): UseFreesoundReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playSound = useCallback(async (sound: FreesoundResult): Promise<HTMLAudioElement> => {
    try {
      return await freesoundService.playSound(sound);
    } catch (err) {
      console.error('Failed to play sound:', err);
      throw err;
    }
  }, []);

  const getSoundsByTerms = useCallback(async (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number): Promise<FreesoundResult[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const sounds = await freesoundService.getSoundsByTerms(searchTerms, category, antiTerms, maxDuration, minDuration);
      return sounds;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sounds';
      setError(errorMessage);
      console.error('Failed to get sounds by terms:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getOneSoundPerTerm = useCallback(async (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number): Promise<FreesoundResult[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const sounds = await freesoundService.getOneSoundPerTerm(searchTerms, category, antiTerms, maxDuration, minDuration);
      return sounds;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sounds';
      setError(errorMessage);
      console.error('Failed to get one sound per term:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    playSound,
    getSoundsByTerms,
    getOneSoundPerTerm
  };
};

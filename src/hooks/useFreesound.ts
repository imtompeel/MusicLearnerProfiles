import { useState, useCallback } from 'react';
import { freesoundService, type FreesoundResult } from '../utils/freesound';

interface UseFreesoundReturn {
  isLoading: boolean;
  error: string | null;
  playSound: (sound: FreesoundResult, options?: { fadeInMs?: number }) => Promise<HTMLAudioElement>;
  getSoundsByTerms: (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number) => Promise<FreesoundResult[]>;
  getOneSoundPerTerm: (searchTerms: string[], category?: string, antiTerms?: string[], maxDuration?: number, minDuration?: number) => Promise<FreesoundResult[]>;
  searchSoundsStrict: (query: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    category?: string;
    limit?: number;
    maxDuration?: number;
    minDuration?: number;
    antiTerms?: string[];
    categoryFilter?: string;
    subcategoryFilter?: string;
  }) => Promise<FreesoundResult[]>;
  getBestSoundForLabel: (label: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    maxDuration?: number;
    minDuration?: number;
  }) => Promise<FreesoundResult | null>;
}

export const useFreesound = (): UseFreesoundReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playSound = useCallback(async (sound: FreesoundResult, options?: { fadeInMs?: number }): Promise<HTMLAudioElement> => {
    try {
      return await freesoundService.playSound(sound, options);
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

  const searchSoundsStrict = useCallback(async (query: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    category?: string;
    limit?: number;
    maxDuration?: number;
    minDuration?: number;
    antiTerms?: string[];
    categoryFilter?: string;
    subcategoryFilter?: string;
  }): Promise<FreesoundResult[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const sounds = await freesoundService.searchSoundsStrict(query, options);
      return sounds;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sounds';
      setError(errorMessage);
      console.error('Failed to search sounds strictly:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getBestSoundForLabel = useCallback(async (label: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    maxDuration?: number;
    minDuration?: number;
  }): Promise<FreesoundResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await freesoundService.getBestSoundForLabel(label, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sound';
      setError(errorMessage);
      console.error('Failed to get best sound for label:', err);
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
    getOneSoundPerTerm,
    searchSoundsStrict,
    getBestSoundForLabel
  };
};

import { useState, useCallback } from 'react';
import type { SpotifyArtist, SpotifyTrack, SpotifySong } from '../types';
import { searchSpotifyArtists, searchSpotifySongs, getArtistTopTracks } from '../utils/spotify';

export function useSpotify() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchArtists = useCallback(async (query: string): Promise<SpotifyArtist[]> => {
    if (!query || query.length < 2) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await searchSpotifyArtists(query);
      return results;
    } catch (err) {
      setError('Failed to search artists');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchSongs = useCallback(async (query: string): Promise<SpotifySong[]> => {
    if (!query || query.length < 2) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await searchSpotifySongs(query);
      return results;
    } catch (err) {
      setError('Failed to search songs');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTracks = useCallback(async (artistId: string): Promise<SpotifyTrack[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await getArtistTopTracks(artistId);
      return results;
    } catch (err) {
      setError('Failed to get tracks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    searchArtists,
    searchSongs,
    getTracks,
    isLoading,
    error
  };
}

import type { SpotifyArtist, SpotifyTrack, SpotifySong } from '../types';

// Spotify API configuration
const SPOTIFY_CLIENT_ID = '969ff828e88041eca47d6455c866b1de';
const SPOTIFY_CLIENT_SECRET = 'e7558067884840b096031522d3d947c0';

let spotifyAccessToken: string | null = null;

// Get Spotify access token
export async function getSpotifyToken(): Promise<string | null> {
  if (spotifyAccessToken) return spotifyAccessToken;
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
      },
      body: 'grant_type=client_credentials'
    });
    
    const data = await response.json();
    spotifyAccessToken = data.access_token;
    return spotifyAccessToken;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
    return null;
  }
}

// Search for artists
export async function searchSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const token = await getSpotifyToken();
    if (!token) return [];
    
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return data.artists.items.map((artist: any) => ({
      id: artist.id,
      name: artist.name,
      image: artist.images[0]?.url || '',
      popularity: artist.popularity,
      genres: artist.genres.slice(0, 3)
    }));
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return [];
  }
}

// Get artist's top tracks
export async function getArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
  try {
    const token = await getSpotifyToken();
    if (!token) return [];
    
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=GB`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return data.tracks.map((track: any) => ({
      id: track.id,
      name: track.name,
      preview_url: track.preview_url,
      album: track.album.name,
      album_image: track.album.images[0]?.url || '',
      duration: track.duration_ms
    }));
  } catch (error) {
    console.error('Error getting top tracks:', error);
    return [];
  }
}

// Search for songs
export async function searchSpotifySongs(query: string): Promise<SpotifySong[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const token = await getSpotifyToken();
    if (!token) return [];
    
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    return data.tracks.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0]?.name || 'Unknown Artist',
      album: track.album.name,
      album_image: track.album.images[0]?.url || '',
      preview_url: track.preview_url,
      duration: track.duration_ms
    }));
  } catch (error) {
    console.error('Error searching Spotify songs:', error);
    return [];
  }
}

// Format duration from milliseconds to MM:SS
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

import React, { useState } from 'react';
import type { MusicQuestion, SpotifyArtist, SpotifyTrack, SpotifySong } from '../../types';
import { useSpotify } from '../../hooks/useSpotify';
import { playNote, noteToFrequency } from '../../utils/audio';

interface SearchQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
  onNextQuestion: () => void;
}

export const SearchQuestion: React.FC<SearchQuestionProps> = ({
  question,
  preferences,
  onSelectPreference,
  onNextQuestion
}) => {
  const [artistResults, setArtistResults] = useState<SpotifyArtist[]>([]);
  const [songResults, setSongResults] = useState<SpotifySong[]>([]);
  const [trackResults, setTrackResults] = useState<SpotifyTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<SpotifyArtist | null>(null);
  const [showTrackSelection, setShowTrackSelection] = useState(false);
  
  const { searchArtists, searchSongs, getTracks, isLoading } = useSpotify();

  const isArtistSearch = question.question_text.toLowerCase().includes('musician') || 
                        question.question_text.toLowerCase().includes('artist');
  const isSongSearch = question.question_text.toLowerCase().includes('song');

  const handleSearchArtists = async (query: string) => {
    if (query.length < 2) {
      setArtistResults([]);
      return;
    }
    
    const results = await searchArtists(query);
    setArtistResults(results);
  };

  const handleSearchSongs = async (query: string) => {
    if (query.length < 2) {
      setSongResults([]);
      return;
    }
    
    const results = await searchSongs(query);
    setSongResults(results);
  };

  const handleSelectArtist = async (artist: SpotifyArtist) => {
    setSelectedArtist(artist);
    setShowTrackSelection(true);
    
    const tracks = await getTracks(artist.id);
    setTrackResults(tracks);
    
    onSelectPreference(question.question_number, {
      artist_id: artist.id,
      artist_name: artist.name
    });
    
    playNote(noteToFrequency('C5'), 0.3);
  };

  const handleSelectTrack = (track: SpotifyTrack) => {
    onSelectPreference(question.question_number, {
      ...(preferences[question.question_number] || {}),
      track_id: track.id,
      track_name: track.name,
      preview_url: track.preview_url
    });
    
    setShowTrackSelection(false);
    playNote(noteToFrequency('C5'), 0.3);
    
    // Auto-advance to next question
    setTimeout(() => {
      onNextQuestion();
    }, 1500);
  };

  const handleSelectSong = (song: SpotifySong) => {
    onSelectPreference(question.question_number, {
      song_id: song.id,
      song_name: song.name,
      artist_name: song.artist
    });
    
    playNote(noteToFrequency('C5'), 0.3);
    
    // Auto-advance to next question
    setTimeout(() => {
      onNextQuestion();
    }, 1500);
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isArtistSearch) {
    return (
      <>
        <div className="preference-question">
          <h3>{question.question_text}</h3>
        </div>
        <div className="artist-search-container">
          <div className="search-layout">
            <div className="search-input-wrapper">
              <input 
                type="text" 
                className="search-input"
                placeholder="Type to search for an artist..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearchArtists(e.target.value);
                }}
              />
            </div>
            
            <div className="search-results-wrapper">
              {selectedArtist && !showTrackSelection && (
                <div className="selected-artist">
                  <h4>Selected Artist:</h4>
                  <div className="selected-artist-card">
                    <div className="artist-image">
                      {selectedArtist.image ? (
                        <img src={selectedArtist.image} alt={selectedArtist.name} />
                      ) : (
                        <div className="no-image">🎤</div>
                      )}
                    </div>
                    <div className="artist-info">
                      <div className="artist-name">{selectedArtist.name}</div>
                      <div className="artist-genres">{selectedArtist.genres.join(', ')}</div>
                      <div className="artist-popularity">⭐ {selectedArtist.popularity}/100</div>
                    </div>
                    <button 
                      className="btn-change-artist"
                      onClick={() => {
                        setSelectedArtist(null);
                        setShowTrackSelection(false);
                        setTrackResults([]);
                      }}
                    >
                      Change Artist
                    </button>
                  </div>
                </div>
              )}
              
              {!selectedArtist && (
                <div className="artist-results">
                  {isLoading && <p>Searching...</p>}
                  {artistResults.map(artist => (
                    <div 
                      key={artist.id} 
                      className="artist-result"
                      onClick={() => handleSelectArtist(artist)}
                    >
                      <div className="artist-image">
                        {artist.image ? (
                          <img src={artist.image} alt={artist.name} />
                        ) : (
                          <div className="no-image">🎤</div>
                        )}
                      </div>
                      <div className="artist-info">
                        <div className="artist-name">{artist.name}</div>
                        <div className="artist-genres">{artist.genres.join(', ')}</div>
                        <div className="artist-popularity">⭐ {artist.popularity}/100</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {showTrackSelection && selectedArtist && (
                <div className="track-selection">
                  <h4>Select your favorite track by {selectedArtist.name}:</h4>
                  <div className="track-list">
                    {trackResults.map(track => (
                      <div 
                        key={track.id} 
                        className="track-item"
                        onClick={() => handleSelectTrack(track)}
                      >
                        <div className="track-image">
                          {track.album_image ? (
                            <img src={track.album_image} alt={track.album} />
                          ) : (
                            <div className="no-image">💿</div>
                          )}
                        </div>
                        <div className="track-info">
                          <div className="track-name">{track.name}</div>
                          <div className="track-album">{track.album}</div>
                          <div className="track-duration">{formatDuration(track.duration)}</div>
                        </div>
                        <div className="track-preview">
                          {track.preview_url ? (
                            <button 
                              className="btn-preview"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Play preview logic here
                              }}
                            >
                              ▶️
                            </button>
                          ) : (
                            <span className="no-preview">No preview</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  } else if (isSongSearch) {
    return (
      <>
        <div className="preference-question">
          <h3>{question.question_text}</h3>
        </div>
        <div className="artist-search-container">
          <div className="search-layout">
            <div className="search-input-wrapper">
              <input 
                type="text" 
                className="search-input"
                placeholder="Type to search for a song..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearchSongs(e.target.value);
                }}
              />
            </div>
            
            <div className="search-results-wrapper">
              <div className="artist-results">
                {isLoading && <p>Searching...</p>}
                {songResults.map(song => (
                  <div 
                    key={song.id} 
                    className="artist-result"
                    onClick={() => handleSelectSong(song)}
                  >
                    <div className="artist-image">
                      {song.album_image ? (
                        <img src={song.album_image} alt={song.album} />
                      ) : (
                        <div className="no-image">💿</div>
                      )}
                    </div>
                    <div className="artist-info">
                      <div className="artist-name">{song.name}</div>
                      <div className="artist-genres">{song.artist}</div>
                      <div className="artist-popularity">{song.album}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
};

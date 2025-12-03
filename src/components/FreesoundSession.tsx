import React, { useState, useEffect, useCallback } from 'react';
import { useFreesound } from '../hooks/useFreesound';
import { useStatus } from '../hooks/useStatus';
import type { FreesoundResult } from '../utils/freesound';

interface FreesoundSessionProps {
  onBack: () => void;
}

export const FreesoundSession: React.FC<FreesoundSessionProps> = ({ onBack }) => {
  const { isLoading, error, playSound, getSoundsByTerms } = useFreesound();
  const { showSuccess, showError } = useStatus();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [soundLibrary, setSoundLibrary] = useState<FreesoundResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [midiNote, setMidiNote] = useState<number | null>(null);
  const [isMidiEnabled, setIsMidiEnabled] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [lastPlayedIndex, setLastPlayedIndex] = useState<number | null>(null);
  const [allFoundSounds, setAllFoundSounds] = useState<FreesoundResult[]>([]);
  const [usedSoundIds, setUsedSoundIds] = useState<Set<number>>(new Set());
  const [isStudentUI, setIsStudentUI] = useState(false);

  // MIDI support
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess()
        .then((access) => {
          console.log('MIDI access granted');
          access.onstatechange = (e) => {
            console.log('MIDI device state changed:', e.port?.name, e.port?.state);
          };
          
          // Listen for MIDI messages
          access.inputs.forEach((input) => {
            input.onmidimessage = handleMidiMessage;
          });
          
          setIsMidiEnabled(true);
        })
        .catch((err) => {
          console.error('MIDI access denied:', err);
          setIsMidiEnabled(false);
        });
    } else {
      console.log('MIDI not supported in this browser');
      setIsMidiEnabled(false);
    }
  }, []);

  const handleMidiMessage = useCallback((event: any) => {
    const [command, note, velocity] = event.data;
    
    // Check if it's a note on message (command 144 = 0x90)
    if (command === 144 && velocity > 0) {
      console.log(`MIDI note received: ${note}, velocity: ${velocity}`);
      setMidiNote(note);
      
      // Trigger random sound if we have sounds loaded
      if (soundLibrary.length > 0) {
        triggerRandomSound();
      }
    }
  }, [soundLibrary]);

  const triggerRandomSound = useCallback(async () => {
    if (soundLibrary.length === 0) return;
    
    let randomIndex;
    
    // If we have more than 1 sound, avoid playing the same sound twice in a row
    if (soundLibrary.length > 1 && lastPlayedIndex !== null) {
      do {
        randomIndex = Math.floor(Math.random() * soundLibrary.length);
      } while (randomIndex === lastPlayedIndex);
    } else {
      randomIndex = Math.floor(Math.random() * soundLibrary.length);
    }
    
    const selectedSound = soundLibrary[randomIndex];
    setLastPlayedIndex(randomIndex);
    
    console.log(`🎲 Random sound selected: ${selectedSound.name} (index: ${randomIndex})`);
    
    try {
      setCurrentlyPlaying(selectedSound.name);
      await playSound(selectedSound);
      showSuccess(`🎵 Playing: ${selectedSound.name}`);
    } catch (err) {
      console.error('Failed to play sound:', err);
      showError('Failed to play sound');
    } finally {
      setCurrentlyPlaying(null);
    }
  }, [soundLibrary, playSound, showSuccess, showError, lastPlayedIndex]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      showError('Please enter a search term');
      return;
    }

    setIsSearching(true);
    try {
      // Use a single comprehensive search query instead of multiple variations
      // This reduces API calls from 5 to 1-2 while still getting diverse results
      const comprehensiveQuery = `${searchTerm} sound effect noise call`;
      
      console.log(`Searching with comprehensive query: "${comprehensiveQuery}"`);
      
      // Search for sounds using a single comprehensive query with higher limit
      const sounds = await getSoundsByTerms([comprehensiveQuery], undefined, undefined, 5);
      
      // If we don't get enough results, try a fallback with just the original term
      let allSounds = sounds;
      if (sounds.length < 15) {
        console.log(`Only found ${sounds.length} results, trying fallback search...`);
        const fallbackSounds = await getSoundsByTerms([searchTerm], undefined, undefined, 5);
        allSounds = [...sounds, ...fallbackSounds];
      }
      
      // Remove duplicates based on sound ID and filter for shorter sounds
      const uniqueSounds = allSounds
        .filter((sound, index, self) => 
          index === self.findIndex(s => s.id === sound.id)
        )
        .filter(sound => sound.duration <= 10);
      
      // Store all found sounds for later use
      setAllFoundSounds(uniqueSounds);
      
      // Shuffle the array to get more variety instead of just taking the first 10
      const shuffledSounds = uniqueSounds.sort(() => Math.random() - 0.5);
      const finalSounds = shuffledSounds.slice(0, 10);
      
      // Track which sounds we've used
      const newUsedIds = new Set(finalSounds.map(s => s.id));
      setUsedSoundIds(newUsedIds);
      
      console.log(`Found ${uniqueSounds.length} unique sounds total`);
      console.log(`Selected 10 diverse sounds:`, finalSounds.map(s => s.name));
      
      if (finalSounds.length === 0) {
        showError('No short sounds found for this search term');
        return;
      }
      
      setSoundLibrary(finalSounds);
      showSuccess(`Loaded ${finalSounds.length} diverse sounds for "${searchTerm}"`);
    } catch (err) {
      console.error('Search failed:', err);
      showError('Failed to search for sounds');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePlaySound = async (sound: FreesoundResult) => {
    try {
      setCurrentlyPlaying(sound.name);
      await playSound(sound);
      showSuccess(`Playing: ${sound.name}`);
    } catch (err) {
      console.error('Failed to play sound:', err);
      showError('Failed to play sound');
    } finally {
      setCurrentlyPlaying(null);
    }
  };

  const handleTestMidi = () => {
    // Simulate MIDI C5 (note 72) with velocity 100
    console.log('🎹 Testing MIDI C5 (note 72) - triggering random sound');
    setMidiNote(72);
    
    // Trigger random sound if we have sounds loaded
    if (soundLibrary.length > 0) {
      triggerRandomSound();
    } else {
      showError('No sounds loaded. Please search for sounds first.');
    }
  };

  const handleDismissSound = (soundId: number) => {
    // Remove the sound from the current library
    const updatedLibrary = soundLibrary.filter(sound => sound.id !== soundId);
    
    // Add to used sounds so we don't bring it back
    const newUsedIds = new Set(usedSoundIds);
    newUsedIds.add(soundId);
    setUsedSoundIds(newUsedIds);
    
    // Find a replacement sound from the unused pool
    const availableSounds = allFoundSounds.filter(sound => !newUsedIds.has(sound.id));
    
    if (availableSounds.length > 0) {
      // Pick a random replacement
      const randomIndex = Math.floor(Math.random() * availableSounds.length);
      const replacementSound = availableSounds[randomIndex];
      
      // Add the replacement to the library
      const newLibrary = [...updatedLibrary, replacementSound];
      setSoundLibrary(newLibrary);
      
      // Update used sounds
      newUsedIds.add(replacementSound.id);
      setUsedSoundIds(newUsedIds);
      
      showSuccess(`Replaced dismissed sound with: ${replacementSound.name}`);
      console.log(`🔄 Replaced dismissed sound with: ${replacementSound.name}`);
    } else {
      // No more sounds available
      setSoundLibrary(updatedLibrary);
      showError('No more sounds available to replace the dismissed one');
      console.log('❌ No more sounds available for replacement');
    }
  };

  return (
    <div className="freesound-session">
      <div className="session-header">
        {!isStudentUI && (
          <button className="btn-back" onClick={onBack}>
            ← Back to Sessions
          </button>
        )}
        <h2>🎵 Freesound Session</h2>
        {!isStudentUI && <p>Search for sounds and trigger them with MIDI notes or manually</p>}
        <div className="student-ui-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isStudentUI}
              onChange={(e) => setIsStudentUI(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">Student UI</span>
          </label>
        </div>
      </div>

      {isStudentUI ? (
        // Student UI: Simple array of play buttons
        <div className="student-sound-library">
          {soundLibrary.length > 0 ? (
            <div className="student-sound-grid">
              {soundLibrary.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => handlePlaySound(sound)}
                  disabled={currentlyPlaying === sound.name}
                  className={`student-play-btn ${currentlyPlaying === sound.name ? 'playing' : ''}`}
                >
                  {currentlyPlaying === sound.name ? '🔊' : '▶️'}
                </button>
              ))}
            </div>
          ) : (
            <div className="student-empty-state">
              <p>No sounds loaded. Please switch to full UI to search for sounds.</p>
            </div>
          )}
        </div>
      ) : (
        // Full UI: All features
        <>
          <div className="search-section">
            <div className="search-input-group">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter search term (e.g., 'dog', 'rain', 'bell')"
                className="search-input"
                disabled={isSearching}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                className="btn-search"
              >
                {isSearching ? '🔍 Searching...' : '🔍 Search'}
              </button>
            </div>
          </div>

          <div className="midi-section">
            <h3>🎹 MIDI Control</h3>
            <div className="midi-status">
              <span className={`midi-indicator ${isMidiEnabled ? 'connected' : 'disconnected'}`}>
                {isMidiEnabled ? '🟢 MIDI Connected' : '🔴 MIDI Not Available'}
              </span>
              {midiNote !== null && (
                <span className="midi-note">Last MIDI Note: {midiNote}</span>
              )}
              {currentlyPlaying && (
                <span className="currently-playing">🔊 Now Playing: {currentlyPlaying}</span>
              )}
            </div>
            <p className="midi-instructions">
              Connect a MIDI device (like An Odd Ball) and play any note to trigger a random sound from your loaded library.
            </p>
            <button
              onClick={handleTestMidi}
              disabled={soundLibrary.length === 0}
              className="btn-test-midi"
            >
              🎹 Test MIDI C5
            </button>
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          {soundLibrary.length > 0 && (
            <div className="sound-library">
              <h3>🎵 Sound Library ({soundLibrary.length} sounds)</h3>
              <div className="sound-grid">
                {soundLibrary.map((sound) => (
                  <div key={sound.id} className="sound-item">
                    <div className="sound-info">
                      <h4>{sound.name}</h4>
                      <p className="sound-duration">{sound.duration.toFixed(1)}s</p>
                      <p className="sound-tags">{sound.tags.slice(0, 3).join(', ')}</p>
                    </div>
                    <div className="sound-actions">
                      <button
                        onClick={() => handlePlaySound(sound)}
                        disabled={currentlyPlaying === sound.name}
                        className={`btn-play ${currentlyPlaying === sound.name ? 'playing' : ''}`}
                      >
                        {currentlyPlaying === sound.name ? '🔊 Playing...' : '▶️ Play'}
                      </button>
                      <button
                        onClick={() => handleDismissSound(sound.id)}
                        className="btn-dismiss"
                        title="Dismiss this sound and load a replacement"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="library-actions">
                <button
                  onClick={triggerRandomSound}
                  disabled={currentlyPlaying !== null}
                  className="btn-random"
                >
                  🎲 Play Random Sound
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Loading sounds...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

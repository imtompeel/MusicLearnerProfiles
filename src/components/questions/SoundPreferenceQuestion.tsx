import React, { useState, useEffect } from 'react';
import type { MusicQuestion } from '../../types';
import type { FreesoundResult } from '../../utils/freesound';
import { useFreesound } from '../../hooks/useFreesound';
import { playNote, noteToFrequency } from '../../utils/audio';

interface SoundPreferenceQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
}

export const SoundPreferenceQuestion: React.FC<SoundPreferenceQuestionProps> = ({
  question,
  preferences,
  onSelectPreference
}) => {
  const [playingSounds, setPlayingSounds] = useState<{ [key: number]: HTMLAudioElement }>({});
  const [dynamicSounds, setDynamicSounds] = useState<FreesoundResult[]>([]);
  const { playSound, getOneSoundPerTerm, isLoading: soundsLoading } = useFreesound();

  // Load dynamic sounds for freesound questions
  useEffect(() => {
    if (question.question_type === 'freesound' && question.search_terms) {
      const loadDynamicSounds = async () => {
        try {
          // Use duration values from question data, with defaults
          const minDuration = question.min_duration || 1.5;
          const maxDuration = question.max_duration || 10;
          const sounds = await getOneSoundPerTerm(question.search_terms!, undefined, question.anti_terms, maxDuration, minDuration);
          setDynamicSounds(sounds);
        } catch (error) {
          console.error('Failed to load dynamic sounds:', error);
          setDynamicSounds([]);
        }
      };
      loadDynamicSounds();
    } else {
      setDynamicSounds([]);
    }
  }, [question, getOneSoundPerTerm]);

  const handleFreesoundCardClick = async (sound: FreesoundResult) => {
    const soundId = sound.id;
    const currentAudio = playingSounds[soundId];
    
    if (currentAudio) {
      // If this specific audio is playing, pause it
      currentAudio.pause();
      setPlayingSounds(prev => {
        const newState = { ...prev };
        delete newState[soundId];
        return newState;
      });
    } else {
      // Pause all other currently playing sounds first
      Object.values(playingSounds).forEach(audio => {
        if (audio && !audio.paused) {
          audio.pause();
        }
      });
      
      // Clear all playing sounds
      setPlayingSounds({});
      
      // Start playing the new sound
      try {
        const audioElement = await playSound(sound);
        setPlayingSounds(prev => ({
          ...prev,
          [soundId]: audioElement
        }));
        
        // Clean up when audio ends
        audioElement.onended = () => {
          setPlayingSounds(prev => {
            const newState = { ...prev };
            delete newState[soundId];
            return newState;
          });
        };
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
  };

  const handleFreesoundLikeDislike = async (sound: FreesoundResult, preference: 'like' | 'dislike') => {
    const currentPrefs = preferences[question.question_number] || [];
    const soundPrefs = Array.isArray(currentPrefs) ? currentPrefs : [];
    
    // Remove any existing preference for this sound
    const filteredPrefs = soundPrefs.filter((p: any) => p.sound_id !== sound.id);
    
    // Add the new preference
    const newPreference = {
      sound_id: sound.id,
      sound_name: sound.name,
      sound_url: sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'],
      sound_description: sound.description,
      sound_tags: sound.tags,
      username: sound.username,
      preference: preference
    };
    
    onSelectPreference(question.question_number, [...filteredPrefs, newPreference]);
    
    // Play a confirmation sound
    playNote(noteToFrequency(preference === 'like' ? 'C5' : 'B4'), 0.3);
  };

  // Use dynamic sounds loaded from search terms
  const sounds = dynamicSounds;
  const soundTitles = question.search_terms || [];
  
  return (
    <>
      <div className="preference-question">
        <h3>{question.question_text}</h3>
        <p>Listen to each sound and tell us what you think:</p>
      </div>
      <div className="preference-options">
        {soundsLoading ? (
          <div className="loading-sounds">Loading sounds...</div>
        ) : sounds.length > 0 ? (
          sounds.slice(0, 4).map((sound, index) => {
            const currentPrefs = preferences[question.question_number] || [];
            const soundPrefs = Array.isArray(currentPrefs) ? currentPrefs : [];
            const userPreference = soundPrefs.find((p: any) => p.sound_id === sound.id) as any;
            
            // Use the predefined title or fallback to a cleaned version of the sound name
            const displayTitle = soundTitles[index] || sound.name.replace(/\.(wav|mp3|flac)$/i, '').replace(/_/g, ' ');
            
            const isPlaying = playingSounds[sound.id];
            
            return (
              <div 
                key={sound.id}
                className={`preference-card freesound-card ${isPlaying ? 'playing' : ''}`}
                onClick={() => handleFreesoundCardClick(sound)}
              >
                <div className="emoji">
                  {isPlaying ? '⏸️' : '🔊'}
                </div>
                <div className="question">{displayTitle}</div>
                <div className="sound-description">
                  {isPlaying ? 'Click to pause' : 'Click to play'}
                </div>
                <div className="sound-attribution">by {sound.username}</div>
                
                <div className="preference-buttons">
                  <button 
                    className={`btn-thumbs ${userPreference?.preference === 'like' ? 'selected like' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFreesoundLikeDislike(sound, 'like');
                    }}
                  >
                    👍
                  </button>
                  <button 
                    className={`btn-thumbs ${userPreference?.preference === 'dislike' ? 'selected dislike' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFreesoundLikeDislike(sound, 'dislike');
                    }}
                  >
                    👎
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-sounds">No sounds available. Please try again later.</div>
        )}
      </div>
    </>
  );
};

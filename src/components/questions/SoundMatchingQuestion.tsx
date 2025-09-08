import React, { useState, useEffect } from 'react';
import type { MusicQuestion } from '../../types';
import { getPatternImageSources } from '../../utils/images';
import { playNote, noteToFrequency } from '../../utils/audio';
import { useFreesound } from '../../hooks/useFreesound';
import type { FreesoundResult } from '../../utils/freesound';

interface SoundMatchingQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
}

interface MatchingState {
  selectedSound: string | null;
  selectedImage: string | null;
  matchedPairs: string[];
  incorrectAttempts: string[];
}

interface SoundCard {
  sound: FreesoundResult;
  position: number; // 1, 2, 3, 4
}

interface ImageCard {
  image: string;
  label: string;
  correctSoundId: string; // The sound ID that should match this image
}

export const SoundMatchingQuestion: React.FC<SoundMatchingQuestionProps> = ({
  question,
  onSelectPreference
}) => {
  const [matchingState, setMatchingState] = useState<MatchingState>({
    selectedSound: null,
    selectedImage: null,
    matchedPairs: [],
    incorrectAttempts: []
  });

  const [playingSounds, setPlayingSounds] = useState<{ [key: number]: HTMLAudioElement }>({});
  const [soundCards, setSoundCards] = useState<SoundCard[]>([]);
  const [imageCards, setImageCards] = useState<ImageCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imageSources, setImageSources] = useState<{ [key: string]: any }>({});

  const { getOneSoundPerTerm, playSound, isLoading: soundsLoading } = useFreesound();

  // Load sounds from Freesound and images from Unsplash
  useEffect(() => {
    const loadMatchingData = async () => {
      if (!question.pattern_images || !question.pattern_sounds) return;
      
      setIsLoading(true);
      try {
        // Load images and sounds in parallel
        const [sounds, imageSources] = await Promise.all([
          getOneSoundPerTerm(question.pattern_sounds, undefined, undefined, question.max_duration || 10, question.min_duration || 1.5),
          getPatternImageSources()
        ]);
        
        setImageSources(imageSources);
        
        console.log('🔍 SOUND SEARCH TERMS:', question.pattern_sounds);
        console.log('🔍 IMAGE SEARCH TERMS:', question.pattern_images);
        console.log('🔍 ORIGINAL SOUNDS:', sounds.map(s => ({ id: s.id, name: s.name })));
        
        // Create shuffled sound cards
        const shuffledSounds = [...sounds];
        for (let i = shuffledSounds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledSounds[i], shuffledSounds[j]] = [shuffledSounds[j], shuffledSounds[i]];
        }
        
        const soundCards: SoundCard[] = shuffledSounds.map((sound, index) => ({
          sound,
          position: index + 1
        }));
        
        console.log('🔀 SHUFFLED SOUND CARDS:', soundCards.map(sc => ({
          position: sc.position,
          soundId: sc.sound.id,
          soundName: sc.sound.name
        })));
        
        // Create image cards with their correct sound mappings
        const imageCards: ImageCard[] = question.pattern_images.map((imageKey, index) => ({
          image: imageKey,
          label: question[`option${index + 1}` as keyof MusicQuestion] as string,
          correctSoundId: (sounds[index] || sounds[0]).id.toString()
        }));
        
        console.log('🖼️ IMAGE CARDS:', imageCards.map(ic => ({
          image: ic.image,
          label: ic.label,
          correctSoundId: ic.correctSoundId
        })));
        
        setSoundCards(soundCards);
        setImageCards(imageCards);
      } catch (error) {
        console.error('Failed to load matching data:', error);
        setSoundCards([]);
        setImageCards([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMatchingData();
  }, [question, getOneSoundPerTerm]);

  const handleSoundCardClick = async (sound: FreesoundResult) => {
    const soundId = sound.id;
    const currentAudio = playingSounds[soundId];
    
    console.log('🎵 SOUND CLICKED:', {
      clickedSoundId: soundId,
      clickedSoundName: sound.name
    });
    
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

    // Update selection using the actual clicked sound ID
    setMatchingState(prev => ({
      ...prev,
      selectedSound: soundId.toString(),
      selectedImage: null // Clear any previous image selection
    }));

    playNote(noteToFrequency('C5'), 0.3);
  };

  const handleImageCardClick = (imageKey: string) => {
    const imageCard = imageCards.find(ic => ic.image === imageKey);
    if (!imageCard) return;

    console.log('🖼️ IMAGE CLICKED:', {
      clickedImage: imageKey,
      imageLabel: imageCard.label,
      correctSoundId: imageCard.correctSoundId
    });

    setMatchingState(prev => {
      const newState = { ...prev, selectedImage: imageKey };
      
      console.log('🔍 MATCHING CHECK:', {
        selectedSound: prev.selectedSound,
        imageCorrectSoundId: imageCard.correctSoundId,
        isMatch: prev.selectedSound === imageCard.correctSoundId
      });
      
      // Check if we have both sound and image selected
      if (prev.selectedSound && prev.selectedImage === null) {
        // Check if this is a correct match
        if (prev.selectedSound === imageCard.correctSoundId) {
          // Correct match!
          newState.matchedPairs = [...prev.matchedPairs, imageCard.correctSoundId];
          newState.selectedSound = null!;
          newState.selectedImage = null!;
          
          // Play success sound
          playNote(noteToFrequency('E5'), 0.5);
          
          // Check if all pairs are matched
          if (newState.matchedPairs.length === imageCards.length) {
            // All pairs matched! Save the result
            onSelectPreference(question.question_number, {
              type: 'sound_matching',
              matchedPairs: newState.matchedPairs,
              completed: true
            });
          }
        } else {
          // Incorrect match - flash red
          newState.incorrectAttempts = [...prev.incorrectAttempts, `${prev.selectedSound}-${imageCard.correctSoundId}`];
          newState.selectedSound = null!;
          newState.selectedImage = null!;
          
          // Play error sound
          playNote(noteToFrequency('C4'), 0.3);
          
          // Clear the incorrect attempt after a delay
          setTimeout(() => {
            setMatchingState(current => ({
              ...current,
              incorrectAttempts: current.incorrectAttempts.filter(attempt => 
                attempt !== `${prev.selectedSound}-${imageCard.correctSoundId}`
              )
            }));
          }, 1000);
        }
      } else {
        // Just select the image
        newState.selectedImage = imageKey;
      }
      
      return newState;
    });

    playNote(noteToFrequency('C5'), 0.3);
  };

  const isSoundMatched = (soundId: string) => matchingState.matchedPairs.includes(soundId);
  const isImageMatched = (imageKey: string) => {
    const imageCard = imageCards.find(ic => ic.image === imageKey);
    return imageCard ? matchingState.matchedPairs.includes(imageCard.correctSoundId) : false;
  };

  const isSoundSelected = (soundId: string) => matchingState.selectedSound === soundId;
  const isImageSelected = (imageKey: string) => matchingState.selectedImage === imageKey;

  const isIncorrectAttempt = (soundId: string, imageKey: string) => {
    const imageCard = imageCards.find(ic => ic.image === imageKey);
    const correctSoundId = imageCard?.correctSoundId;
    return matchingState.incorrectAttempts.includes(`${soundId}-${correctSoundId}`) ||
           matchingState.incorrectAttempts.includes(`${correctSoundId}-${soundId}`);
  };

  if (isLoading || soundsLoading) {
    return (
      <>
        <div className="preference-question">
          <h3>{question.question_text}</h3>
          <p>Loading sounds and images...</p>
        </div>
        <div className="loading-sounds">Loading matching pairs...</div>
      </>
    );
  }

  if (soundCards.length === 0 || imageCards.length === 0) {
    return (
      <>
        <div className="preference-question">
          <h3>{question.question_text}</h3>
          <p>No matching pairs available. Please try again later.</p>
        </div>
        <div className="no-sounds">Unable to load sounds for matching.</div>
      </>
    );
  }

  return (
    <>
      <div className="preference-question">
        <h3>{question.question_text}</h3>
        <p>Listen to each sound, then find and tap the matching picture. The sounds are shuffled - you need to figure out which sound matches which picture!</p>
        <div className="matching-progress">
          Matched: {matchingState.matchedPairs.length} / {imageCards.length}
        </div>
      </div>
      
      <div className="sound-matching-container">
        {/* Sound Cards */}
        <div className="sound-cards-section">
          <h4>🔊 Sounds</h4>
          <div className="sound-cards">
            {soundCards.map((soundCard) => (
              <div
                key={`sound-${soundCard.position}`}
                className={`sound-card ${isSoundMatched(soundCard.sound.id.toString()) ? 'matched' : ''} ${isSoundSelected(soundCard.sound.id.toString()) ? 'selected' : ''}`}
                onClick={() => {
                  console.log(`🎵 CLICKING SOUND CARD ${soundCard.position}:`, {
                    position: soundCard.position,
                    soundId: soundCard.sound.id,
                    soundName: soundCard.sound.name
                  });
                  !isSoundMatched(soundCard.sound.id.toString()) && handleSoundCardClick(soundCard.sound);
                }}
              >
                <div className="sound-icon">
                  {isSoundMatched(soundCard.sound.id.toString()) ? '✅' : isSoundSelected(soundCard.sound.id.toString()) ? '🔊' : '👂'}
                </div>
                <div className="sound-label">Sound {soundCard.position}</div>
                {playingSounds[soundCard.sound.id] && <div className="playing-indicator">Playing...</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Image Cards */}
        <div className="image-cards-section">
          <h4>🖼️ Pictures</h4>
          <div className="image-cards">
            {imageCards.map((imageCard) => {
              const imageSource = imageSources[imageCard.image] || { url: '', alt: imageCard.image, fallback: '🖼️' };
              return (
                <div
                  key={`image-${imageCard.image}`}
                  className={`image-card ${isImageMatched(imageCard.image) ? 'matched' : ''} ${isImageSelected(imageCard.image) ? 'selected' : ''} ${isIncorrectAttempt(imageCard.correctSoundId, imageCard.image) ? 'incorrect' : ''}`}
                  onClick={() => !isImageMatched(imageCard.image) && handleImageCardClick(imageCard.image)}
                >
                  <div className="image-container">
                    <img 
                      src={imageSource.url} 
                      alt={imageSource.alt}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = 'block';
                        }
                      }}
                    />
                    <div className="emoji-fallback" style={{ display: 'none' }}>{imageSource.fallback}</div>
                  </div>
                  <div className="image-label">{imageCard.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

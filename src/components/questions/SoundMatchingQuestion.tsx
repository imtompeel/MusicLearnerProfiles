import React, { useState, useEffect } from 'react';
import type { MusicQuestion } from '../../types';
import { getPatternImageSources } from '../../utils/images';
import { playNote, noteToFrequency } from '../../utils/audio';
import { useFreesound } from '../../hooks/useFreesound';
import { getTaxonomyCandidatesForTerm, getAntiTermsForTerm, getIncludeTagsForTerm } from '../../utils/freesoundTaxonomy';
import type { FreesoundResult } from '../../utils/freesound';

interface SoundMatchingQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
  reloadToken?: number; // forces reload when changed
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
  onSelectPreference,
  reloadToken
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

  const { searchSoundsStrict, playSound, isLoading: soundsLoading } = useFreesound();

  // Tags-based intent verification disabled while iterating on taxonomy-only results

  // Tags and include/exclude disabled. We selectively apply taxonomy filters per term.

  // Load sounds from Freesound and images from Unsplash
  useEffect(() => {
    const loadMatchingData = async () => {
      if (!question.pattern_images || !question.pattern_sounds) return;
      
      setIsLoading(true);
      try {
        // Load images and sounds in parallel
        const imageSources = await getPatternImageSources(question.pattern_images, 240, 240);
        // For each term, fetch a strict list and pick the best verified result, with fallbacks
        const sounds: FreesoundResult[] = [];
        for (const term of question.pattern_sounds) {
          let candidates: FreesoundResult[] = [];
          const taxonomyCandidates = getTaxonomyCandidatesForTerm(term);
          const antiTerms = getAntiTermsForTerm(term);
          const isVacuum = /\b(vacuum|vaccum|hoover)\b/i.test(term);
          const includeTags = isVacuum ? ['vacuum','hoover','cleaner'] : getIncludeTagsForTerm(term);
          for (const tax of taxonomyCandidates) {
            const attempt = await searchSoundsStrict(term, {
              maxDuration: question.max_duration || 12,
              minDuration: question.min_duration || 0.2,
              antiTerms,
              ...(includeTags.length ? { includeTags } : {} as any),
              ...(tax.categoryFilter ? { categoryFilter: tax.categoryFilter } : {} as any),
              ...(tax.subcategoryFilter ? { subcategoryFilter: tax.subcategoryFilter } : {} as any)
            });
            if (attempt && attempt.length > 0) {
              candidates = attempt;
              break;
            }
          }

          // Final fallback: no taxonomy
          if (!candidates || candidates.length === 0) {
            candidates = await searchSoundsStrict(term, {
              maxDuration: question.max_duration || 12,
              minDuration: question.min_duration || 0.2,
              antiTerms,
              ...(includeTags.length ? { includeTags } : {} as any)
            });
          }

          const pick = candidates[0];
          if (pick) sounds.push(pick);
        }

        if (!sounds || sounds.length === 0) {
          throw new Error('No sounds found for matching after applying fallbacks.');
        }
        
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
        const imageCards: ImageCard[] = question.pattern_images.map((imageKey, index) => {
          const fallbackSound = sounds[0];
          const targetSound = sounds[index] || fallbackSound;
          if (!targetSound) {
            throw new Error('Unable to assign a sound to image card: no fallback sound available.');
          }
          return {
            image: imageKey,
            label: question[`option${index + 1}` as keyof MusicQuestion] as string,
            correctSoundId: targetSound.id.toString()
          };
        });
        
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
  }, [question, searchSoundsStrict, reloadToken]);

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
        // Detect percussive/attack-heavy by tags/name for no-fade playback
        const name = (sound.name || '').toLowerCase();
        const tags = (sound.tags || []).map(t => t.toLowerCase());
        const isAttackCritical = ['drum','snare','kick','clap','hit','perc','percussion','piano','pluck','tap'].some(k => name.includes(k) || tags.includes(k));
        const fadeInMs = isAttackCritical ? 0 : 400;
        const audioElement = await playSound(sound, { fadeInMs });
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
            // All pairs matched! Save the result (defer to avoid setState during render warning)
            setTimeout(() => {
              onSelectPreference(question.question_number, {
                type: 'sound_matching',
                matchedPairs: newState.matchedPairs,
                completed: true
              });
            }, 0);
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
              const hasImage = Boolean(imageSource.url);
              return (
                <div
                  key={`image-${imageCard.image}`}
                  className={`image-card ${isImageMatched(imageCard.image) ? 'matched' : ''} ${isImageSelected(imageCard.image) ? 'selected' : ''} ${isIncorrectAttempt(imageCard.correctSoundId, imageCard.image) ? 'incorrect' : ''}`}
                  onClick={() => !isImageMatched(imageCard.image) && handleImageCardClick(imageCard.image)}
                >
                  <div className="image-container">
                    {hasImage && (
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
                    )}
                    <div className="emoji-fallback" style={{ display: hasImage ? 'none' : 'block' }}>{imageSource.fallback}</div>
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

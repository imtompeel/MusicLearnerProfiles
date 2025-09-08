import React, { useState, useEffect } from 'react';
import { notes, noteToFrequency, playNote } from '../utils/audio';

interface NameEntryProps {
  onSaveName: (name: string) => void;
}

export const NameEntry: React.FC<NameEntryProps> = ({ onSaveName }) => {
  const [currentName, setCurrentName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState<NodeJS.Timeout | null>(null);

  const addLetter = (letter: string, note: string) => {
    if (currentName.length < 20) {
      setCurrentName(prev => prev + letter);
      playNote(noteToFrequency(note), 0.8);
    }
  };

  const clearName = () => {
    setCurrentName('');
    playNote(noteToFrequency('C4'), 0.8);
  };

  const backspace = () => {
    if (currentName.length > 0) {
      setCurrentName(prev => prev.slice(0, -1));
    }
  };

  const playName = () => {
    if (currentName.trim() === '') {
      return;
    }

    if (isPlaying) {
      stopPlaying();
      return;
    }

    setIsPlaying(true);
    const nameLetters = currentName.toUpperCase().split('').filter(letter => /[A-Z]/.test(letter));
    
    if (nameLetters.length === 0) {
      return;
    }

    playNameNote(nameLetters[0], 0);

    const interval = setInterval(() => {
      const currentIndex = Math.floor(Date.now() / 800) % nameLetters.length;
      playNameNote(nameLetters[currentIndex], currentIndex);
    }, 800);

    setPlayInterval(interval);
  };

  const playNameNote = (letter: string, _index: number) => {
    const noteIndex = letter.charCodeAt(0) - 65;
    const note = notes[noteIndex % notes.length];
    playNote(noteToFrequency(note), 0.8);
  };

  const stopPlaying = () => {
    setIsPlaying(false);
    if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }
  };

  const handleSaveName = () => {
    if (currentName.trim() === '') {
      return;
    }
    onSaveName(currentName.trim());
  };

  useEffect(() => {
    return () => {
      if (playInterval) {
        clearInterval(playInterval);
      }
    };
  }, [playInterval]);

  return (
    <div className="name-entry-step">
      <div className="student-controls-above">
        <div className="left-controls">
          <button className="btn-student" onClick={handleSaveName}>
            ✅ Save Name
          </button>
          <button 
            className="btn-student" 
            onClick={playName}
            style={{ 
              background: isPlaying ? 'linear-gradient(145deg, #ff6b6b, #ee5a52)' : undefined 
            }}
          >
            {isPlaying ? 'Stop Playing' : '🎵 Play Name'}
          </button>
        </div>
        <div className="right-controls">
          <button className="btn-student btn-clear" onClick={clearName}>
            🔄 Clear
          </button>
        </div>
      </div>
      
      <div className="student-header">
        <h1>🎵 Who Am I? 🎵</h1>
        <div className={`name-display ${currentName.trim() ? 'has-text' : ''}`}>
          {currentName.trim() || 'Enter your name...'}
        </div>
      </div>
      
      <div className="student-interactive">
        <div className="keyboard">
          {letters.map((letter, index) => {
            const currentNote = notes[index % notes.length];
            return (
              <div
                key={letter}
                className="key"
                onClick={() => addLetter(letter, currentNote)}
              >
                {letter}
              </div>
            );
          })}
          <div
            className="key special-key space-key"
            onClick={() => addLetter(' ', notes[26 % notes.length])}
          >
            SPACE
          </div>
          <div
            className="key special-key backspace-key"
            onClick={backspace}
          >
            ⌫
          </div>
        </div>
      </div>
    </div>
  );
};

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

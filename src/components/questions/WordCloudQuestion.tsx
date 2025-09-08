import React, { useState } from 'react';
import type { MusicQuestion } from '../../types';
import { playNote, noteToFrequency } from '../../utils/audio';

interface WordCloudQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
}

export const WordCloudQuestion: React.FC<WordCloudQuestionProps> = ({
  question,
  preferences: _preferences,
  onSelectPreference
}) => {
  const [inputValue, setInputValue] = useState('');
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      const newWords = [...submittedWords, inputValue.trim()];
      setSubmittedWords(newWords);
      onSelectPreference(question.question_number, newWords);
      setInputValue('');
      playNote(noteToFrequency('C5'), 0.3);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const removeWord = (index: number) => {
    const newWords = submittedWords.filter((_, i) => i !== index);
    setSubmittedWords(newWords);
    onSelectPreference(question.question_number, newWords);
    playNote(noteToFrequency('E4'), 0.2);
  };

  return (
    <>
      <div className="preference-question">
        <h3>{question.question_text}</h3>
        {question.placeholder && (
          <p className="question-hint">{question.placeholder}</p>
        )}
      </div>
      
      <div className="word-cloud-input">
        <div className="input-group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your word here..."
            className="word-input"
            maxLength={20}
          />
          <button 
            className="btn-submit-word"
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
          >
            Add Word
          </button>
        </div>
      </div>

      {submittedWords.length > 0 && (
        <div className="word-cloud-display">
          <h4>Your Words:</h4>
          <div className="word-cloud">
            {submittedWords.map((word, index) => (
              <span 
                key={index} 
                className="word-tag"
                onClick={() => removeWord(index)}
                title="Click to remove"
              >
                {word} ×
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

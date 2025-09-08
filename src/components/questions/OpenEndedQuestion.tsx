import React, { useState } from 'react';
import type { MusicQuestion } from '../../types';
import { playNote, noteToFrequency } from '../../utils/audio';

interface OpenEndedQuestionProps {
  question: MusicQuestion;
  preferences: { [key: string]: any };
  onSelectPreference: (questionId: string, value: any) => void;
}

export const OpenEndedQuestion: React.FC<OpenEndedQuestionProps> = ({
  question,
  preferences: _preferences,
  onSelectPreference
}) => {
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    if (response.trim()) {
      onSelectPreference(question.question_number, response.trim());
      playNote(noteToFrequency('C5'), 0.3);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResponse(e.target.value);
  };

  return (
    <>
      <div className="preference-question">
        <h3>{question.question_text}</h3>
        {question.placeholder && (
          <p className="question-hint">{question.placeholder}</p>
        )}
      </div>
      
      <div className="open-ended-input">
        <textarea
          value={response}
          onChange={handleChange}
          placeholder="Share your ideas here..."
          className="response-textarea"
          rows={4}
          maxLength={500}
        />
        <div className="character-count">
          {response.length}/500 characters
        </div>
        <button 
          className="btn-submit-response"
          onClick={handleSubmit}
          disabled={!response.trim()}
        >
          Submit Response
        </button>
      </div>

      {response && (
        <div className="response-preview">
          <h4>Your Response:</h4>
          <div className="response-text">
            {response}
          </div>
        </div>
      )}
    </>
  );
};

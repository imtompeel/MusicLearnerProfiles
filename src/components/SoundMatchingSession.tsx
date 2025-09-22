import React, { useState, useEffect } from 'react';
import { musicQuestionsData } from '../data/musicQuestions';
import { SoundMatchingQuestion } from './questions/SoundMatchingQuestion';
import type { CurrentClass } from '../types';

interface SoundMatchingSessionProps {
  onBack: () => void;
  currentClass: CurrentClass | null;
}

export const SoundMatchingSession: React.FC<SoundMatchingSessionProps> = ({ 
  onBack, 
  currentClass: _currentClass 
}) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [onscreenPrefs, setOnscreenPrefs] = useState<Record<string, any>>({});
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Load Sound Matching Session questions
  useEffect(() => {
    const soundMatchingQuestions = musicQuestionsData.filter(
      q => q.session_type === "Sound Matching Session"
    );
    setQuestions(soundMatchingQuestions);
  }, []);

  // Interactive on-screen only; classroom/session state removed

  return (
    <div className="creativity-session">
      <div className="session-header">
        <button onClick={onBack} className="btn-back">
          ← Back to Sessions
        </button>
        <h1>🎵 Sound Matching Session</h1>
        <div className="session-info" />
      </div>

      <div className="session-controls">
        <div className="session-info">
          <h3>Session Details</h3>
          <p><strong>Questions:</strong> {questions.length} sound matching challenges</p>
          <p><strong>Current Question:</strong> {currentQuestionIndex + 1} of {questions.length}</p>
        </div>
        <div className="session-actions">
            <button 
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              className="next-question-button"
              disabled={currentQuestionIndex <= 0}
            >
              ← Previous
            </button>
            <button 
              onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
              className="next-question-button"
              disabled={currentQuestionIndex >= questions.length - 1}
              style={{ marginLeft: 8 }}
            >
              Next →
            </button>
            <button 
              onClick={() => { setOnscreenPrefs({}); setReloadToken(t => t + 1); }}
              className="end-session-button"
              style={{ marginLeft: 8 }}
            >
              Reset Progress
            </button>
            <button 
              onClick={() => setReloadToken(t => t + 1)}
              className="start-session-button"
              style={{ marginLeft: 8 }}
            >
              🔄 Refresh Sounds
            </button>
        </div>
      </div>
      <div className="onscreen-matching">
        {questions[currentQuestionIndex] && (
          <SoundMatchingQuestion
            question={questions[currentQuestionIndex]}
            preferences={onscreenPrefs}
            onSelectPreference={(questionId, value) =>
              setOnscreenPrefs(prev => ({ ...prev, [questionId]: value }))
            }
            reloadToken={reloadToken}
          />
        )}
      </div>
    </div>
  );
};

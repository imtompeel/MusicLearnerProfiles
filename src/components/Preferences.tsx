import React, { useState, useEffect } from 'react';
import type { MusicQuestion, StudentPreference, CurrentClass } from '../types';
import { 
  MultipleChoiceQuestion, 
  SoundPreferenceQuestion, 
  SoundMatchingQuestion, 
  SearchQuestion 
} from './questions';

interface PreferencesProps {
  studentName: string;
  sessionQuestions: MusicQuestion[];
  currentClass: CurrentClass;
  onSavePreferences: (preferences: { [key: string]: StudentPreference | string | string[] }) => void;
  onBackToName: () => void;
}

export const Preferences: React.FC<PreferencesProps> = ({
  studentName,
  sessionQuestions,
  // currentClass,
  onSavePreferences,
  onBackToName
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [preferences, setPreferences] = useState<{ [key: string]: StudentPreference | string | string[] }>({});

  const currentQuestion = sessionQuestions[currentQuestionIndex];

  const updateProgress = () => {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progress = ((currentQuestionIndex + 1) / sessionQuestions.length) * 100;
    
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }
    if (progressText) {
      progressText.textContent = `Question ${currentQuestionIndex + 1} of ${sessionQuestions.length}`;
    }
  };

  const updateNavigationButtons = () => {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const saveBtn = document.getElementById('saveBtn');
    
    console.log('Updating navigation buttons:', {
      questionType: currentQuestion.question_type,
      currentIndex: currentQuestionIndex,
      totalQuestions: sessionQuestions.length
    });
    
    if (prevBtn) {
      prevBtn.style.display = currentQuestionIndex > 0 ? 'block' : 'none';
    }
    
    if (currentQuestionIndex === sessionQuestions.length - 1) {
      if (nextBtn) nextBtn.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'block';
    } else {
      // Show next button for multiple choice, freesound, and pattern_match questions
      const shouldShowNext = currentQuestion.question_type === 'multiple' || 
                            currentQuestion.question_type === 'freesound' ||
                            currentQuestion.question_type === 'pattern_match';
      console.log('Should show next button:', shouldShowNext);
      if (nextBtn) nextBtn.style.display = shouldShowNext ? 'block' : 'none';
      if (saveBtn) saveBtn.style.display = 'none';
    }
  };

  useEffect(() => {
    updateProgress();
    updateNavigationButtons();
  }, [currentQuestionIndex, currentQuestion]);

  const handleSelectPreference = (questionId: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < sessionQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSavePreferences = () => {
    const selectedCount = Object.keys(preferences).length;
    if (selectedCount < sessionQuestions.length) {
      return;
    }
    
    onSavePreferences(preferences);
  };

  const renderQuestion = () => {
    switch (currentQuestion.question_type) {
      case 'multiple':
        return (
          <MultipleChoiceQuestion
            question={currentQuestion}
            preferences={preferences}
            onSelectPreference={handleSelectPreference}
          />
        );
      
      case 'freesound':
        return (
          <SoundPreferenceQuestion
            question={currentQuestion}
            preferences={preferences}
            onSelectPreference={handleSelectPreference}
          />
        );
      
      case 'pattern_match':
        return (
          <SoundMatchingQuestion
            question={currentQuestion}
            preferences={preferences}
            onSelectPreference={handleSelectPreference}
          />
        );
      
      case 'search':
        return (
          <SearchQuestion
            question={currentQuestion}
            preferences={preferences}
            onSelectPreference={handleSelectPreference}
            onNextQuestion={handleNextQuestion}
          />
        );
      
      default:
        return (
          <MultipleChoiceQuestion
            question={currentQuestion}
            preferences={preferences}
            onSelectPreference={handleSelectPreference}
          />
        );
    }
  };


  return (
    <div className="preferences-step">
      <div className="student-header">
        <h1>🎵 Tell Us About Yourself 🎵</h1>
        <div className="student-info">
          <h2>Hello, {studentName}!</h2>
          <p>Tap the cards to tell us about your preferences:</p>
        </div>
      </div>
      
      <div className="student-interactive">
        <div className="preference-progress">
          <div className="progress-bar">
            <div className="progress-fill" id="progressFill"></div>
          </div>
          <div className="progress-text" id="progressText">Question 1 of 6</div>
        </div>
        
        <div className="preference-navigation">
          <button 
            className="btn-student btn-nav" 
            onClick={handlePreviousQuestion}
            id="prevBtn"
            style={{ display: 'none' }}
          >
            ⬅️ Previous
          </button>
          <button 
            className="btn-student" 
            onClick={onBackToName}
          >
            ⬅️ Back to Name
          </button>
          <button 
            className="btn-student btn-nav" 
            onClick={handleNextQuestion}
            id="nextBtn"
          >
            Next ➡️
          </button>
          <button 
            className="btn-student" 
            onClick={handleSavePreferences}
            id="saveBtn"
            style={{ display: 'none' }}
          >
            ✅ Save Preferences
          </button>
        </div>
        
        <div className="preference-question-container" id="preferenceQuestionContainer">
          {renderQuestion()}
        </div>
      </div>
    </div>
  );
};

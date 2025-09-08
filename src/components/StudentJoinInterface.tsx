import React, { useState, useEffect } from 'react';
import { playNote, noteToFrequency } from '../utils/audio';

interface StudentJoinInterfaceProps {
  sessionCode: string;
  onJoin: (name: string, deviceId: string) => void;
  currentQuestion?: {
    question_text: string;
    question_type: string;
    question_number: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    emoji1: string;
    emoji2: string;
    emoji3: string;
    emoji4: string;
    placeholder?: string;
  };
  timeRemaining?: number;
  onAnswer: (answers: string[]) => void;
  isJoined?: boolean;
  participantName?: string;
}

export const StudentJoinInterface: React.FC<StudentJoinInterfaceProps> = ({
  sessionCode,
  onJoin: _onJoin,
  currentQuestion,
  timeRemaining,
  onAnswer,
  isJoined: _isJoined = false,
  participantName = ''
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [newIdeaInput, setNewIdeaInput] = useState<string>('');

  // Reset selected answers when question number changes
  useEffect(() => {
    setSelectedAnswers([]);
  }, [currentQuestion?.question_number]);

  // handleJoin is now handled by StudentJoinPage

  const handleAnswerSelect = (option: string) => {
    if (!currentQuestion) return;
    
    setSelectedAnswers(prev => {
      const newAnswers = prev.includes(option)
        ? prev.filter(a => a !== option)
        : [...prev, option];
      
      onAnswer(newAnswers);
      playNote(noteToFrequency('E5'), 0.2);
      return newAnswers;
    });
  };

  const handleWordCloudSubmit = (words: string[]) => {
    onAnswer(words);
    playNote(noteToFrequency('E5'), 0.2);
  };

  const handleOpenEndedSubmit = (response: string) => {
    onAnswer([response]);
    playNote(noteToFrequency('E5'), 0.2);
  };

  const addNewIdea = () => {
    if (!newIdeaInput.trim() || selectedAnswers.length >= 3) return;
    
    const newIdeas = [...selectedAnswers, newIdeaInput.trim()];
    setSelectedAnswers(newIdeas);
    setNewIdeaInput('');
    handleMultipleIdeasSubmit(newIdeas);
    playNote(noteToFrequency('E5'), 0.2);
  };

  const handleMultipleIdeasSubmit = (ideas: string[]) => {
    console.log('Student submitting multiple ideas:', ideas);
    onAnswer(ideas);
  };

  const getOptionText = (optionNumber: number) => {
    if (!currentQuestion) return '';
    return currentQuestion[`option${optionNumber}` as keyof typeof currentQuestion] as string;
  };

  const getOptionEmoji = (optionNumber: number) => {
    if (!currentQuestion) return '';
    return currentQuestion[`emoji${optionNumber}` as keyof typeof currentQuestion] as string;
  };

  // This component now only handles the active session interface
  // Name entry and joining is handled by StudentJoinPage

  return (
    <div className="student-join-interface">
      <div className="student-interface">
        <div className="student-header">
          <h1>🎨 My Creativity</h1>
          <div className="student-info">
            <span className="student-name">Welcome, {participantName}!</span>
            <span className="session-code">Code: {sessionCode}</span>
          </div>
        </div>

        {currentQuestion && (
          <div className="question-interface">
            <div className="question-timer">
              {timeRemaining !== undefined && (
                <div className="timer-display">
                  ⏰ {timeRemaining}s
                </div>
              )}
            </div>
            
            <div className="question-content">
              <h2 className="question-text">{currentQuestion.question_text}</h2>
              
              {currentQuestion.question_type === 'word_cloud' ? (
                <div className="word-cloud-interface">
                  <div className="word-cloud-input">
                    <input
                      type="text"
                      placeholder={currentQuestion.placeholder || "Type your word here..."}
                      className="word-input"
                      maxLength={20}
                      value={selectedAnswers[0] || ''}
                      onChange={(e) => {
                        const newWords = [e.target.value];
                        setSelectedAnswers(newWords);
                        handleWordCloudSubmit(newWords);
                      }}
                    />
                    <p className="word-hint">Type your word above</p>
                  </div>
                  {selectedAnswers[0] && (
                    <div className="word-cloud-display">
                      <h4>Your Word:</h4>
                      <div className="word-cloud">
                        <span className="word-tag">
                          {selectedAnswers[0]}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : currentQuestion.question_type === 'open_ended' ? (
                <div className="open-ended-interface">
                  <textarea
                    placeholder={currentQuestion.placeholder || "Share your ideas here..."}
                    className="response-textarea"
                    rows={4}
                    maxLength={500}
                    value={selectedAnswers[0] || ''}
                    onChange={(e) => {
                      const newResponse = e.target.value;
                      setSelectedAnswers([newResponse]);
                      handleOpenEndedSubmit(newResponse);
                    }}
                  />
                  <div className="character-count">
                    {(selectedAnswers[0] || '').length}/500 characters
                  </div>
                </div>
              ) : currentQuestion.question_type === 'idea_collection' ? (
                <div className="idea-collection-interface">
                  <div className="multiple-ideas-container">
                    <div className="ideas-list">
                      {selectedAnswers.map((idea, index) => (
                        <div key={index} className="idea-item">
                          <div className="idea-text">{idea}</div>
                          <button 
                            className="remove-idea-btn"
                            onClick={() => {
                              const newIdeas = selectedAnswers.filter((_, i) => i !== index);
                              setSelectedAnswers(newIdeas);
                              handleMultipleIdeasSubmit(newIdeas);
                            }}
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {selectedAnswers.length < 3 && (
                      <div className="new-idea-input">
                        <textarea
                          placeholder={currentQuestion.placeholder || "Share a creative project idea..."}
                          className="response-textarea"
                          rows={3}
                          maxLength={150}
                          value={newIdeaInput}
                          onChange={(e) => setNewIdeaInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              addNewIdea();
                            }
                          }}
                        />
                        <div className="idea-input-controls">
                          <div className="character-count">
                            {newIdeaInput.length}/150 characters
                          </div>
                          <button 
                            className="add-idea-btn"
                            onClick={addNewIdea}
                            disabled={!newIdeaInput.trim() || selectedAnswers.length >= 3}
                          >
                            ➕ Add Idea
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="idea-hint">💡 You can submit up to 3 ideas! Your ideas will be shared with the class for voting.</p>
                </div>
              ) : currentQuestion.question_type === 'idea_voting' ? (
                <div className="idea-voting-interface">
                  <div className="voting-message">
                    <p>🎯 Vote for your favourite creative project idea!</p>
                    <p>Click on an idea below to vote for it:</p>
                  </div>
                  
                  {/* Debug: Show what options are available */}
                  {(() => {
                    console.log('🎯 STUDENT: Question 8 voting options received:', {
                      questionType: currentQuestion.question_type,
                      questionNumber: currentQuestion.question_number,
                      option1: currentQuestion.option1,
                      option2: currentQuestion.option2,
                      option3: currentQuestion.option3,
                      option4: currentQuestion.option4,
                      hasOptions: !!(currentQuestion.option1 || currentQuestion.option2 || currentQuestion.option3 || currentQuestion.option4)
                    });
                    return null;
                  })()}
                  
                  {/* Voting options will be populated by the teacher */}
                  <div className="voting-options-student">
                    {currentQuestion.option1 && (
                      <button
                        className={`voting-option-btn ${selectedAnswers.includes(currentQuestion.option1) ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(currentQuestion.option1)}
                      >
                        <div className="voting-option-text">{currentQuestion.option1}</div>
                        <div className="voting-option-emoji">🗳️</div>
                      </button>
                    )}
                    {currentQuestion.option2 && (
                      <button
                        className={`voting-option-btn ${selectedAnswers.includes(currentQuestion.option2) ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(currentQuestion.option2)}
                      >
                        <div className="voting-option-text">{currentQuestion.option2}</div>
                        <div className="voting-option-emoji">🗳️</div>
                      </button>
                    )}
                    {currentQuestion.option3 && (
                      <button
                        className={`voting-option-btn ${selectedAnswers.includes(currentQuestion.option3) ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(currentQuestion.option3)}
                      >
                        <div className="voting-option-text">{currentQuestion.option3}</div>
                        <div className="voting-option-emoji">🗳️</div>
                      </button>
                    )}
                    {currentQuestion.option4 && (
                      <button
                        className={`voting-option-btn ${selectedAnswers.includes(currentQuestion.option4) ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(currentQuestion.option4)}
                      >
                        <div className="voting-option-text">{currentQuestion.option4}</div>
                        <div className="voting-option-emoji">🗳️</div>
                      </button>
                    )}
                  </div>
                  
                  {selectedAnswers.length > 0 && (
                    <div className="voted-idea">
                      <h4>You voted for:</h4>
                      <div className="voted-idea-text">
                        {selectedAnswers[0]}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="answer-options">
                  {[1, 2, 3, 4].map(i => {
                    const option = getOptionText(i);
                    const emoji = getOptionEmoji(i);
                    if (!option) return null;
                    
                    const isSelected = selectedAnswers.includes(option);
                    
                    return (
                      <button
                        key={i}
                        className={`answer-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleAnswerSelect(option)}
                      >
                        <div className="option-emoji">{emoji}</div>
                        <div className="option-text">{option}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              
              {currentQuestion.question_type === 'multiple' && selectedAnswers.length > 0 && (
                <div className="selected-answers">
                  <h3>Your answers:</h3>
                  <div className="answer-list">
                    {selectedAnswers.map((answer, index) => (
                      <span key={index} className="answer-tag">
                        {answer}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

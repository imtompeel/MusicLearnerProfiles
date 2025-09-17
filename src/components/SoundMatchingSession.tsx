import React, { useState, useEffect } from 'react';
import { useStudentData } from '../hooks/useStudentData';
import { useStatus } from '../hooks/useStatus';
import { musicQuestionsData } from '../data/musicQuestions';
import { firestoreSessionManager } from '../utils/firestoreSessionManager';
import { SoundMatchingQuestion } from './questions/SoundMatchingQuestion';
// Removed embedded TeacherControls, StudentSection, and ClassSelection for layout consistency
import type { CurrentClass } from '../types';

interface SoundMatchingSessionProps {
  onBack: () => void;
  currentClass: CurrentClass | null;
}

export const SoundMatchingSession: React.FC<SoundMatchingSessionProps> = ({ 
  onBack, 
  currentClass 
}) => {
  const { addStudent } = useStudentData();
  const { showSuccess, showError } = useStatus();
  
  const [sessionCode, setSessionCode] = useState<string>('');
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isLobby: false,
    currentQuestion: null,
    timeRemaining: 0,
    participants: {},
    currentQuestionIndex: -1
  });
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Mode: 'classroom' (join via code) or 'onscreen' (local tap-to-match)
  const [mode, setMode] = useState<'classroom' | 'onscreen'>('classroom');
  const [onscreenPrefs, setOnscreenPrefs] = useState<Record<string, any>>({});
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Load Sound Matching Session questions
  useEffect(() => {
    const soundMatchingQuestions = musicQuestionsData.filter(
      q => q.session_type === "Sound Matching Session"
    );
    setQuestions(soundMatchingQuestions);
  }, []);

  // Align with ClassPlanningSession: pre-generate a session code on mount
  useEffect(() => {
    if (!sessionCode) {
      const code = Math.random().toString(36).substr(2, 6).toUpperCase();
      setSessionCode(code);
    }
  }, []);

  // Subscribe to session state changes
  useEffect(() => {
    if (!sessionCode) return;

    const unsubscribe = firestoreSessionManager.subscribe((state) => {
      console.log('🎯 SOUND MATCHING: Received session state update:', state);
      setSessionState(state);
    });

    return unsubscribe;
  }, [sessionCode]);

  const startSession = async () => {
    if (!currentClass) {
      showError('Please select a class first');
      return;
    }

    if (questions.length === 0) {
      showError('No questions available for Sound Matching Session');
      return;
    }

    try {
      const code = sessionCode || Math.random().toString(36).substr(2, 6).toUpperCase();
      if (!sessionCode) setSessionCode(code);
      console.log('🎯 SOUND MATCHING: Starting session with code:', code);
      
      // Create lobby first
      await firestoreSessionManager.createLobby(code, questions);
      
      // Start the session
      await firestoreSessionManager.startSession(code, questions, 60); // 60 seconds per question
      
      showSuccess(`Sound Matching Session started! Code: ${code}`);
    } catch (error) {
      console.error('Error starting Sound Matching Session:', error);
      showError('Failed to start session. Please try again.');
    }
  };

  const nextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const newQuestionIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newQuestionIndex);
      
      console.log('🎯 SOUND MATCHING: Moving to question index:', newQuestionIndex);
      await firestoreSessionManager.nextQuestion(questions, newQuestionIndex, 60);
    } else {
      // Session complete
      console.log('🎯 SOUND MATCHING: Session complete!');
      await firestoreSessionManager.endSession();
      showSuccess('Sound Matching Session completed!');
    }
  };

  const endSession = async () => {
    try {
      await firestoreSessionManager.endSession();
      setSessionCode('');
      setCurrentQuestionIndex(0);
      showSuccess('Sound Matching Session ended');
    } catch (error) {
      console.error('Error ending session:', error);
      showError('Failed to end session');
    }
  };

  const handleClassSelect = (selectedClass: CurrentClass) => {
    // This will be handled by the parent component
    console.log('Class selected for Sound Matching Session:', selectedClass);
  };

  const handleSessionSelect = (sessionType: string) => {
    // This will be handled by the parent component
    console.log('Session selected:', sessionType);
  };

  const handleSaveStudent = (studentData: any) => {
    addStudent(studentData);
    showSuccess('Student data saved!');
  };

  // Removed clear-all and class selection toggles; managed at higher level

  return (
    <div className="creativity-session">
      <div className="session-header">
        <button onClick={onBack} className="btn-back">
          ← Back to Sessions
        </button>
        <h1>🎵 Sound Matching Session</h1>
        <div className="session-info">
          {mode === 'classroom' && (
            <>
              <div className="session-code">
                <strong>Session Code:</strong> {sessionCode || 'Not started'}
              </div>
              {currentClass && (
                <div className="class-info">
                  <strong>Class:</strong> {currentClass.name} (SoI: {currentClass.soiMedian})
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="session-controls">
        <div className="session-mode-toggle" style={{ marginBottom: '12px' }}>
          <button
            className="btn-teacher"
            onClick={() => setMode('classroom')}
            disabled={mode === 'classroom'}
          >
            🧑‍🏫 Classroom (Join via Code)
          </button>
          <button
            className="btn-teacher"
            onClick={() => setMode('onscreen')}
            disabled={mode === 'onscreen'}
            style={{ marginLeft: 8 }}
          >
            👆 On-screen Matching
          </button>
        </div>
        <div className="session-info">
          <h3>Session Details</h3>
          <p><strong>Questions:</strong> {questions.length} sound matching challenges</p>
          <p><strong>Class:</strong> {currentClass?.name || 'None selected'}</p>
          {mode === 'classroom' && (
            <p><strong>Session Code:</strong> {sessionCode || 'Not started'}</p>
          )}
          <p><strong>Current Question:</strong> {currentQuestionIndex + 1} of {questions.length}</p>
        </div>

        {mode === 'classroom' ? (
          <div className="session-actions">
            {!sessionState.isActive && !sessionState.isLobby ? (
              <button 
                onClick={startSession} 
                className="start-session-button"
                disabled={!currentClass}
              >
                Start Sound Matching Session
              </button>
            ) : (
              <div className="active-session-controls">
                <button 
                  onClick={nextQuestion} 
                  className="next-question-button"
                  disabled={currentQuestionIndex >= questions.length - 1}
                >
                  Next Question ({currentQuestionIndex + 1}/{questions.length})
                </button>
                <button 
                  onClick={endSession} 
                  className="end-session-button"
                >
                  End Session
                </button>
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {mode === 'classroom' ? (
        <div className="session-status">
          {sessionState.isLobby && (
            <div className="lobby-status">
              <h3>🎯 Session Ready</h3>
              <p>Students can join using code: <strong>{sessionCode}</strong></p>
              <p>Click "Start Sound Matching Session" when ready to begin!</p>
            </div>
          )}
          
          {sessionState.isActive && (
            <div className="active-status">
              <h3>🎵 Session Active</h3>
              <p>Question {sessionState.currentQuestionIndex + 1} of {questions.length}</p>
              <p>Time remaining: {sessionState.timeRemaining}s</p>
              <p>Participants: {Object.keys(sessionState.participants).length}</p>
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
};

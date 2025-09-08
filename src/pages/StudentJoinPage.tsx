import React, { useState, useEffect } from 'react';
import { StudentJoinInterface } from '../components/StudentJoinInterface';
import { useStatus } from '../hooks/useStatus';
import { getSessionCodeFromUrl, navigateToTeacher } from '../utils/routing';
import { firestoreSessionManager } from '../utils/firestoreSessionManager';
import { localNameStorage } from '../utils/localNameStorage';

/**
 * Dedicated page for students to join sessions
 * Accessible via: ?student=true&code=SESSION_CODE
 */
export const StudentJoinPage: React.FC = () => {
  const { showError } = useStatus();
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isJoined, setIsJoined] = useState(false);
  const [participantName, setParticipantName] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [sessionState, setSessionState] = useState({
    isActive: false,
    isLobby: false,
    currentQuestion: null,
    timeRemaining: 0,
    sessionCode: '',
    participants: {},
    currentQuestionIndex: 0
  });

  useEffect(() => {
    const code = getSessionCodeFromUrl();
    if (!code) {
      showError('No session code provided. Please use the correct join link.');
      return;
    }
    setSessionCode(code);
  }, [showError]);

  // Subscribe to session state changes only after joining
  useEffect(() => {
    if (!isJoined || !sessionCode) return;

    const unsubscribe = firestoreSessionManager.subscribe((state) => {
      console.log('🎯 STUDENT: Received session state update:', {
        sessionCode: state.sessionCode,
        isActive: state.isActive,
        currentQuestionIndex: state.currentQuestionIndex,
        currentQuestion: state.currentQuestion,
        questionType: state.currentQuestion?.question_type,
        questionNumber: state.currentQuestion?.question_number,
        hasVotingOptions: !!(state.currentQuestion?.option1 || state.currentQuestion?.option2 || state.currentQuestion?.option3 || state.currentQuestion?.option4)
      });
      
      // If the session code doesn't match, or if there's a stale question when session is inactive,
      // clear the current question to show waiting message
      if (state.sessionCode !== sessionCode || (!state.isActive && state.currentQuestion)) {
        const cleanState = {
          ...state,
          currentQuestion: null,
          timeRemaining: 0
        };
        setSessionState(cleanState);
      } else {
        setSessionState(state);
      }
    });

    return unsubscribe;
  }, [isJoined, sessionCode]);

  // Debug: Log current state
  useEffect(() => {
    console.log('Student session state changed:', sessionState);
  }, [sessionState]);

  const handleJoin = async (name: string, studentDeviceId: string) => {
    try {
      // Try to join the session first
      const joined = await firestoreSessionManager.joinSession(sessionCode);
      if (!joined) {
        showError('Failed to join session. Please check the session code.');
        return;
      }

      // Store name locally (never sent to Firestore)
      localNameStorage.storeName(studentDeviceId, name);
      
      // Add participant to session (without name - names stay local)
      await firestoreSessionManager.addParticipant({
        name: '', // Names are stored locally only
        deviceId: studentDeviceId,
        answers: {},
        score: 0
      });
      
      // Update state after successful join
      setIsJoined(true);
      setParticipantName(name);
      setDeviceId(studentDeviceId);
      
      console.log(`Student ${name} (${studentDeviceId}) joined session ${sessionCode}`);
    } catch (error) {
      console.error('Error joining session:', error);
      showError('Failed to join session. Please try again.');
    }
  };

  const handleAnswer = async (answers: string[]) => {
    if (!deviceId || !sessionState.currentQuestion) {
      console.log('Cannot submit answer: missing deviceId or currentQuestion');
      return;
    }
    
    // Update participant answer in session manager
    const questionNumber = (sessionState.currentQuestion as any)?.question_number || '1';
    await firestoreSessionManager.updateParticipantAnswer(deviceId, questionNumber, answers);
    
    console.log(`Student ${participantName} (${deviceId}) answered question ${questionNumber}:`, answers);
  };

  const handleBackToTeacher = () => {
    navigateToTeacher();
  };

  if (!sessionCode) {
    return (
      <div className="student-join-interface">
        <div className="join-container">
          <div className="join-header">
            <h1>🎨 My Creativity</h1>
            <p>Invalid session link. Please contact your teacher for the correct join URL.</p>
            <button className="btn-back" onClick={handleBackToTeacher}>
              Back to Teacher Interface
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Name Entry (before joining)
  if (!isJoined) {
    return (
      <div className="student-join-interface">
        <div className="join-container">
          <div className="join-header">
            <h1>🎨 My Creativity</h1>
            <div className="session-code-display">
              <span className="code-label">Session Code:</span>
              <span className="code-value">{sessionCode}</span>
            </div>
          </div>
          
          <div className="join-form">
            <h2>Join the Session</h2>
            <div className="name-input-group">
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your name"
                className="name-input"
                maxLength={20}
              />
              <button 
                className="btn-join"
                onClick={() => {
                  if (studentName.trim()) {
                    const deviceId = Math.random().toString(36).substr(2, 9);
                    handleJoin(studentName.trim(), deviceId);
                  }
                }}
                disabled={!studentName.trim()}
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Waiting for session to start (after joining)
  if (!sessionState.isActive || !sessionState.currentQuestion) {
    const isLobby = sessionState.isLobby;
    const waitingMessage = isLobby 
      ? "Waiting in lobby for the teacher to start the session..."
      : "Waiting for teacher to start the session...";
    
    return (
      <div className="student-join-interface">
        <div className="join-container">
          <div className="join-header">
            <h1>🎨 My Creativity</h1>
            <div className="session-code-display">
              <span className="code-label">Session Code:</span>
              <span className="code-value">{sessionCode}</span>
            </div>
            <div className="student-info">
              <span className="student-name">Welcome, {participantName}!</span>
            </div>
          </div>
          
          <div className="waiting-message">
            <h2>✅ Successfully Joined!</h2>
            <p>{waitingMessage}</p>
            <div className="waiting-animation">
              <div className="spinner"></div>
            </div>
            <p className="waiting-hint">
              {isLobby 
                ? "You're in the lobby! The session will begin when the teacher starts it."
                : "The session will begin automatically when the teacher starts it."
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Active session (showing questions)
  return (
    <div className="student-join-interface">
      <StudentJoinInterface
        sessionCode={sessionCode}
        onJoin={handleJoin}
        onAnswer={handleAnswer}
        isJoined={isJoined}
        participantName={participantName}
        currentQuestion={sessionState.currentQuestion}
        timeRemaining={sessionState.timeRemaining}
      />
    </div>
  );
};

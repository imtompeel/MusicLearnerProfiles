import React, { useState, useEffect, useMemo } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useStudentData } from '../hooks/useStudentData';
import { creativityQuestionsData } from '../data/creativityQuestions';
import type { CurrentClass, MusicQuestion } from '../types';
import { playNote, noteToFrequency } from '../utils/audio';
import { generateStudentJoinUrl } from '../utils/routing';
import { firestoreSessionManager, type SessionState as FirestoreSessionState } from '../utils/firestoreSessionManager';
import QRCode from 'qrcode';

interface CreativitySessionProps {
  onBack: () => void;
  currentClass: CurrentClass | null;
}

interface Participant {
  name: string;
  deviceId: string;
  answers: { [questionNumber: string]: string[] };
  score: number;
  joinedAt: any; // Can be Date or Timestamp
}

interface SessionState {
  isActive: boolean;
  isLobby: boolean;
  currentQuestion: number;
  questionStartTime: Date | null;
  timeRemaining: number;
  showResults: boolean;
}

export const CreativitySession: React.FC<CreativitySessionProps> = ({ 
  onBack, 
  currentClass 
}) => {
  const { showSuccess, showError } = useStatus();
  const { addStudent } = useStudentData();
  
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: false,
    isLobby: false,
    currentQuestion: 0,
    questionStartTime: null,
    timeRemaining: 30,
    showResults: false
  });
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [questions, setQuestions] = useState<MusicQuestion[]>([]);

  // Memoized sorted participants to prevent jumping around during re-renders
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Sort by name first, then by deviceId for consistent ordering
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.deviceId.localeCompare(b.deviceId);
    });
  }, [participants]);

  // Generate session code
  useEffect(() => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    setSessionCode(code);
  }, []);

  // Load questions for current class
  useEffect(() => {
    if (currentClass) {
      const classQuestions = creativityQuestionsData.filter(q => 
        q.class_level === currentClass.soiMedian
      );
      classQuestions.sort((a, b) => parseInt(a.question_number) - parseInt(b.question_number));
      setQuestions(classQuestions);
    }
  }, [currentClass]);

  // Subscribe to shared session state changes
  useEffect(() => {
    const unsubscribe = firestoreSessionManager.subscribe((firestoreState: FirestoreSessionState) => {
      console.log('Teacher received session state update:', firestoreState);
      
      // Sync local state with Firestore state
      setSessionState(prev => {
        // Don't update currentQuestion if we're showing results (to prevent going back to start)
        const shouldUpdateCurrentQuestion = !prev.showResults;
        
        return {
          ...prev,
          isActive: firestoreState.isActive,
          isLobby: firestoreState.isLobby,
          currentQuestion: shouldUpdateCurrentQuestion ? firestoreState.currentQuestionIndex : prev.currentQuestion,
          timeRemaining: firestoreState.timeRemaining
        };
      });
      
      // Convert participants object to array for display
      const participantsArray = Object.values(firestoreState.participants || {});
      setParticipants(participantsArray);
    });

    return unsubscribe;
  }, []);

  // Timer for questions
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (sessionState.isActive && sessionState.questionStartTime && sessionState.timeRemaining > 0) {
      interval = setInterval(() => {
        const newTimeRemaining = Math.max(0, sessionState.timeRemaining - 1);
        setSessionState(prev => ({
          ...prev,
          timeRemaining: newTimeRemaining
        }));
        
        // Update shared session state
        firestoreSessionManager.updateTimer(newTimeRemaining);
      }, 1000);
    } else if (sessionState.timeRemaining === 0 && sessionState.isActive) {
      // Time's up - show results
      setSessionState(prev => ({ ...prev, showResults: true }));
      playNote(noteToFrequency('C6'), 0.5);
    }
    
    return () => clearInterval(interval);
  }, [sessionState.isActive, sessionState.questionStartTime, sessionState.timeRemaining]);

  const createLobby = async () => {
    if (questions.length === 0) {
      showError('No questions available for this class level');
      return;
    }
    
    setSessionState({
      isActive: false,
      isLobby: true,
      currentQuestion: 0,
      questionStartTime: null,
      timeRemaining: 0,
      showResults: false
    });
    
    // Create lobby in Firestore
    console.log('Creating lobby with code:', sessionCode, 'questions:', questions);
    await firestoreSessionManager.createLobby(sessionCode, questions);
    
    // Generate QR code for the lobby
    await generateQRCode();
    
    showSuccess('Lobby created! Students can join with the code: ' + sessionCode);
  };

  const startSession = async () => {
    if (questions.length === 0) {
      showError('No questions available for this class level');
      return;
    }
    
    setSessionState({
      isActive: true,
      isLobby: false,
      currentQuestion: 0,
      questionStartTime: new Date(),
      timeRemaining: 30,
      showResults: false
    });
    
    // Start the session from lobby
    console.log('Starting session from lobby with code:', sessionCode);
    await firestoreSessionManager.startSession(sessionCode, questions);
    
    showSuccess('Session started! Questions are now live.');
  };

  const nextQuestion = async () => {
    if (sessionState.currentQuestion < questions.length - 1) {
      const newQuestionIndex = sessionState.currentQuestion + 1;
      
      // Update local state for immediate UI feedback
      setSessionState(prev => ({
        ...prev,
        questionStartTime: new Date(),
        showResults: false
      }));
      
      // Update shared session state (this will trigger the subscription and sync all clients)
      await firestoreSessionManager.nextQuestion(questions, newQuestionIndex);
      
      playNote(noteToFrequency('G5'), 0.3);
    } else {
      endSession();
    }
  };

  const endSession = async () => {
    setSessionState(prev => ({ ...prev, isActive: false }));
    
    // Update shared session state
    await firestoreSessionManager.endSession();
    
    // Save all participant data
    participants.forEach(participant => {
      const studentData = {
        class: currentClass?.name || 'Unknown',
        session: 'My Creativity',
        name: participant.name,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString('en-GB'),
        soi_level: currentClass?.soiMedian || 'Unknown',
        session_code: sessionCode,
        device_id: participant.deviceId,
        total_score: participant.score,
        answers: participant.answers
      };
      addStudent(studentData);
    });
    
    showSuccess(`Session ended! Data saved for ${sortedParticipants.length} participants.`);
  };



  const currentQuestion = questions[sessionState.currentQuestion];


  const copyStudentJoinUrl = () => {
    const studentUrl = generateStudentJoinUrl(sessionCode);
    navigator.clipboard.writeText(studentUrl).then(() => {
      showSuccess('Student join URL copied to clipboard!');
    }).catch(() => {
      showError('Failed to copy URL. Please copy manually: ' + studentUrl);
    });
  };

  const generateQRCode = async () => {
    if (!sessionCode) return;
    
    try {
      const studentUrl = generateStudentJoinUrl(sessionCode);
      const qrCodeElement = document.getElementById('qr-code-creativity');
      if (qrCodeElement) {
        // Clear any existing QR code
        qrCodeElement.innerHTML = '';
        
        // Generate QR code as canvas
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, studentUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        qrCodeElement.appendChild(canvas);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      showError('Failed to generate QR code');
    }
  };

  return (
    <div className="creativity-session">
      <div className="session-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Sessions
        </button>
        <h1>🎨 My Creativity Session</h1>
        <div className="session-info">
          <div className="session-code">
            <strong>Session Code:</strong> {sessionCode}
          </div>
          {currentClass && (
            <div className="class-info">
              <strong>Class:</strong> {currentClass.name} (SoI: {currentClass.soiMedian})
            </div>
          )}
        </div>
      </div>

      {!sessionState.isActive ? (
        <div className="session-setup">
          <div className="setup-content">
            <h2>Ready to Start?</h2>
            <p>Students can join using iPads or mobile devices with the session code above.</p>
            <div className="participant-count">
              <strong>Participants:</strong> {sortedParticipants.length}
            </div>
            <div className="question-count">
              <strong>Questions:</strong> {questions.length}
            </div>
            {!sessionState.isLobby ? (
              <button 
                className="btn-start-session" 
                onClick={createLobby}
                disabled={questions.length === 0}
              >
                🚀 Create Session
              </button>
            ) : (
              <>
                <button 
                  className="btn-start-session" 
                  onClick={startSession}
                  disabled={questions.length === 0}
                >
                  🚀 Start Session
                </button>
                <button 
                  className="btn-copy-url" 
                  onClick={copyStudentJoinUrl}
                >
                  📋 Copy Student Join URL
                </button>
                <div className="qr-code-section">
                  <h3>📱 QR Code for Students</h3>
                  <div className="qr-code-container">
                    <div id="qr-code-creativity"></div>
                  </div>
                  <p>Students can scan this QR code to join the session</p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="active-session">
          {!sessionState.showResults ? (
            <div className="question-display">
              <div className="question-header">
                <div className="question-number">
                  Question {sessionState.currentQuestion + 1} of {questions.length}
                </div>
                <div className="timer">
                  ⏰ {sessionState.timeRemaining}s
                </div>
              </div>
              
              {currentQuestion && (
                <>
                  <div className="question-text">
                    <h2>{currentQuestion.question_text}</h2>
                  </div>
                  
                  <div className="question-options">
                    {[1, 2, 3, 4].map(i => {
                      const option = currentQuestion[`option${i}` as keyof MusicQuestion] as string;
                      const emoji = currentQuestion[`emoji${i}` as keyof MusicQuestion] as string;
                      if (!option) return null;
                      
                      return (
                        <div key={i} className="option-display">
                          <div className="option-emoji">{emoji}</div>
                          <div className="option-text">{option}</div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="participant-responses">
                    <h3>Responses ({sortedParticipants.length} participants)</h3>
                    <div className="response-grid">
                      {sortedParticipants.map(participant => {
                        const answers = participant.answers[currentQuestion.question_number] || [];
                        return (
                          <div key={participant.deviceId} className="participant-response">
                            <div className="participant-name">{participant.name}</div>
                            <div className="participant-answers">
                              {answers.length > 0 ? answers.join(', ') : 'No answer yet'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="teacher-controls">
                    <button 
                      className="btn-next-question"
                      onClick={nextQuestion}
                    >
                      Next Question →
                    </button>
                    <button 
                      className="btn-show-results"
                      onClick={() => setSessionState(prev => ({ ...prev, showResults: true }))}
                    >
                      Show Results
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="results-display">
              <h2>Time's Up! 🎉</h2>
              <div className="results-summary">
                <h3>Question {sessionState.currentQuestion + 1} Results</h3>
                <div className="answer-distribution">
                  {[1, 2, 3, 4].map(i => {
                    const option = currentQuestion?.[`option${i}` as keyof MusicQuestion] as string;
                    const emoji = currentQuestion?.[`emoji${i}` as keyof MusicQuestion] as string;
                    if (!option) return null;
                    
                    const count = participants.filter(p => 
                      p.answers[currentQuestion.question_number]?.includes(option)
                    ).length;
                    
                    return (
                      <div key={i} className="answer-stat">
                        <div className="answer-option">
                          <span className="answer-emoji">{emoji}</span>
                          <span className="answer-text">{option}</span>
                        </div>
                        <div className="answer-count">{count} votes</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="session-controls">
                {sessionState.currentQuestion < questions.length - 1 ? (
                  <button className="btn-next" onClick={nextQuestion}>
                    Next Question →
                  </button>
                ) : (
                  <button className="btn-end" onClick={endSession}>
                    End Session
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

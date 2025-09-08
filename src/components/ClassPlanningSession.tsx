import React, { useState, useEffect, useMemo } from 'react';
import { useStatus } from '../hooks/useStatus';
import { useStudentData } from '../hooks/useStudentData';
import { classPlanningQuestionsData } from '../data/classPlanningQuestions';
import type { CurrentClass, MusicQuestion } from '../types';
import { playNote, noteToFrequency } from '../utils/audio';
import { generateStudentJoinUrl } from '../utils/routing';
import { firestoreSessionManager, type SessionState as FirestoreSessionState } from '../utils/firestoreSessionManager';
import QRCode from 'qrcode';

interface ClassPlanningSessionProps {
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

export const ClassPlanningSession: React.FC<ClassPlanningSessionProps> = ({ 
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
    timeRemaining: 60, // Longer time for planning questions
    showResults: false
  });
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [questions, setQuestions] = useState<MusicQuestion[]>([]);
  const [collectedIdeas, setCollectedIdeas] = useState<string[]>([]);
  const [votingOptions, setVotingOptions] = useState<string[]>([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState<number>(0);

  // Memoized sorted participants to prevent jumping around during re-renders
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Sort by name first, then by deviceId for consistent ordering
      const nameCompare = a.name.localeCompare(b.name);
      if (nameCompare !== 0) return nameCompare;
      return a.deviceId.localeCompare(b.deviceId);
    });
  }, [participants]);


  // Function to calculate text similarity (Levenshtein distance)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  // Levenshtein distance calculation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Function to filter duplicates and near-duplicates
  const filterDuplicateIdeas = (ideas: string[]): string[] => {
    const filtered: string[] = [];
    const similarityThreshold = 0.8; // 80% similarity threshold
    
    for (const idea of ideas) {
      const normalizedIdea = idea.toLowerCase().trim();
      let isDuplicate = false;
      
      // Check against already filtered ideas
      for (const existingIdea of filtered) {
        const normalizedExisting = existingIdea.toLowerCase().trim();
        
        // Exact duplicate check
        if (normalizedIdea === normalizedExisting) {
          isDuplicate = true;
          break;
        }
        
        // Near-duplicate check using similarity
        const similarity = calculateSimilarity(normalizedIdea, normalizedExisting);
        if (similarity >= similarityThreshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        filtered.push(idea);
      }
    }
    
    return filtered;
  };

  // Generate session code
  useEffect(() => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    setSessionCode(code);
  }, []);

  // Load questions for class planning
  useEffect(() => {
    const planningQuestions = classPlanningQuestionsData.filter(q => 
      q.class_level === currentClass?.soiMedian || q.class_level === "R1.1"
    );
    planningQuestions.sort((a, b) => parseInt(a.question_number) - parseInt(b.question_number));
    setQuestions(planningQuestions);
  }, [currentClass]);

  // Subscribe to shared session state changes
  useEffect(() => {
    const unsubscribe = firestoreSessionManager.subscribe((firestoreState: FirestoreSessionState) => {
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
      
      // Collect ideas from question 7 (idea_collection) - only for current session
      if (firestoreState.sessionCode === sessionCode) {
        const ideas: string[] = [];
        participantsArray.forEach(participant => {
          const answer = participant.answers['7'];
          if (answer && answer.length > 0) {
            // Collect all ideas from this participant (multiple ideas allowed)
            answer.forEach(idea => {
              if (idea && idea.trim()) {
                ideas.push(idea.trim());
              }
            });
          }
        });
        
        // Only update if we have new ideas
        if (ideas.length > 0) {
          console.log('🎯 TEACHER: Collected ideas for session', sessionCode, ':', ideas);
          
          // Filter out duplicates and near-duplicates
          const filteredIdeas = filterDuplicateIdeas(ideas);
          const duplicatesCount = ideas.length - filteredIdeas.length;
          console.log('🎯 TEACHER: Filtered ideas (duplicates removed):', filteredIdeas);
          setCollectedIdeas(filteredIdeas);
          setDuplicatesRemoved(duplicatesCount);
        }
      }
      
    });

    return unsubscribe;
  }, []);

  // Separate effect to handle voting options when collectedIdeas changes
  useEffect(() => {
    if (collectedIdeas.length > 0) {
      console.log('🎯 TEACHER: Setting voting options from collectedIdeas:', collectedIdeas);
      const uniqueIdeas = [...new Set(collectedIdeas)].slice(0, 4);
      console.log('🎯 TEACHER: Voting options set to:', uniqueIdeas);
      setVotingOptions(uniqueIdeas);
    }
  }, [collectedIdeas]);

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
    } else if (sessionState.timeRemaining === 0 && sessionState.isActive && !sessionState.showResults) {
      // Time's up - move to next question automatically (but not if we're showing results)
      console.log('🎯 TEACHER: Timer expired, auto-advancing to next question');
      nextQuestion();
      playNote(noteToFrequency('C6'), 0.5);
    }
    
    return () => clearInterval(interval);
  }, [sessionState.isActive, sessionState.questionStartTime, sessionState.timeRemaining, sessionState.showResults]);

  const createLobby = async () => {
    if (questions.length === 0) {
      showError('No questions available for this session');
      return;
    }
    
    // Reset all session-related state
    setSessionState({
      isActive: false,
      isLobby: true,
      currentQuestion: 0,
      questionStartTime: null,
      timeRemaining: 0,
      showResults: false
    });
    
    // Clear previous session data
    setCollectedIdeas([]);
    setVotingOptions([]);
    setDuplicatesRemoved(0);
    setParticipants([]);
    
    // Create lobby in Firestore
    console.log('Creating lobby with code:', sessionCode, 'questions:', questions);
    await firestoreSessionManager.createLobby(sessionCode, questions);
    
    // Generate QR code for the lobby
    await generateQRCode();
    
    showSuccess('Lobby created! Students can join with the code: ' + sessionCode);
  };

  const startSession = async () => {
    if (questions.length === 0) {
      showError('No questions available for this session');
      return;
    }
    
    setSessionState({
      isActive: true,
      isLobby: false,
      currentQuestion: 0,
      questionStartTime: new Date(),
      timeRemaining: 60,
      showResults: false
    });
    
    // Clear any previous session data
    setCollectedIdeas([]);
    setVotingOptions([]);
    setDuplicatesRemoved(0);
    
    // Start the session from lobby
    console.log('Starting session from lobby with code:', sessionCode);
    await firestoreSessionManager.startSession(sessionCode, questions, 60); // 60 seconds for first question
    
    showSuccess('Session started! Questions are now live.');
  };

  const nextQuestion = async () => {
    console.log('🎯 TEACHER: nextQuestion called, currentQuestion:', sessionState.currentQuestion, 'questions.length:', questions.length);
    
    if (sessionState.currentQuestion < questions.length - 1) {
      const newQuestionIndex = sessionState.currentQuestion + 1;
      console.log('🎯 TEACHER: Moving to question index:', newQuestionIndex);
      
      // If moving to question 8 (idea_voting), populate the voting options
      let questionsToUse = questions;
      if (newQuestionIndex === 7) {
        console.log('🎯 TEACHER: Moving to question 8, votingOptions available:', votingOptions);
        console.log('🎯 TEACHER: Current collectedIdeas:', collectedIdeas);
        console.log('🎯 TEACHER: Current participants:', participants);
        
        if (votingOptions.length > 0) {
          console.log('🎯 TEACHER: Populating voting options:', votingOptions);
          const updatedQuestions = [...questions];
          const votingQuestion = { ...updatedQuestions[7] };
          
          // Populate the voting options
          votingQuestion.option1 = votingOptions[0] || '';
          votingQuestion.option2 = votingOptions[1] || '';
          votingQuestion.option3 = votingOptions[2] || '';
          votingQuestion.option4 = votingOptions[3] || '';
          
          console.log('🎯 TEACHER: Updated voting question:', votingQuestion);
          updatedQuestions[7] = votingQuestion;
          setQuestions(updatedQuestions);
          questionsToUse = updatedQuestions;
          
          // Update the Firestore session with the modified questions
          await firestoreSessionManager.updateSessionQuestions(sessionCode, updatedQuestions);
          console.log('🎯 TEACHER: Firestore updated with voting options');
        } else {
          console.log('⚠️ TEACHER: No voting options available for question 8');
          console.log('⚠️ TEACHER: This means collectedIdeas was empty or votingOptions was not set');
          console.log('⚠️ TEACHER: Let me try to collect ideas manually...');
          
          // Try to collect ideas manually as a fallback
          const ideas: string[] = [];
          participants.forEach(participant => {
            const answer = participant.answers['7'];
            if (answer && answer.length > 0) {
              answer.forEach(idea => {
                if (idea && idea.trim()) {
                  ideas.push(idea.trim());
                }
              });
            }
          });
          console.log('⚠️ TEACHER: Manually collected ideas:', ideas);
          
          if (ideas.length > 0) {
            const filteredIdeas = filterDuplicateIdeas(ideas);
            const uniqueIdeas = [...new Set(filteredIdeas)].slice(0, 4);
            console.log('⚠️ TEACHER: Using manually collected ideas as voting options:', uniqueIdeas);
            
            const updatedQuestions = [...questions];
            const votingQuestion = { ...updatedQuestions[7] };
            votingQuestion.option1 = uniqueIdeas[0] || '';
            votingQuestion.option2 = uniqueIdeas[1] || '';
            votingQuestion.option3 = uniqueIdeas[2] || '';
            votingQuestion.option4 = uniqueIdeas[3] || '';
            
            updatedQuestions[7] = votingQuestion;
            setQuestions(updatedQuestions);
            questionsToUse = updatedQuestions;
            
            await firestoreSessionManager.updateSessionQuestions(sessionCode, updatedQuestions);
            console.log('⚠️ TEACHER: Firestore updated with manually collected voting options');
          }
        }
      }
      
      // Set timer duration based on question type
      const timerDuration = newQuestionIndex === 6 ? 120 : 60; // 2 minutes for Q7 (idea collection), 1 minute for others
      console.log(`🎯 TEACHER: Setting timer for question ${newQuestionIndex + 1} to ${timerDuration} seconds`);
      
      // Update local state for immediate UI feedback
      setSessionState(prev => ({
        ...prev,
        questionStartTime: new Date(),
        timeRemaining: timerDuration,
        showResults: false
      }));
      
      // Update shared session state (this will trigger the subscription and sync all clients)
      console.log('🎯 TEACHER: Sending question to students:', questionsToUse[newQuestionIndex]);
      await firestoreSessionManager.nextQuestion(questionsToUse, newQuestionIndex, timerDuration);
      
      playNote(noteToFrequency('G5'), 0.3);
    } else {
      endSession();
    }
  };

  const endSession = async () => {
    setSessionState(prev => ({ ...prev, isActive: false, showResults: true }));
    
    // Clear session data
    setCollectedIdeas([]);
    setVotingOptions([]);
    setDuplicatesRemoved(0);
    setParticipants([]);
    
    // Update shared session state
    await firestoreSessionManager.endSession();
    
    // Save all participant data
    participants.forEach(participant => {
      const studentData = {
        class: currentClass?.name || 'Unknown',
        session: 'Class Planning Session',
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
    
    showSuccess(`Session ended! Planning data saved for ${participants.length} participants.`);
  };

  const downloadResults = () => {
    // Create comprehensive results data
    const resultsData = {
      sessionInfo: {
        sessionCode: sessionCode,
        totalParticipants: participants.length,
        totalQuestions: questions.length,
        totalIdeas: collectedIdeas.length,
        timestamp: new Date().toISOString()
      },
      questions: questions.map((question, index) => ({
        questionNumber: index + 1,
        questionText: question.question_text,
        questionType: question.question_type,
        responses: sortedParticipants.map(participant => ({
          participantName: participant.name,
          answers: participant.answers[question.question_number] || []
        }))
      })),
      collectedIdeas: collectedIdeas,
      votingResults: questions.find(q => q.question_type === 'idea_voting') ? {
        question: questions.find(q => q.question_type === 'idea_voting')?.question_text,
        options: [1, 2, 3, 4].map(i => {
          const option = questions.find(q => q.question_type === 'idea_voting')?.[`option${i}` as keyof MusicQuestion] as string;
          if (!option) return null;
          
          const count = participants.filter(p => {
            const answers = p.answers[questions.find(q => q.question_type === 'idea_voting')?.question_number || ''];
            if (Array.isArray(answers)) {
              return answers.includes(option);
            }
            return answers === option;
          }).length;
          
          return { option, votes: count };
        }).filter(Boolean)
      } : null
    };

    // Convert to JSON and download
    const dataStr = JSON.stringify(resultsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `class-planning-results-${sessionCode}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showSuccess('Results downloaded successfully!');
  };

  const currentQuestion = questions[sessionState.currentQuestion];

  // Memoized current question responses to prevent re-rendering on timer updates
  const currentQuestionResponses = useMemo(() => {
    if (!sessionState.isActive || !currentQuestion) return [];
    
    return sortedParticipants.map(participant => {
      const answers = participant.answers[currentQuestion.question_number];
      return {
        participant,
        answers: answers ? (Array.isArray(answers) ? answers.join(', ') : answers) : 'No answer yet'
      };
    });
  }, [sortedParticipants, currentQuestion, sessionState.isActive]);

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
      const qrCodeElement = document.getElementById('qr-code');
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
        <h1>📋 Class Planning Session</h1>
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
            <h2>Ready to Plan Your Year?</h2>
            <p>Students can join using iPads or mobile devices with the session code above.</p>
            <p>This session will help you decide what creative projects to do this year!</p>
            <div className="participant-count">
              <strong>Participants:</strong> {participants.length}
            </div>
            <div className="question-count">
              <strong>Planning Questions:</strong> {questions.length}
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
                    <div id="qr-code"></div>
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
                  
                  {/* Show collected ideas for question 7 */}
                  {currentQuestion.question_type === 'idea_collection' && collectedIdeas.length > 0 && (
                    <div className="collected-ideas">
                      <h3>💡 Ideas Collected So Far:</h3>
                      {duplicatesRemoved > 0 && (
                        <div className="duplicates-info">
                          <span className="duplicates-badge">
                            🔄 {duplicatesRemoved} duplicate{duplicatesRemoved !== 1 ? 's' : ''} filtered out
                          </span>
                        </div>
                      )}
                      <div className="ideas-list">
                        {collectedIdeas.map((idea, index) => (
                          <div key={index} className="idea-item">
                            {idea}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Show voting options for question 8 */}
                  {currentQuestion.question_type === 'idea_voting' && votingOptions.length > 0 && (
                    <div className="voting-options">
                      <h3>🗳️ Vote for Your Favourite Idea:</h3>
                      <div className="voting-options-list">
                        {votingOptions.map((idea, index) => {
                          const voteCount = participants.filter(p => 
                            p.answers['8'] && p.answers['8'].includes(idea)
                          ).length;
                          return (
                            <div key={index} className="voting-option">
                              <div className="voting-idea">{idea}</div>
                              <div className="vote-count">Votes: {voteCount}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
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
                      {currentQuestionResponses.map(({ participant, answers }) => (
                        <div key={participant.deviceId} className="participant-response">
                          <div className="participant-name">{participant.name}</div>
                          <div className="participant-answers">
                            {answers}
                          </div>
                        </div>
                      ))}
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
                      onClick={() => {
                        console.log('🎯 TEACHER: Manually showing results, stopping timer');
                        setSessionState(prev => ({ ...prev, showResults: true, timeRemaining: 0 }));
                      }}
                    >
                      Show Results
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="comprehensive-results">
              <h2>📊 Complete Session Results</h2>
              <div className="results-overview">
                <div className="session-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Participants:</span>
                    <span className="stat-value">{participants.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Questions Completed:</span>
                    <span className="stat-value">{questions.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Ideas Collected:</span>
                    <span className="stat-value">{collectedIdeas.length}</span>
                  </div>
                  {duplicatesRemoved > 0 && (
                    <div className="stat-item">
                      <span className="stat-label">Duplicates Filtered:</span>
                      <span className="stat-value">{duplicatesRemoved}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="all-questions-results">
                {questions.map((question, questionIndex) => (
                  <div key={questionIndex} className="question-result-section">
                    <h3>Question {questionIndex + 1}: {question.question_text}</h3>
                    
                    {question.question_type === 'idea_collection' ? (
                      <div className="ideas-collection-results">
                        <h4>💡 All Collected Ideas:</h4>
                        {duplicatesRemoved > 0 && (
                          <div className="duplicates-info">
                            <span className="duplicates-badge">
                              🔄 {duplicatesRemoved} duplicate{duplicatesRemoved !== 1 ? 's' : ''} automatically filtered out
                            </span>
                          </div>
                        )}
                        <div className="ideas-grid">
                          {collectedIdeas.map((idea, index) => (
                            <div key={index} className="idea-result-item">
                              <span className="idea-number">{index + 1}.</span>
                              <span className="idea-text">{idea}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : question.question_type === 'idea_voting' ? (
                      <div className="voting-results">
                        <h4>🗳️ Voting Results:</h4>
                        <div className="vote-distribution">
                          {[1, 2, 3, 4].map(i => {
                            const option = question[`option${i}` as keyof MusicQuestion] as string;
                            if (!option) return null;
                            
                            const count = participants.filter(p => {
                              const answers = p.answers[question.question_number];
                              if (Array.isArray(answers)) {
                                return answers.includes(option);
                              }
                              return answers === option;
                            }).length;
                            
                            return (
                              <div key={i} className="vote-result">
                                <div className="vote-option">{option}</div>
                                <div className="vote-count">{count} votes</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="standard-question-results">
                        <h4>📝 Responses:</h4>
                        <div className="responses-list">
                          {sortedParticipants.map(participant => {
                            const answers = participant.answers[question.question_number];
                            return (
                              <div key={participant.deviceId} className="participant-response">
                                <span className="participant-name">{participant.name}:</span>
                                <span className="participant-answer">
                                  {answers ? (Array.isArray(answers) ? answers.join(', ') : answers) : 'No response'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="results-actions">
                <button className="btn-download-results" onClick={downloadResults}>
                  📥 Download Results
                </button>
                <button className="btn-end-session" onClick={endSession}>
                  🏁 End Session
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

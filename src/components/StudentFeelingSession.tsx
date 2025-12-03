import React, { useEffect, useMemo, useState } from 'react';
import scale from '../data/feelingScale.json';
import { getSessionCodeFromUrl } from '../utils/routing';
import { firestoreSessionManager } from '../utils/firestoreSessionManager';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface FeelingWord { id: string; text: string; description: string; arasaacId: number }
interface FeelingFace { id: string; label: string; colorHex: string; words: FeelingWord[] }

export const StudentFeelingSession: React.FC = () => {
  const [sessionCode, setSessionCode] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const [selectedFaceId, setSelectedFaceId] = useState<string>('');
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [focusedWordId, setFocusedWordId] = useState<string | null>(null);

  // derive faces
  const faces: FeelingFace[] = (scale as any).faces as FeelingFace[];
  const selectedFace = useMemo(() => faces.find(f => f.id === selectedFaceId) || null, [faces, selectedFaceId]);

  useEffect(() => {
    const code = getSessionCodeFromUrl();
    setSessionCode(code || '');
    // reuse any name if present
    const existingDeviceId = localStorage.getItem('feeling_device_id') || Math.random().toString(36).substr(2, 9);
    setDeviceId(existingDeviceId);
    localStorage.setItem('feeling_device_id', existingDeviceId);
  }, []);

  const joinIfNeeded = async () => {
    if (!sessionCode) return;
    if (!joined) {
      const ok = await firestoreSessionManager.joinSession(sessionCode);
      if (ok) {
        await firestoreSessionManager.addParticipant({ name: '', deviceId, answers: {}, score: 0 });
        setJoined(true);
      }
    }
  };

  useEffect(() => {
    joinIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode, deviceId]);

  // Load existing answers if participant has already submitted
  useEffect(() => {
    if (!sessionCode || !deviceId || !joined) return;
    
    const loadExistingAnswers = async () => {
      try {
        const sessionRef = doc(db, 'sessions', sessionCode);
        const docSnap = await getDoc(sessionRef);
        
        if (docSnap.exists()) {
          const state = docSnap.data();
          if (state?.participants?.[deviceId]) {
            const participant = state.participants[deviceId];
            const answers = participant.answers?.['F1'];
            if (Array.isArray(answers) && answers.length > 0) {
              let faceId = '';
              const wordIds: string[] = [];
              
              answers.forEach((token: string) => {
                if (typeof token === 'string') {
                  if (token.startsWith('face:')) {
                    faceId = token.slice(5);
                  } else if (token.startsWith('word:')) {
                    wordIds.push(token.slice(5));
                  }
                }
              });
              
              if (faceId) {
                setSelectedFaceId(faceId);
                setSelectedWordIds(wordIds);
                setIsSubmitted(true);
              }
            }
          }
        }
      } catch (error) {
        // Silently fail - participant might not have submitted yet
        console.debug('No existing answers found');
      }
    };
    
    loadExistingAnswers();
  }, [sessionCode, deviceId, joined]);

  const toggleWord = (wordId: string) => {
    setSelectedWordIds(prev => prev.includes(wordId) ? prev.filter(id => id !== wordId) : [...prev, wordId]);
    setFocusedWordId(wordId);
  };

  const handleSubmit = async () => {
    if (!deviceId || !sessionCode || !selectedFaceId || selectedWordIds.length === 0) return;
    // Store under F1 using existing API contracts (array of strings)
    // We encode payload as strings: face:<id> and word:<id>
    const payload = [
      `face:${selectedFaceId}`,
      ...selectedWordIds.map(id => `word:${id}`)
    ];
    await firestoreSessionManager.updateParticipantAnswer(deviceId, 'F1', payload);
    setIsSubmitted(true);
    setFocusedWordId(null);
  };

  const handleEdit = () => {
    setIsSubmitted(false);
    setFocusedWordId(null);
  };

  const FaceButton: React.FC<{ face: FeelingFace }> = ({ face }) => {
    const isActive = face.id === selectedFaceId;
    const emojiMap: Record<string, string> = {
      'very_unhappy': '😢',
      'unhappy': '😔',
      'ok': '😐',
      'happy': '😊',
      'very_happy': '😄'
    };
    return (
      <button
        className={`face-button${isActive ? ' active' : ''}`}
        style={{ backgroundColor: face.colorHex }}
        aria-pressed={isActive}
        onClick={() => setSelectedFaceId(face.id)}
        data-emoji={emojiMap[face.id] || '😐'}
      >
        {face.label}
      </button>
    );
  };

  const WordCard: React.FC<{ word: FeelingWord }> = ({ word }) => {
    const isSelected = selectedWordIds.includes(word.id);
    const wordEmojiMap: Record<string, string> = {
      anxious: '😟',
      angry: '😡',
      sad: '😢',
      scared: '😨',
      lonely: '😔',
      overwhelmed: '😵',
      tired: '😴',
      worried: '😰',
      frustrated: '😣',
      confused: '😕',
      disappointed: '😞',
      nervous: '😬',
      calm: '😌',
      fine: '🙂',
      bored: '🥱',
      neutral: '😐',
      peaceful: '🧘',
      content: '😊',
      excited: '🤩',
      proud: '🫡',
      friendly: '🤝',
      grateful: '🙏',
      hopeful: '🌟',
      cheerful: '😃',
      joyful: '😄',
      confident: '💪',
      energetic: '⚡',
      enthusiastic: '🎉',
      amazed: '🤯',
      inspired: '✨'
    };
    const emoji = wordEmojiMap[word.id] || '✨';
    return (
      <div className={`word-card${isSelected ? ' selected' : ''}`}>
        <button className="word-select" onClick={() => toggleWord(word.id)} aria-pressed={isSelected}>
          <div className="word-label" style={{ fontSize: '18px' }}>{emoji} {word.text}</div>
        </button>
        {(focusedWordId === word.id) && (
          <div className="word-description" role="note">{word.description}</div>
        )}
      </div>
    );
  };

  return (
    <div className="student-feeling-session">
      <div className="header">
        <h1>How are you feeling?</h1>
        {sessionCode && <div className="session-code">Code: {sessionCode}</div>}
      </div>

      {/* Step 1: Faces */}
      <div 
        className="faces-row" 
        role="radiogroup" 
        aria-label="Feeling scale"
        style={{ 
          pointerEvents: isSubmitted ? 'none' : 'auto',
          transition: 'opacity 0.3s ease'
        }}
      >
        {faces.map(face => (
          <FaceButton key={face.id} face={face} />
        ))}
      </div>

      {/* Step 2: Words for selected face */}
      {selectedFace && (
        <div 
          className="words-section"
          style={{ 
            pointerEvents: isSubmitted ? 'none' : 'auto',
            transition: 'opacity 0.3s ease'
          }}
        >
          <h2>Choose words that match how you feel</h2>
          <div className="words-grid">
            {selectedFace.words.map(w => (
              <WordCard key={w.id} word={w} />
            ))}
          </div>
        </div>
      )}

      {isSubmitted ? (
        <div className="submission-success" style={{ 
          textAlign: 'center', 
          padding: '30px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 16,
          color: 'white',
          marginTop: 30,
          boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
        }}>
          <div style={{ fontSize: '3em', marginBottom: 16 }}>✓</div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5em' }}>Thank you!</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '1.1em', opacity: 0.95 }}>
            Your feelings have been submitted successfully.
          </p>
          <button
            className="btn-edit"
            onClick={handleEdit}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: '12px 32px',
              borderRadius: 25,
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            }}
          >
            ✏️ Edit Response
          </button>
        </div>
      ) : (
        <div className="actions">
          <button
            className="btn-submit"
            disabled={!selectedFaceId || selectedWordIds.length === 0}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
};





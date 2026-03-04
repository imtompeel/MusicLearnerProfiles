import React, { useEffect, useMemo, useState } from 'react';
import scale from '../data/feelingScale.json';
import { FEELING_WORD_EMOJI_MAP } from '../data/feelingEmojis';
import { TIER_CONFIG, type TierId } from '../data/feelingTierConfig';
import { getSessionCodeFromUrl } from '../utils/routing';
import { firestoreSessionManager } from '../utils/firestoreSessionManager';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface FeelingWord { id: string; text: string; description: string; arasaacId: number }
interface FeelingFace { id: string; label: string; colorHex: string; words: FeelingWord[] }

interface StudentFeelingSessionProps {
  sessionCodeOverride?: string;
}

export const StudentFeelingSession: React.FC<StudentFeelingSessionProps> = ({
  sessionCodeOverride
}) => {
  const [sessionCode, setSessionCode] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [joined, setJoined] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const [selectedFaceId, setSelectedFaceId] = useState<string>('');
  const [selectedWordIds, setSelectedWordIds] = useState<string[]>([]);
  const [focusedWordId, setFocusedWordId] = useState<string | null>(null);
  const [tier, setTier] = useState<TierId>('2');
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

  // derive faces
  const faces: FeelingFace[] = (scale as any).faces as FeelingFace[];
  const selectedFace = useMemo(() => faces.find(f => f.id === selectedFaceId) || null, [faces, selectedFaceId]);
  const tierConfig = TIER_CONFIG[tier];

  useEffect(() => {
    const code = sessionCodeOverride || getSessionCodeFromUrl();
    setSessionCode(code || '');
    // reuse any name if present
    const existingDeviceId = localStorage.getItem('feeling_device_id') || Math.random().toString(36).substr(2, 9);
    setDeviceId(existingDeviceId);
    localStorage.setItem('feeling_device_id', existingDeviceId);

    // derive tier from query string (?tier=1|2|3), defaulting to '2'
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tier') as TierId | null;
      if (t === '1' || t === '2' || t === '3') {
        setTier(t);
      }
    } catch {
      // fail silently if URLSearchParams not available
    }
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
    const faceEmojis = face.words.map(w => FEELING_WORD_EMOJI_MAP[w.id] || '✨');
    const baseStyle: React.CSSProperties = {
      backgroundColor: face.colorHex,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 10px',
      borderRadius: 24,
      border: isActive ? '3px solid #000' : '2px solid rgba(0,0,0,0.1)',
      boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.15)',
      color: '#fff',
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    };

    if (tierConfig.layoutMode === 'centerColumn') {
      baseStyle.width = '100%';
      baseStyle.minHeight = tierConfig.zoneButtonMinHeight;
      baseStyle.borderRadius = 24;
    } else if (tierConfig.layoutMode === 'grid2x2') {
      baseStyle.width = '100%';
      baseStyle.minHeight = tierConfig.zoneButtonMinHeight;
    } else {
      // row layout – circular buttons
      baseStyle.minWidth = tierConfig.zoneButtonMinHeight;
      baseStyle.minHeight = tierConfig.zoneButtonMinHeight;
      baseStyle.borderRadius = '50%';
    }

    return (
      <button
        className={`face-button${isActive ? ' active' : ''}`}
        style={baseStyle}
        aria-pressed={isActive}
        onClick={() => {
          setSelectedFaceId(face.id);
          setFocusedWordId(null);
          if (tierConfig.revealMode === 'expandUnder') {
            setExpandedZoneId(prev => (prev === face.id ? null : face.id));
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 4,
            fontSize: 26,
            marginBottom: 6
          }}
        >
          {faceEmojis.map((emoji, idx) => (
            <span key={idx}>{emoji}</span>
          ))}
        </div>
        <div style={{ fontWeight: 600, fontSize: tierConfig.zoneLabelFontSize }}>{face.label}</div>
      </button>
    );
  };

  const WordCard: React.FC<{ word: FeelingWord }> = ({ word }) => {
    const isSelected = selectedWordIds.includes(word.id);
    const emoji = FEELING_WORD_EMOJI_MAP[word.id] || '✨';
    return (
      <div className={`word-card${isSelected ? ' selected' : ''}`}>
        <button className="word-select" onClick={() => toggleWord(word.id)} aria-pressed={isSelected}>
          <div
            className="word-label"
            style={{
              fontSize: tierConfig.emotionLabelFontSize,
              minHeight: tierConfig.emotionButtonMinHeight,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {emoji} {word.text}
          </div>
        </button>
        {(focusedWordId === word.id) && (
          <div className="word-description" role="note">{word.description}</div>
        )}
      </div>
    );
  };

  const renderEmotionPanelForFace = (face: FeelingFace) => {
    const wordsToShow = face.words.slice(0, tierConfig.maxOptions);
    return (
      <div
        className="words-section tier-2-expand"
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}
      >
        <div className="words-grid">
          {wordsToShow.map(w => (
            <WordCard key={w.id} word={w} />
          ))}
        </div>
      </div>
    );
  };

  const renderZoneSelection = () => {
    // For Tier 1 replace-screen, hide zones once a face is selected
    if (tierConfig.revealMode === 'replaceScreen' && selectedFace) {
      return null;
    }

    if (tierConfig.layoutMode === 'centerColumn') {
      return (
        <div
          className="faces-row tier-1-center"
          role="radiogroup"
          aria-label="Feeling scale"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 16,
            pointerEvents: isSubmitted ? 'none' : 'auto',
            transition: 'opacity 0.3s ease'
          }}
        >
          <div
            style={{
              width: `${tierConfig.containerWidthPercent}%`,
              maxWidth: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: tierConfig.zoneGap
            }}
          >
            {faces.map(face => (
              <FaceButton key={face.id} face={face} />
            ))}
          </div>
        </div>
      );
    }

    if (tierConfig.layoutMode === 'grid2x2') {
      return (
        <div
          className="faces-row tier-2-grid"
          role="radiogroup"
          aria-label="Feeling scale"
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 16,
            pointerEvents: isSubmitted ? 'none' : 'auto',
            transition: 'opacity 0.3s ease'
          }}
        >
          <div
            style={{
              width: `${tierConfig.containerWidthPercent}%`,
              maxWidth: 700,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: tierConfig.zoneGap
            }}
          >
            {faces.map(face => (
              <div key={face.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <FaceButton face={face} />
                {tierConfig.revealMode === 'expandUnder' && expandedZoneId === face.id && renderEmotionPanelForFace(face)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default row layout (Tier 3)
    return (
      <div
        className="faces-row tier-3-row"
        role="radiogroup"
        aria-label="Feeling scale"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: tierConfig.zoneGap,
          marginTop: 16,
          flexWrap: 'wrap',
          pointerEvents: isSubmitted ? 'none' : 'auto',
          transition: 'opacity 0.3s ease'
        }}
      >
        {faces.map(face => (
          <FaceButton key={face.id} face={face} />
        ))}
      </div>
    );
  };

  const shouldShowInlineWords =
    !!selectedFace &&
    tierConfig.revealMode === 'replaceScreen';

  const submittedFace = isSubmitted
    ? faces.find(f => f.id === selectedFaceId) || null
    : null;

  const ZOR_STRATEGIES: Record<string, { title: string; tips: string[] }> = {
    blue: {
      title: 'Things that can help in the Blue Zone',
      tips: [
        'Talk to a trusted adult about how you feel.',
        'Have a drink of water or a small snack.',
        'Take a short movement break or gentle stretch.',
        'Try 3 slow, deep breaths in and out.'
      ]
    },
    green: {
      title: 'Things you can do in the Green Zone',
      tips: [
        'Keep going with your learning or activity.',
        'Notice something that is going well and enjoy it.',
        'Offer to help a friend or classmate.',
        'Take a moment to say “thank you” for something today.'
      ]
    },
    yellow: {
      title: 'Things that can help in the Yellow Zone',
      tips: [
        'Ask for a short break or some quiet time.',
        'Use a calming strategy, like counting slowly to 10.',
        'Write or draw how you are feeling.',
        'Talk to an adult about what is worrying or confusing you.'
      ]
    },
    red: {
      title: 'Things that can help in the Red Zone',
      tips: [
        'Move to a safe space with an adult if you can.',
        'Use strong body breaks, like squeezing a cushion or pressing your hands together.',
        'Take slow breaths until your body starts to feel calmer.',
        'Talk to a trusted adult when you are ready.'
      ]
    }
  };

  return (
    <div className="student-feeling-session">
      <div className="header">
        <h1>How are you feeling?</h1>
        {sessionCode && <div className="session-code">Code: {sessionCode}</div>}
      </div>

      {/* Step 1: Zones */}
      {renderZoneSelection()}

      {/* Step 2: Words for selected face – Tier 1 replace-screen only */}
      {shouldShowInlineWords && selectedFace && (
        <div
          className="words-section tier-1-replace"
          style={{
            pointerEvents: isSubmitted ? 'none' : 'auto',
            transition: 'opacity 0.3s ease',
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: selectedFace.colorHex,
            color: '#fff'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedFaceId('');
              setSelectedWordIds([]);
              setFocusedWordId(null);
            }}
            style={{
              marginBottom: 12,
              padding: '6px 12px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ← Back to Zones
          </button>
          <h2>Choose words that match how you feel</h2>
          <div className="words-grid">
            {selectedFace.words.slice(0, tierConfig.maxOptions).map(w => (
              <WordCard key={w.id} word={w} />
            ))}
          </div>
        </div>
      )}

      {isSubmitted ? (
        <div
          className="submission-success"
          style={{ 
            textAlign: 'center', 
            padding: '30px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16,
            color: 'white',
            marginTop: 30,
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
          }}
        >
          <div style={{ fontSize: '3em', marginBottom: 16 }}>✓</div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.5em' }}>Thank you!</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '1.1em', opacity: 0.95 }}>
            Your feelings have been submitted successfully.
          </p>

          {submittedFace && ZOR_STRATEGIES[submittedFace.id] && (
            <div
              className="zor-strategies"
              style={{
                marginTop: 16,
                padding: '16px 14px',
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.15)',
                textAlign: 'left'
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em' }}>
                {ZOR_STRATEGIES[submittedFace.id].title}
              </h3>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.95em' }}>
                {ZOR_STRATEGIES[submittedFace.id].tips.map((tip, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              marginTop: 20
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





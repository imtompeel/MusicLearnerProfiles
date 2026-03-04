import React, { useEffect, useMemo, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import { generateStudentJoinUrl } from '../utils/routing';
import { firestoreSessionManager } from '../utils/firestoreSessionManager';
import { generateSessionCode } from '../utils/sessionCodes';
import { renderSessionQr } from '../utils/qr';
import scale from '../data/feelingScale.json';
import { type AgeBandId } from '../data/zonesOfRegulationConfig';
import { FEELING_WORD_EMOJI_MAP } from '../data/feelingEmojis';
import { type TierId } from '../data/feelingTierConfig';
import { StudentFeelingSession } from './StudentFeelingSession';

interface HowAreYouFeelingSessionProps {
  onBack: () => void;
}

export const HowAreYouFeelingSession: React.FC<HowAreYouFeelingSessionProps> = ({ onBack }) => {
  const { showSuccess, showError } = useStatus();
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isLobby, setIsLobby] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Record<string, any>>({});
  const [ageBand] = useState<AgeBandId>('primary');
  const [tier, setTier] = useState<TierId>('2');

  const isDevEnvironment =
    (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.env?.DEV));

  useEffect(() => {
    const code = generateSessionCode();
    setSessionCode(code);
  }, []);

  const createLobby = async () => {
    try {
      // create minimal lobby so students can join
      await firestoreSessionManager.createLobby(sessionCode, [], {
        mode: 'feeling',
        ageBand
      });
      setIsLobby(true);
      showSuccess('Feeling lobby created. Share the link/QR with students.');
    } catch (e) {
      showError('Failed to create lobby.');
    }
  };

  const copyStudentJoinUrl = () => {
    const studentUrl = generateStudentJoinUrl(sessionCode, undefined, { mode: 'feeling', tier });
    navigator.clipboard.writeText(studentUrl).then(() => {
      showSuccess('Feeling join URL copied to clipboard!');
    }).catch(() => {
      showError('Failed to copy URL. Please copy manually: ' + studentUrl);
    });
  };

  const generateQRCode = async () => {
    if (!sessionCode) return;
    try {
      await renderSessionQr(
        sessionCode,
        { mode: 'feeling', tier },
        { elementId: 'feeling-qr' }
      );
    } catch (error) {
      showError('Failed to generate QR code');
    }
  };

  // Ensure QR is generated after the lobby UI is rendered
  useEffect(() => {
    if (isLobby && sessionCode) {
      // defer to next tick to ensure element exists
      const t = setTimeout(() => { generateQRCode(); }, 0);
      return () => clearTimeout(t);
    }
  }, [isLobby, sessionCode]);

  // Subscribe to session changes to reflect participants' answers
  useEffect(() => {
    const unsubscribe = firestoreSessionManager.subscribe((state) => {
      if (state && state.sessionCode === sessionCode) {
        setParticipants(state.participants || {});
      }
    });
    return unsubscribe;
  }, [sessionCode]);

  const aggregates = useMemo(() => {
    const faceCounts: Record<string, number> = {};
    const wordCounts: Record<string, number> = {};
    Object.values(participants || {}).forEach((p: any) => {
      const ans = p?.answers?.['F1'];
      if (Array.isArray(ans)) {
        ans.forEach((token: string) => {
          if (typeof token === 'string') {
            if (token.startsWith('face:')) {
              const id = token.slice(5);
              faceCounts[id] = (faceCounts[id] || 0) + 1;
            } else if (token.startsWith('word:')) {
              const id = token.slice(5);
              wordCounts[id] = (wordCounts[id] || 0) + 1;
            }
          }
        });
      }
    });
    return { faceCounts, wordCounts };
  }, [participants]);

  // Get face data for labels and colors
  const faceData = useMemo(() => {
    const faces = (scale as any).faces as Array<{ id: string; label: string; colorHex: string; words: Array<{ id: string; text: string }> }>;
    const faceMap: Record<string, { label: string; colorHex: string }> = {};
    const wordMap: Record<string, { text: string; faceColor: string }> = {};
    faces.forEach(face => {
      faceMap[face.id] = { label: face.label, colorHex: face.colorHex };
      face.words.forEach(word => {
        wordMap[word.id] = { text: word.text, faceColor: face.colorHex };
      });
    });
    return { faceMap, wordMap };
  }, []);

  return (
    <div className="feeling-session">
      <div className="session-header">
        <button className="btn-back" onClick={onBack}>← Back to Sessions</button>
        <h1>How Are You Feeling</h1>
        <div className="session-info">
          <div className="session-code"><strong>Session Code:</strong> {sessionCode}</div>
        </div>
      </div>
      <div 
        className="session-tier" 
        style={{ 
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <label
            htmlFor="tierSelect"
            style={{ marginBottom: 4, fontWeight: 600, textAlign: 'center' }}
          >
            Tier layout for students:
          </label>
          <select
            id="tierSelect"
            value={tier}
            onChange={(e) => setTier(e.target.value as TierId)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }}
          >
            <option value="1">Simple Set</option>
            <option value="2">Medium Set</option>
            <option value="3">Full Feelings Set</option>
          </select>
        </div>
      </div>
      {!isLobby ? (
        <div className="session-setup">
          <div className="setup-content">
            <p>Start a quick check-in for students to share how they feel.</p>
            <button className="btn-start-session" onClick={createLobby}>🚀 Create Feeling Session</button>
          </div>
        </div>
      ) : (
        <div className="session-setup">
          <div className="setup-content">
            <button className="btn-copy-url" onClick={copyStudentJoinUrl}>📋 Copy Feeling Join URL</button>
            <div className="qr-code-section">
              <h3>📱 QR Code for Students</h3>
              <div className="qr-code-container"><div id="feeling-qr"></div></div>
              <p>Students can scan this QR code to join the feeling check.</p>
              <button className="btn-copy-url" onClick={generateQRCode}>↻ Refresh QR</button>
            </div>
            {/* Live aggregates */}
            {(() => {
              const total = Object.values(aggregates.faceCounts).reduce((a, b) => a + b, 0);
              if (total === 0) return null;
              const faceEntries = Object.entries(aggregates.faceCounts).sort((a, b) => b[1] - a[1]);
              const wordEntries = Object.entries(aggregates.wordCounts).sort((a, b) => b[1] - a[1]);
              const maxWordCount = wordEntries.length > 0 ? Math.max(...wordEntries.map(([, count]) => count)) : 1;
              const minFontSize = 14;
              const maxFontSize = 32;
              
              // Emoji map for faces (expressive faces aligned to zones)
              const faceEmojiMap: Record<string, string> = {
                red: '😡',
                blue: '😢',
                yellow: '😕',
                green: '😊'
              };

              return (
                <div className="feeling-aggregates" style={{ marginTop: 30, padding: '24px', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ textAlign: 'center', marginBottom: 24, fontSize: '1.8em', color: '#2c3e50', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    📊 Live Responses
                  </h3>
                  
                  {/* Face counts with visual enhancement */}
                  <div style={{ marginBottom: 32 }}>
                    <h4 style={{ textAlign: 'center', marginBottom: 16, fontSize: '1.2em', color: '#34495e', fontWeight: 600 }}>
                      Feeling Scale Distribution
                    </h4>
                    <div className="feeling-faces" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {faceEntries.map(([faceId, count]) => {
                        const faceInfo = faceData.faceMap[faceId] || { label: faceId, colorHex: '#95a5a6' };
                        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                        const emoji = faceEmojiMap[faceId] || '😐';
                        return (
                          <div
                            key={faceId}
                            className="face-count"
                            style={{
                              background: `linear-gradient(135deg, ${faceInfo.colorHex} 0%, ${faceInfo.colorHex}dd 100%)`,
                              padding: '16px 20px',
                              borderRadius: 16,
                              border: `3px solid ${faceInfo.colorHex}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              color: 'white',
                              minWidth: '140px',
                              textAlign: 'center',
                              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                              cursor: 'default'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0) scale(1)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                            }}
                          >
                            <div style={{ fontSize: '2em', marginBottom: 8 }}>{emoji}</div>
                            <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: 4, textTransform: 'capitalize' }}>
                              {faceInfo.label}
                            </div>
                            <div style={{ fontSize: '2em', fontWeight: 800, marginBottom: 4 }}>{count}</div>
                            <div style={{ fontSize: '0.85em', opacity: 0.9 }}>{percentage}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Word cloud with size based on count */}
                  {wordEntries.length > 0 && (
                    <div className="feeling-top-words" style={{ marginTop: 32 }}>
                      <h4 style={{ textAlign: 'center', marginBottom: 20, fontSize: '1.2em', color: '#34495e', fontWeight: 600 }}>
                        💭 Word Cloud
                      </h4>
                      <div 
                        className="word-counts" 
                        style={{ 
                          display: 'flex', 
                          gap: 12, 
                          flexWrap: 'wrap', 
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: '200px',
                          padding: '20px',
                          background: 'rgba(255,255,255,0.6)',
                          borderRadius: 12
                        }}
                      >
                        {wordEntries.map(([wordId, count]) => {
                          const wordInfo = faceData.wordMap[wordId] || { text: wordId, faceColor: '#95a5a6' };
                          const fontSize = minFontSize + ((count / maxWordCount) * (maxFontSize - minFontSize));
                          const opacity = 0.7 + ((count / maxWordCount) * 0.3);
                          const emoji = FEELING_WORD_EMOJI_MAP[wordId] || '✨';
                          return (
                            <div
                              key={wordId}
                              className="word-count"
                              style={{
                                background: `linear-gradient(135deg, ${wordInfo.faceColor}20 0%, ${wordInfo.faceColor}40 100%)`,
                                padding: `${Math.max(8, fontSize * 0.3)}px ${Math.max(12, fontSize * 0.5)}px`,
                                borderRadius: 20,
                                border: `2px solid ${wordInfo.faceColor}60`,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                fontSize: `${fontSize}px`,
                                fontWeight: 600,
                                color: '#2c3e50',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.3s ease',
                                cursor: 'default',
                                opacity: opacity
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px) scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                e.currentTarget.style.opacity = String(opacity);
                              }}
                            >
                              <span style={{ fontSize: `${fontSize * 0.8}px` }}>{emoji}</span>
                              <span>{wordInfo.text}</span>
                              <span style={{ 
                                fontSize: `${fontSize * 0.6}px`, 
                                background: wordInfo.faceColor, 
                                color: 'white',
                                borderRadius: '50%',
                                width: `${fontSize * 0.8}px`,
                                height: `${fontSize * 0.8}px`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                marginLeft: 4
                              }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {isLobby && isDevEnvironment && sessionCode && (
        <div
          style={{
            marginTop: 24,
            borderRadius: 12,
            border: '1px dashed #888',
            padding: 16,
            background: '#fdfdfd'
          }}
        >
          <h3 style={{ marginTop: 0 }}>🛠 Dev Preview: Student Feeling View</h3>
          <p style={{ fontSize: 13, color: '#555' }}>
            This is what a student sees after scanning the QR code, using the live session code.
          </p>
          <div style={{ maxWidth: 500, marginTop: 12 }}>
            <StudentFeelingSession sessionCodeOverride={sessionCode} />
          </div>
        </div>
      )}
    </div>
  );
};


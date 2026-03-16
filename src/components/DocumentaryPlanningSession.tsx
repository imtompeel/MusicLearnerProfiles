import React, { useCallback, useEffect, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import {
  listDocumentaryPlanningSessions,
  loadDocumentaryPlanningSession,
  createDocumentaryPlanningSession,
  saveDocumentaryPlanningEntries,
  type DocumentaryPlanningSession as DPSession,
  type DocumentaryRowData,
} from '../utils/firestoreDocumentaryPlanning';

interface DocumentaryPlanningSessionProps {
  onBack: () => void;
}

const TIME_SLOT = '10:00 – 10:45';
const WEEKS_AHEAD = 12;

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getUpcomingMondays(count: number): string[] {
  const dates: string[] = [];
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  const dayOfWeek = current.getDay();
  const daysUntilMonday = dayOfWeek === 1 ? 7 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  current.setDate(current.getDate() + daysUntilMonday);

  for (let i = 0; i < count; i++) {
    dates.push(toLocalISO(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const EMPTY_ROW: DocumentaryRowData = {
  interviewer: '',
  interviewee: '',
  location: '',
  director: '',
  cameraPerson: '',
  linkOperator: '',
};

const FIELD_LABELS: { key: keyof DocumentaryRowData; label: string }[] = [
  { key: 'interviewer', label: 'Interviewer' },
  { key: 'interviewee', label: 'Interviewee' },
  { key: 'location', label: 'Location' },
  { key: 'director', label: 'Director' },
  { key: 'cameraPerson', label: 'Camera Person' },
  { key: 'linkOperator', label: 'Link Operator' },
];

type View = 'menu' | 'create' | 'resume' | 'grid';

export const DocumentaryPlanningSession: React.FC<DocumentaryPlanningSessionProps> = ({ onBack }) => {
  const { showSuccess, showError } = useStatus();

  // --- navigation state ---
  const [view, setView] = useState<View>('menu');

  // --- create form ---
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // --- resume form ---
  const [sessionList, setSessionList] = useState<{ id: string; teacherEmail: string }[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [resumePassword, setResumePassword] = useState('');

  // --- active session ---
  const [session, setSession] = useState<DPSession | null>(null);
  const [entries, setEntries] = useState<{ [date: string]: DocumentaryRowData }>({});
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mondays = getUpcomingMondays(WEEKS_AHEAD);

  // ---- helpers ----
  const fetchSessionList = useCallback(async () => {
    try {
      setLoadingList(true);
      const list = await listDocumentaryPlanningSessions();
      setSessionList(list);
    } catch {
      showError('Failed to load session list.');
    } finally {
      setLoadingList(false);
    }
  }, [showError]);

  const openSession = (s: DPSession) => {
    setSession(s);
    setEntries(s.entries ?? {});
    setView('grid');
  };

  // ---- create ----
  const handleCreate = async () => {
    const email = newEmail.trim().toLowerCase();
    const pwd = newPassword.trim();
    if (!email || !email.includes('@')) { showError('Please enter a valid email address.'); return; }
    if (!pwd) { showError('Please set a password.'); return; }

    try {
      setLoading(true);
      const s = await createDocumentaryPlanningSession(email, pwd);
      showSuccess(`Created documentary planning for ${email}.`);
      openSession(s);
    } catch {
      showError('Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  // ---- resume ----
  useEffect(() => {
    if (view === 'resume') fetchSessionList();
  }, [view, fetchSessionList]);

  const handleResume = async () => {
    if (!selectedSessionId) { showError('Please select a session.'); return; }
    const pwd = resumePassword.trim();
    if (!pwd) { showError('Please enter the password.'); return; }

    try {
      setLoading(true);
      const s = await loadDocumentaryPlanningSession(selectedSessionId);
      if (!s) { showError('Session not found.'); return; }
      if (s.password !== pwd) { showError('Incorrect password.'); return; }
      showSuccess(`Resumed documentary planning for ${s.teacherEmail}.`);
      openSession(s);
    } catch {
      showError('Failed to load session.');
    } finally {
      setLoading(false);
    }
  };

  // ---- grid editing ----
  const getRow = (date: string): DocumentaryRowData => entries[date] ?? { ...EMPTY_ROW };

  const handleFieldChange = (date: string, field: keyof DocumentaryRowData, value: string) => {
    const sanitised = field === 'location'
      ? value
      : value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
    setEntries((prev) => ({
      ...prev,
      [date]: { ...(prev[date] ?? { ...EMPTY_ROW }), [field]: sanitised },
    }));
  };

  const handleSaveRow = async (date: string) => {
    if (!session) return;
    const row = getRow(date);
    const hasContent = FIELD_LABELS.some((f) => row[f.key].trim() !== '');
    if (!hasContent) return;

    try {
      setSavingDate(date);
      const updatedEntries = { ...entries, [date]: row };
      await saveDocumentaryPlanningEntries(session.id, updatedEntries);
      showSuccess(`Saved planning for ${formatDateLabel(date)}.`);
    } catch {
      showError('Failed to save. Please try again.');
    } finally {
      setSavingDate(null);
    }
  };

  const handleClearRow = async (date: string) => {
    if (!session) return;
    try {
      setSavingDate(date);
      const updatedEntries = { ...entries };
      delete updatedEntries[date];
      setEntries(updatedEntries);
      await saveDocumentaryPlanningEntries(session.id, updatedEntries);
      showSuccess(`Cleared planning for ${formatDateLabel(date)}.`);
    } catch {
      showError('Failed to clear row.');
    } finally {
      setSavingDate(null);
    }
  };

  // ---- render ----
  return (
    <div className="documentary-planning-session">
      <style>{`
        .documentary-planning-session {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* Header */
        .dp-header {
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          border-bottom: 2px solid #e2e6ea;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
          flex-shrink: 0;
        }
        .dp-header h1 { margin: 0; font-size: 1.4em; color: #2c3e50; }
        .dp-header .dp-time-badge {
          background: #667eea; color: #fff;
          padding: 4px 12px; border-radius: 999px;
          font-size: 0.85em; font-weight: 600;
        }
        .dp-header .dp-class-badge {
          background: #28a745; color: #fff;
          padding: 4px 12px; border-radius: 999px;
          font-size: 0.85em; font-weight: 600;
        }

        /* GDPR notice */
        .dp-gdpr-notice {
          background: #fff3cd; border: 1px solid #ffc107;
          border-radius: 8px; padding: 10px 16px;
          margin: 12px 24px 0; font-size: 0.88em;
          color: #664d03; flex-shrink: 0;
        }

        /* Menu / forms */
        .dp-menu {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 20px;
          padding: 40px 24px;
        }
        .dp-menu h2 { margin: 0 0 8px; color: #2c3e50; }
        .dp-menu-buttons { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
        .dp-menu-btn {
          padding: 20px 32px; border-radius: 14px; border: 2px solid #e2e6ea;
          background: #fff; cursor: pointer; font-size: 1.05em; font-weight: 600;
          color: #2c3e50; transition: all 0.2s; text-align: center; min-width: 200px;
        }
        .dp-menu-btn:hover {
          border-color: #667eea; background: #f0f4ff; transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102,126,234,0.15);
        }
        .dp-form {
          width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 12px;
          padding: 24px; border-radius: 14px; background: #f9fafb; border: 1px solid #e2e6ea;
        }
        .dp-form label { font-weight: 600; color: #34495e; font-size: 0.92em; }
        .dp-form input, .dp-form select {
          padding: 10px 12px; border-radius: 8px; border: 1px solid #ccc;
          font-size: 1em; font-family: inherit;
        }
        .dp-form input:focus, .dp-form select:focus {
          outline: none; border-color: #667eea;
          box-shadow: 0 0 0 2px rgba(102,126,234,0.15);
        }
        .dp-form-actions { display: flex; gap: 8px; margin-top: 4px; }
        .dp-form-btn {
          flex: 1; padding: 10px; border: none; border-radius: 8px;
          font-weight: 600; font-size: 0.95em; cursor: pointer; transition: opacity 0.15s;
        }
        .dp-form-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .dp-form-btn-primary { background: #667eea; color: #fff; }
        .dp-form-btn-primary:hover:not(:disabled) { opacity: 0.85; }
        .dp-form-btn-secondary { background: #e2e6ea; color: #34495e; }
        .dp-form-btn-secondary:hover:not(:disabled) { opacity: 0.85; }

        /* Session list */
        .dp-session-list {
          max-height: 180px; overflow-y: auto; border: 1px solid #ddd;
          border-radius: 8px; background: #fff;
        }
        .dp-session-item {
          padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f0f0f0;
          transition: background 0.1s; font-weight: 500;
        }
        .dp-session-item:last-child { border-bottom: none; }
        .dp-session-item:hover { background: #f0f4ff; }
        .dp-session-item.selected { background: #667eea; color: #fff; }

        /* Table */
        .dp-table-wrapper { flex: 1; overflow: auto; padding: 16px 24px 24px; }
        .dp-table {
          width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.9em;
        }
        .dp-table thead th {
          position: sticky; top: 0; background: #2c3e50; color: #fff;
          padding: 10px 8px; text-align: left; font-weight: 600;
          white-space: nowrap; z-index: 2;
        }
        .dp-table thead th:first-child { border-radius: 8px 0 0 0; }
        .dp-table thead th:last-child { border-radius: 0 8px 0 0; }
        .dp-table tbody tr { transition: background 0.15s ease; }
        .dp-table tbody tr:hover { background: #f0f4ff; }
        .dp-table td {
          padding: 6px 8px; border-bottom: 1px solid #e9ecef; vertical-align: middle;
        }
        .dp-date-cell {
          font-weight: 600; white-space: nowrap; color: #34495e; min-width: 140px;
        }
        .dp-table input[type="text"] {
          width: 100%; border: 1px solid transparent; background: transparent;
          padding: 6px 8px; border-radius: 6px; font-size: inherit; font-family: inherit;
          transition: border-color 0.15s, background 0.15s; box-sizing: border-box;
        }
        .dp-table input[type="text"]:hover { border-color: #ccc; background: #fff; }
        .dp-table input[type="text"]:focus {
          outline: none; border-color: #667eea; background: #fff;
          box-shadow: 0 0 0 2px rgba(102,126,234,0.15);
        }
        .dp-actions { display: flex; gap: 4px; white-space: nowrap; }
        .dp-btn-save, .dp-btn-clear {
          border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer;
          font-size: 0.85em; font-weight: 600; transition: opacity 0.15s, transform 0.15s;
        }
        .dp-btn-save { background: #28a745; color: #fff; }
        .dp-btn-clear { background: #dc3545; color: #fff; }
        .dp-btn-save:hover, .dp-btn-clear:hover { opacity: 0.85; transform: translateY(-1px); }
        .dp-btn-save:disabled, .dp-btn-clear:disabled {
          opacity: 0.4; cursor: not-allowed; transform: none;
        }
        .dp-loading {
          text-align: center; padding: 48px 24px; color: #888; font-size: 1.1em;
        }
      `}</style>

      {/* ---- HEADER (always visible) ---- */}
      <div className="dp-header">
        <button className="btn-back" onClick={view === 'grid' ? () => setView('menu') : onBack}>
          ← {view === 'grid' ? 'Back' : 'Back to Sessions'}
        </button>
        <h1>Documentary Planning</h1>
        <span className="dp-time-badge">Mondays {TIME_SLOT}</span>
        {session && view === 'grid' && (
          <span className="dp-class-badge">{session.teacherEmail}</span>
        )}
      </div>

      {/* ---- MENU ---- */}
      {view === 'menu' && (
        <div className="dp-menu">
          <h2>Documentary Planning</h2>
          <p style={{ color: '#555', margin: 0 }}>Start a new plan or resume an existing one.</p>
          <div className="dp-menu-buttons">
            <button className="dp-menu-btn" onClick={() => setView('create')}>
              <div style={{ fontSize: '1.6em', marginBottom: 6 }}>+</div>
              Start New
            </button>
            <button className="dp-menu-btn" onClick={() => setView('resume')}>
              <div style={{ fontSize: '1.6em', marginBottom: 6 }}>↻</div>
              Resume Existing
            </button>
          </div>
        </div>
      )}

      {/* ---- CREATE FORM ---- */}
      {view === 'create' && (
        <div className="dp-menu">
          <div className="dp-form">
            <h3 style={{ margin: '0 0 4px' }}>Start New Plan</h3>
            <label htmlFor="dp-email">Teacher Email Address</label>
            <input
              id="dp-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="e.g. j.smith@school.org"
              autoFocus
            />
            <label htmlFor="dp-password">Password</label>
            <input
              id="dp-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Set a password for this plan"
            />
            <div className="dp-form-actions">
              <button
                className="dp-form-btn dp-form-btn-secondary"
                onClick={() => { setView('menu'); setNewEmail(''); setNewPassword(''); }}
              >
                Cancel
              </button>
              <button
                className="dp-form-btn dp-form-btn-primary"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- RESUME FORM ---- */}
      {view === 'resume' && (
        <div className="dp-menu">
          <div className="dp-form">
            <h3 style={{ margin: '0 0 4px' }}>Resume Existing Plan</h3>
            {loadingList ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#888' }}>Loading…</div>
            ) : sessionList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                No existing plans found.
              </div>
            ) : (
              <>
                <label>Select your email</label>
                <div className="dp-session-list">
                  {sessionList.map((s) => (
                    <div
                      key={s.id}
                      className={`dp-session-item ${selectedSessionId === s.id ? 'selected' : ''}`}
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      {s.teacherEmail}
                    </div>
                  ))}
                </div>
                <label htmlFor="dp-resume-pwd">Password</label>
                <input
                  id="dp-resume-pwd"
                  type="password"
                  value={resumePassword}
                  onChange={(e) => setResumePassword(e.target.value)}
                  placeholder="Enter the plan password"
                />
              </>
            )}
            <div className="dp-form-actions">
              <button
                className="dp-form-btn dp-form-btn-secondary"
                onClick={() => { setView('menu'); setSelectedSessionId(null); setResumePassword(''); }}
              >
                Cancel
              </button>
              <button
                className="dp-form-btn dp-form-btn-primary"
                onClick={handleResume}
                disabled={loading || !selectedSessionId}
              >
                {loading ? 'Loading…' : 'Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- GRID ---- */}
      {view === 'grid' && session && (
        <>
          <div className="dp-gdpr-notice">
            <strong>GDPR Reminder:</strong> Please use student initials only — do not enter full names.
          </div>

          <div className="dp-table-wrapper">
            {loading ? (
              <div className="dp-loading">Loading planning data…</div>
            ) : (
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {FIELD_LABELS.map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mondays.map((date) => {
                    const row = getRow(date);
                    const isSaving = savingDate === date;

                    return (
                      <tr key={date}>
                        <td className="dp-date-cell">{formatDateLabel(date)}</td>
                        {FIELD_LABELS.map((f) => (
                          <td key={f.key}>
                            <input
                              type="text"
                              value={row[f.key]}
                              onChange={(e) => handleFieldChange(date, f.key, e.target.value)}
                              placeholder={f.key === 'location' ? f.label : 'e.g. ABC'}
                              maxLength={f.key === 'location' ? undefined : 3}
                              onBlur={() => handleSaveRow(date)}
                              style={f.key !== 'location' ? { textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' } : undefined}
                            />
                          </td>
                        ))}
                        <td>
                          <div className="dp-actions">
                            <button
                              className="dp-btn-save"
                              onClick={() => handleSaveRow(date)}
                              disabled={isSaving}
                            >
                              {isSaving ? '…' : 'Save'}
                            </button>
                            <button
                              className="dp-btn-clear"
                              onClick={() => handleClearRow(date)}
                              disabled={isSaving}
                            >
                              Clear
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

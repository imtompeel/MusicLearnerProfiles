import React, { useEffect, useMemo, useState } from 'react';
import type { CurrentClass } from '../types';
import { useStatus } from '../hooks/useStatus';
import { firestoreSessionManager, type TAJobState } from '../utils/firestoreSessionManager';
import { generateSessionCode } from '../utils/sessionCodes';
import { renderSessionQr } from '../utils/qr';
import {
  loadTeachingAssistantJobConfig,
  mergeTeachingAssistantJobs,
  saveClassTeachingAssistantJobs,
  saveGlobalTeachingAssistantJobs,
  type TeachingAssistantJobTemplate
} from '../utils/taJobConfig';
import { TeachingAssistantTasksStudent } from './TeachingAssistantTasksStudent';

interface TeachingAssistantTasksSessionProps {
  onBack: () => void;
  currentClass?: CurrentClass | null;
}

type SaveScope = 'global' | 'class';

interface JobWithLocalState extends TeachingAssistantJobTemplate {
  // local-only ordering/index if needed in future
}

export const TeachingAssistantTasksSession: React.FC<TeachingAssistantTasksSessionProps> = ({
  onBack,
  currentClass
}) => {
  const { showSuccess, showError } = useStatus();
  const [sessionCode, setSessionCode] = useState<string>('');
  const [isLobby, setIsLobby] = useState<boolean>(false);
  const [jobs, setJobs] = useState<JobWithLocalState[]>([]);
  const [saveScope, setSaveScope] = useState<SaveScope>('class');
  const [sessionJobsState, setSessionJobsState] = useState<{ [jobId: string]: TAJobState }>({});

  const className = currentClass?.name ?? null;

  const isDevEnvironment =
    (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) ||
    (typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.env?.DEV));

  // Load templates on mount
  useEffect(() => {
    const config = loadTeachingAssistantJobConfig(className);
    const merged = mergeTeachingAssistantJobs(config);
    if (merged.length === 0) {
      // Provide some sensible defaults for first-time use
      const defaults: TeachingAssistantJobTemplate[] = [
        { id: 'set-up-instruments', title: 'Set up instruments', description: 'Lay out instruments and make sure they are ready to play.' },
        { id: 'hand-out-books', title: 'Hand out books/resources', description: 'Give out any books, worksheets, or iPads needed.' },
        { id: 'welcome-students', title: 'Welcome students at the door', description: 'Greet students as they arrive and help them settle.' }
      ];
      setJobs(defaults);
    } else {
      setJobs(merged);
    }
  }, [className]);

  // Subscribe to live session updates for jobs
  useEffect(() => {
    const unsubscribe = firestoreSessionManager.subscribe((state) => {
      if (state && state.sessionCode === sessionCode && state.jobs) {
        setSessionJobsState(state.jobs);
      }
    });
    return unsubscribe;
  }, [sessionCode]);

  const handleAddJob = () => {
    const baseId = `job-${jobs.length + 1}`;
    const newJob: TeachingAssistantJobTemplate = {
      id: baseId,
      title: 'New job',
      description: ''
    };
    setJobs(prev => [...prev, newJob]);
  };

  const handleUpdateJob = (index: number, field: 'title' | 'description', value: string) => {
    setJobs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveJob = (index: number) => {
    setJobs(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveJob = (index: number, direction: -1 | 1) => {
    setJobs(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(newIndex, 0, item);
      return copy;
    });
  };

  const persistTemplates = () => {
    if (saveScope === 'global') {
      saveGlobalTeachingAssistantJobs(jobs);
      showSuccess('Global TA job list saved.');
    } else {
      saveClassTeachingAssistantJobs(className, jobs);
      showSuccess('TA job list saved for this class.');
    }
  };

  const createLobby = async () => {
    try {
      const code = generateSessionCode();
      setSessionCode(code);

      await firestoreSessionManager.createLobby(code, [], {
        mode: 'taTasks'
      });

      const jobsMap: { [jobId: string]: TAJobState } = {};
      jobs.forEach((job) => {
        jobsMap[job.id] = {
          id: job.id,
          title: job.title,
          description: job.description ?? '',
          assignedTo: null,
          completed: false
        };
      });

      await firestoreSessionManager.setJobs(code, jobsMap);

      setIsLobby(true);
      showSuccess('Teaching Assistant Tasks lobby created. Share the link/QR with TAs.');
    } catch (e) {
      console.error(e);
      showError('Failed to create TA tasks lobby.');
    }
  };

  const generateQRCode = async () => {
    try {
      await renderSessionQr(
        sessionCode,
        { mode: 'taTasks' },
        { elementId: 'ta-tasks-qr' }
      );
    } catch (e) {
      console.error('QR generation failed:', e);
      showError('Failed to generate QR code.');
    }
  };

  useEffect(() => {
    if (isLobby && sessionCode) {
      const t = setTimeout(() => {
        generateQRCode();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isLobby, sessionCode]);

  const liveJobsList = useMemo(() => {
    const baseById: { [jobId: string]: JobWithLocalState } = {};
    jobs.forEach(j => {
      baseById[j.id] = j;
    });

    return Object.keys(baseById).map((jobId) => {
      const base = baseById[jobId];
      const state = sessionJobsState[jobId];
      return {
        id: jobId,
        title: base.title,
        description: base.description ?? '',
        assignedTo: state?.assignedTo,
        completed: state?.completed ?? false
      };
    });
  }, [jobs, sessionJobsState]);

  return (
    <div className="ta-tasks-session">
      <div className="session-header">
        <button className="btn-back" onClick={onBack}>← Back to Sessions</button>
        <h1>Teaching Assistant Tasks</h1>
        {sessionCode && (
          <div className="session-info">
            <div className="session-code">
              <strong>Session Code:</strong> {sessionCode}
            </div>
          </div>
        )}
      </div>

      <div className="session-setup">
        <div className="setup-content">
          <section className="ta-jobs-config">
            <h2>Lesson Jobs</h2>
            {className && (
              <p style={{ marginTop: 0, color: '#555' }}>
                Editing jobs for <strong>{className}</strong>
              </p>
            )}

            <div className="ta-jobs-scope-toggle" style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600, marginRight: 8 }}>Save jobs as:</label>
              <select
                value={saveScope}
                onChange={(e) => setSaveScope(e.target.value as SaveScope)}
                style={{ padding: '4px 8px', borderRadius: 6 }}
              >
                <option value="class">This class only</option>
                <option value="global">Global template</option>
              </select>
            </div>

            <div className="ta-jobs-list">
              {jobs.map((job, index) => (
                <div
                  key={job.id}
                  className="ta-job-row"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#f9fafb',
                    marginBottom: 8
                  }}
                >
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={job.title}
                      onChange={(e) => handleUpdateJob(index, 'title', e.target.value)}
                      placeholder="Job title"
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        borderRadius: 6,
                        border: '1px solid #ccc'
                      }}
                    />
                    <button
                      type="button"
                      className="btn-teacher"
                      onClick={() => handleMoveJob(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-teacher"
                      onClick={() => handleMoveJob(index, 1)}
                      disabled={index === jobs.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => handleRemoveJob(index)}
                    >
                      🗑️
                    </button>
                  </div>
                  <textarea
                    value={job.description ?? ''}
                    onChange={(e) => handleUpdateJob(index, 'description', e.target.value)}
                    placeholder="Optional description or instructions for this job"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      resize: 'vertical'
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn-teacher" onClick={handleAddJob}>
                ➕ Add Job
              </button>
              <button type="button" className="btn-teacher" onClick={persistTemplates}>
                💾 Save Jobs
              </button>
            </div>
          </section>

          {!isLobby ? (
            <section style={{ marginTop: 24 }}>
              <p>When you are ready, start the Teaching Assistant Tasks session and share the QR code with your TAs.</p>
              <button className="btn-start-session" onClick={createLobby}>
                🚀 Create TA Tasks Session
              </button>
            </section>
          ) : (
            <>
              <section style={{ marginTop: 24 }}>
                <div className="qr-code-section">
                  <h3>📱 QR Code for Teaching Assistants</h3>
                  <div className="qr-code-container">
                    <div id="ta-tasks-qr"></div>
                  </div>
                  <p>Teaching Assistants can scan this QR code to choose and complete their jobs.</p>
                  <button className="btn-copy-url" onClick={generateQRCode}>
                    ↻ Refresh QR
                  </button>
                </div>
              </section>

              {isDevEnvironment && (
                <section style={{ marginTop: 24 }}>
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px dashed #888',
                      padding: 16,
                      background: '#fdfdfd'
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>🛠 Dev Preview: TA View</h3>
                    <p style={{ fontSize: 13, color: '#555' }}>
                      This is what a Teaching Assistant sees after scanning the QR code, using the live session code.
                    </p>
                    <div style={{ maxWidth: 500, marginTop: 12 }}>
                      <TeachingAssistantTasksStudent sessionCodeOverride={sessionCode} />
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {isLobby && liveJobsList.length > 0 && (
        <div
          className="ta-jobs-live-board"
          style={{
            marginTop: 30,
            padding: '20px 24px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #e4ecf5 100%)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Live Jobs Board</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liveJobsList.map((job) => {
              const status = job.completed
                ? 'Completed'
                : job.assignedTo
                  ? 'In progress'
                  : 'Unassigned';

              const statusColor =
                status === 'Completed'
                  ? '#28a745'
                  : status === 'In progress'
                    ? '#ffc107'
                    : '#6c757d';

              return (
                <div
                  key={job.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    border: '1px solid #e2e6ea'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{job.title}</div>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: statusColor
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  {job.description && (
                    <div style={{ fontSize: 13, color: '#555' }}>{job.description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


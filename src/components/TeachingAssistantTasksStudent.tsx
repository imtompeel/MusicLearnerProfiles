import React, { useEffect, useMemo, useState } from 'react';
import { getSessionCodeFromUrl } from '../utils/routing';
import { firestoreSessionManager, type TAJobState } from '../utils/firestoreSessionManager';

interface DeviceJobState {
  activeJobId: string | null;
}

interface TeachingAssistantTasksStudentProps {
  sessionCodeOverride?: string;
}

export const TeachingAssistantTasksStudent: React.FC<TeachingAssistantTasksStudentProps> = ({
  sessionCodeOverride
}) => {
  const [sessionCode, setSessionCode] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [jobs, setJobs] = useState<{ [jobId: string]: TAJobState }>({});
  const [error, setError] = useState<string | null>(null);

  // Simple per-device storage for active job
  const [deviceJobState, setDeviceJobState] = useState<DeviceJobState>({ activeJobId: null });

  useEffect(() => {
    const code = sessionCodeOverride || getSessionCodeFromUrl();
    if (!code) {
      setError('No session code provided. Please use the correct join link from your teacher.');
      return;
    }
    setSessionCode(code);

    const existingId = localStorage.getItem('ta_device_id') || Math.random().toString(36).substr(2, 9);
    localStorage.setItem('ta_device_id', existingId);
    setDeviceId(existingId);

    const existingJobId = localStorage.getItem(`ta_active_job_${existingId}`);
    if (existingJobId) {
      setDeviceJobState({ activeJobId: existingJobId });
    }
  }, []);

  useEffect(() => {
    if (!sessionCode || !deviceId) return;

    const join = async () => {
      const joined = await firestoreSessionManager.joinSession(sessionCode);
      if (!joined) {
        setError('Could not join this session. Please check with your teacher.');
        return;
      }
      setIsJoined(true);
    };

    join();
  }, [sessionCode, deviceId]);

  useEffect(() => {
    if (!sessionCode) return;
    const unsubscribe = firestoreSessionManager.subscribe((state) => {
      if (state && state.sessionCode === sessionCode && state.jobs) {
        setJobs(state.jobs);
      }
    });
    return unsubscribe;
  }, [sessionCode]);

  const handleClaimJob = async (jobId: string) => {
    if (!sessionCode || !deviceId) return;
    try {
      await firestoreSessionManager.claimJob(sessionCode, jobId, deviceId);
      setDeviceJobState({ activeJobId: jobId });
      localStorage.setItem(`ta_active_job_${deviceId}`, jobId);
    } catch (e) {
      console.error(e);
      setError('That job was just claimed by someone else. Please choose another job.');
    }
  };

  const handleCompleteJob = async () => {
    if (!sessionCode || !deviceId || !deviceJobState.activeJobId) return;
    try {
      await firestoreSessionManager.completeJob(sessionCode, deviceJobState.activeJobId, deviceId);
      setDeviceJobState({ activeJobId: null });
      localStorage.removeItem(`ta_active_job_${deviceId}`);
    } catch (e) {
      console.error(e);
      setError('Could not mark this job as done. Please try again.');
    }
  };

  const allJobs = useMemo(() => Object.values(jobs), [jobs]);

  const activeJob: TAJobState | undefined = useMemo(() => {
    if (!deviceJobState.activeJobId) return undefined;
    return jobs[deviceJobState.activeJobId];
  }, [deviceJobState.activeJobId, jobs]);

  const unassignedJobs = useMemo(
    () => allJobs.filter((j) => !j.assignedTo && !j.completed),
    [allJobs]
  );

  if (error) {
    return (
      <div className="ta-student">
        <div className="student-join-interface">
          <div className="join-container">
            <div className="join-header">
              <h1>Teaching Assistant Tasks</h1>
            </div>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="ta-student">
        <div className="student-join-interface">
          <div className="join-container">
            <div className="join-header">
              <h1>Teaching Assistant Tasks</h1>
              {sessionCode && (
                <div className="session-code-display">
                  <span className="code-label">Session Code:</span>
                  <span className="code-value">{sessionCode}</span>
                </div>
              )}
            </div>
            <p>Joining session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeJob && !activeJob.completed) {
    return (
      <div className="ta-student">
        <div className="student-join-interface">
          <div className="join-container">
            <div className="join-header">
              <h1>Teaching Assistant Tasks</h1>
              {sessionCode && (
                <div className="session-code-display">
                  <span className="code-label">Session Code:</span>
                  <span className="code-value">{sessionCode}</span>
                </div>
              )}
            </div>

            <div className="ta-active-job">
              <h2>Your job</h2>
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 12,
                  background: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  marginBottom: 16
                }}
              >
                <h3 style={{ marginTop: 0 }}>{activeJob.title}</h3>
                {activeJob.description && (
                  <p style={{ marginBottom: 0 }}>{activeJob.description}</p>
                )}
              </div>
              <button className="btn-submit" onClick={handleCompleteJob}>
                ✅ Mark as Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ta-student">
      <div className="student-join-interface">
        <div className="join-container">
          <div className="join-header">
            <h1>Teaching Assistant Tasks</h1>
            {sessionCode && (
              <div className="session-code-display">
                <span className="code-label">Session Code:</span>
                <span className="code-value">{sessionCode}</span>
              </div>
            )}
          </div>

          <div className="ta-job-list">
            <h2>Choose a job</h2>
            {unassignedJobs.length === 0 ? (
              <p>All jobs have been claimed. Please check with your teacher if they need more help.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unassignedJobs.map((job) => (
                  <button
                    key={job.id}
                    className="activity-card"
                    type="button"
                    onClick={() => handleClaimJob(job.id)}
                    style={{ textAlign: 'left' }}
                  >
                    <div className="activity-name">{job.title}</div>
                    {job.description && (
                      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                        {job.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


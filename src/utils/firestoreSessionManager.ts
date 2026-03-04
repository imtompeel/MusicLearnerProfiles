import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface SessionMeta {
  mode?: string;
  ageBand?: 'early' | 'primary' | 'secondary';
}

export interface TAJobState {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string;
  assignedAt?: Timestamp;
  completed?: boolean;
  completedAt?: Timestamp;
}

export interface SessionState {
  isActive: boolean;
  isLobby: boolean; // New: true when session exists but hasn't started
  currentQuestion: any | null;
  timeRemaining: number;
  sessionCode: string;
  participants: { [deviceId: string]: Participant };
  currentQuestionIndex: number;
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  meta?: SessionMeta;
  jobs?: { [jobId: string]: TAJobState };
}

export interface Participant {
  name: string; // This will be stored locally, not in Firestore
  deviceId: string;
  answers: { [questionNumber: string]: string[] };
  score: number;
  joinedAt: Timestamp;
}

class FirestoreSessionManager {
  private listeners: ((state: SessionState) => void)[] = [];
  private currentSessionCode: string | null = null;
  private unsubscribeSession: (() => void) | null = null;

  // Subscribe to session state changes
  subscribe(callback: (state: SessionState) => void): () => void {
    this.listeners.push(callback);
    
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners of state changes
  private notify(state: SessionState) {
    this.listeners.forEach(listener => listener(state));
  }

  // Create a lobby (session exists but not started)
  async createLobby(sessionCode: string, _questions: any[], meta?: SessionMeta): Promise<void> {
    try {
      this.currentSessionCode = sessionCode;
      
      // Set expiration time to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      const sessionData: SessionState = {
        isActive: false,
        isLobby: true,
        currentQuestion: null,
        timeRemaining: 0,
        sessionCode,
        participants: {},
        currentQuestionIndex: -1,
        createdAt: serverTimestamp() as Timestamp,
        expiresAt: Timestamp.fromDate(expiresAt),
        meta
      };

      await setDoc(doc(db, 'sessions', sessionCode), sessionData);
      
      // Set up real-time listener for this session
      this.setupSessionListener(sessionCode);
      
      console.log('Lobby created in Firestore:', sessionCode);
    } catch (error) {
      console.error('Error creating lobby:', error);
      throw error;
    }
  }

  // Start the session (move from lobby to active)
  async startSession(sessionCode: string, questions: any[], timeRemaining: number = 30): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const sessionDoc = await getDoc(sessionRef);
      
      if (!sessionDoc.exists()) {
        throw new Error('Session not found');
      }
      
      const sessionData: Partial<SessionState> = {
        isActive: true,
        isLobby: false,
        currentQuestion: questions[0] || null,
        timeRemaining: timeRemaining,
        currentQuestionIndex: 0
      };

      await updateDoc(sessionRef, sessionData);
      
      console.log('Session started from lobby:', sessionCode);
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  // Set up real-time listener for session changes
  private setupSessionListener(sessionCode: string) {
    if (this.unsubscribeSession) {
      this.unsubscribeSession();
    }

    const sessionRef = doc(db, 'sessions', sessionCode);
    
    this.unsubscribeSession = onSnapshot(sessionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SessionState;
        console.log('Firestore session state updated:', data);
        this.notify(data);
      } else {
        console.log('Session document does not exist');
        // Session was deleted or doesn't exist
        const emptyState: SessionState = {
          isActive: false,
          isLobby: false,
          currentQuestion: null,
          timeRemaining: 0,
          sessionCode: '',
          participants: {},
          currentQuestionIndex: 0
        };
        this.notify(emptyState);
      }
    }, (error) => {
      console.error('Error listening to session:', error);
    });
  }

  // Move to next question
  async nextQuestion(questions: any[], questionIndex: number, timeRemaining: number = 30): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      const questionToSend = questions[questionIndex] || null;
      console.log('🎯 FIRESTORE: Sending question to students:', {
        questionIndex,
        questionType: questionToSend?.question_type,
        questionNumber: questionToSend?.question_number,
        hasVotingOptions: !!(questionToSend?.option1 || questionToSend?.option2 || questionToSend?.option3 || questionToSend?.option4),
        options: {
          option1: questionToSend?.option1,
          option2: questionToSend?.option2,
          option3: questionToSend?.option3,
          option4: questionToSend?.option4
        }
      });
      
      await updateDoc(sessionRef, {
        currentQuestion: questionToSend,
        timeRemaining: timeRemaining,
        currentQuestionIndex: questionIndex
      });
      
      console.log('🎯 FIRESTORE: Question sent to students successfully');
    } catch (error) {
      console.error('Error updating question:', error);
    }
  }

  // Update timer
  async updateTimer(timeRemaining: number): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      await updateDoc(sessionRef, {
        timeRemaining
      });
    } catch (error) {
      console.error('Error updating timer:', error);
    }
  }

  // Add participant to session
  async addParticipant(participant: Omit<Participant, 'joinedAt'>): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      const participantData = {
        ...participant,
        joinedAt: serverTimestamp()
      };
      
      await updateDoc(sessionRef, {
        [`participants.${participant.deviceId}`]: participantData
      });
      
      console.log('Participant added to Firestore:', participant.deviceId);
    } catch (error) {
      console.error('Error adding participant:', error);
    }
  }

  // Update participant answer
  async updateParticipantAnswer(deviceId: string, questionNumber: string, answers: string[]): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      await updateDoc(sessionRef, {
        [`participants.${deviceId}.answers.${questionNumber}`]: answers
      });
      
      console.log('Participant answer updated in Firestore:', deviceId, questionNumber, answers);
    } catch (error) {
      console.error('Error updating participant answer:', error);
    }
  }

  // End session
  async endSession(): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      await updateDoc(sessionRef, {
        isActive: false,
        currentQuestion: null,
        timeRemaining: 0,
        currentQuestionIndex: 0
      });
      
      console.log('Session ended in Firestore:', this.currentSessionCode);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  // Update session questions (for dynamic question content like voting options)
  async updateSessionQuestions(sessionCode: string, questions: any[]): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      console.log('🎯 FIRESTORE: Updating questions array with voting options');
      await updateDoc(sessionRef, {
        questions: questions
      });
      
      console.log('🎯 FIRESTORE: Questions array updated successfully');
    } catch (error) {
      console.error('Error updating session questions:', error);
    }
  }

  // Clear session data
  async clearSession(): Promise<void> {
    if (!this.currentSessionCode) return;
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      await deleteDoc(sessionRef);
      
      if (this.unsubscribeSession) {
        this.unsubscribeSession();
        this.unsubscribeSession = null;
      }
      
      this.currentSessionCode = null;
      console.log('Session cleared from Firestore');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  // Get current state (for initial load)
  async getState(): Promise<SessionState> {
    if (!this.currentSessionCode) {
      return {
        isActive: false,
        isLobby: false,
        currentQuestion: null,
        timeRemaining: 0,
        sessionCode: '',
        participants: {},
        currentQuestionIndex: 0
      };
    }
    
    try {
      const sessionRef = doc(db, 'sessions', this.currentSessionCode);
      const docSnap = await getDoc(sessionRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as SessionState;
      } else {
        return {
          isActive: false,
          isLobby: false,
          currentQuestion: null,
          timeRemaining: 0,
          sessionCode: '',
          participants: {},
          currentQuestionIndex: 0
        };
      }
    } catch (error) {
      console.error('Error getting session state:', error);
      return {
        isActive: false,
        isLobby: false,
        currentQuestion: null,
        timeRemaining: 0,
        sessionCode: '',
        participants: {},
        currentQuestionIndex: 0
      };
    }
  }

  // Join a session (for students)
  async joinSession(sessionCode: string): Promise<boolean> {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const docSnap = await getDoc(sessionRef);
      
      if (docSnap.exists()) {
        this.currentSessionCode = sessionCode;
        this.setupSessionListener(sessionCode);
        return true;
      } else {
        console.log('Session not found:', sessionCode);
        return false;
      }
    } catch (error) {
      console.error('Error joining session:', error);
      return false;
    }
  }

  // Export session data for teacher
  async exportSessionData(sessionCode: string): Promise<any> {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      const docSnap = await getDoc(sessionRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          sessionCode,
          exportedAt: new Date().toISOString(),
          ...data
        };
      } else {
        throw new Error('Session not found');
      }
    } catch (error) {
      console.error('Error exporting session data:', error);
      throw error;
    }
  }

  // Clean up expired sessions (can be called periodically)
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessionsRef = collection(db, 'sessions');
      const q = query(sessionsRef, where('expiresAt', '<', serverTimestamp()));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`Cleaned up ${querySnapshot.docs.length} expired sessions`);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // Set or replace the TA jobs map for a session
  async setJobs(sessionCode: string, jobs: { [jobId: string]: TAJobState }): Promise<void> {
    try {
      const sessionRef = doc(db, 'sessions', sessionCode);
      await updateDoc(sessionRef, { jobs });
      console.log('TA jobs set for session:', sessionCode);
    } catch (error) {
      console.error('Error setting TA jobs:', error);
      throw error;
    }
  }

  // Claim a job for a specific deviceId using a Firestore transaction (first-come-first-served)
  async claimJob(sessionCode: string, jobId: string, deviceId: string): Promise<void> {
    const sessionRef = doc(db, 'sessions', sessionCode);

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(sessionRef);
      if (!docSnap.exists()) {
        throw new Error('Session not found');
      }

      const data = docSnap.data() as SessionState;
      const existingJobs = data.jobs || {};
      const job = existingJobs[jobId];

      if (!job) {
        throw new Error('Job not found');
      }

      // If already assigned to someone else, do nothing / fail fast
      if (job.assignedTo && job.assignedTo !== deviceId) {
        throw new Error('Job already claimed by another device');
      }

      const updatedJob: TAJobState = {
        ...job,
        assignedTo: deviceId,
        assignedAt: serverTimestamp() as Timestamp
      };

      transaction.update(sessionRef, {
        [`jobs.${jobId}`]: updatedJob
      });
    });
  }

  // Mark a job as completed by the device that claimed it
  async completeJob(sessionCode: string, jobId: string, deviceId: string): Promise<void> {
    const sessionRef = doc(db, 'sessions', sessionCode);

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(sessionRef);
      if (!docSnap.exists()) {
        throw new Error('Session not found');
      }

      const data = docSnap.data() as SessionState;
      const existingJobs = data.jobs || {};
      const job = existingJobs[jobId];

      if (!job) {
        throw new Error('Job not found');
      }

      // Only the device that claimed the job can complete it
      if (job.assignedTo && job.assignedTo !== deviceId) {
        throw new Error('Only the assigned device can complete this job');
      }

      const updatedJob: TAJobState = {
        ...job,
        assignedTo: job.assignedTo || deviceId,
        assignedAt: job.assignedAt || (serverTimestamp() as Timestamp),
        completed: true,
        completedAt: serverTimestamp() as Timestamp
      };

      transaction.update(sessionRef, {
        [`jobs.${jobId}`]: updatedJob
      });
    });
  }
}

// Create singleton instance
export const firestoreSessionManager = new FirestoreSessionManager();

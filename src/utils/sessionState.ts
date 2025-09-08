/**
 * Simple shared state management for session data
 * Uses localStorage for cross-tab communication
 */

interface SessionState {
  isActive: boolean;
  currentQuestion: any;
  timeRemaining: number;
  sessionCode: string;
  participants: any[];
  currentQuestionIndex: number;
}

const STORAGE_KEY = 'creativity_session_state';

class SessionManager {
  private state: SessionState = {
    isActive: false,
    currentQuestion: null,
    timeRemaining: 0,
    sessionCode: '',
    participants: [],
    currentQuestionIndex: 0
  };

  private listeners: ((state: SessionState) => void)[] = [];

  constructor() {
    // Listen for storage changes (cross-tab communication)
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Load initial state from localStorage
    this.loadFromStorage();
  }

  // Handle storage changes from other tabs
  private handleStorageChange(e: StorageEvent) {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const newState = JSON.parse(e.newValue);
        this.state = newState;
        this.notify();
      } catch (error) {
        console.error('Error parsing session state from storage:', error);
      }
    }
  }

  // Save state to localStorage
  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('Error saving session state to storage:', error);
    }
  }

  // Load state from localStorage
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        this.state = { ...this.state, ...parsedState };
      }
    } catch (error) {
      console.error('Error loading session state from storage:', error);
    }
  }

  // Subscribe to state changes
  subscribe(listener: (state: SessionState) => void) {
    this.listeners.push(listener);
    // Immediately call with current state
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Update state and notify listeners
  private notify() {
    this.saveToStorage();
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get current state
  getState(): SessionState {
    return { ...this.state };
  }

  // Update session state
  updateSession(updates: Partial<SessionState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // Start a new session
  startSession(sessionCode: string, questions: any[]) {
    this.state = {
      isActive: true,
      currentQuestion: questions[0] || null,
      timeRemaining: 30,
      sessionCode,
      participants: this.state.participants || [], // Preserve existing participants
      currentQuestionIndex: 0
    };
    this.notify();
  }

  // Move to next question
  nextQuestion(questions: any[], questionIndex: number) {
    if (questionIndex < questions.length) {
      this.state.currentQuestion = questions[questionIndex];
      this.state.timeRemaining = 30;
      this.state.currentQuestionIndex = questionIndex;
      this.notify();
    }
  }

  // Update timer
  updateTimer(timeRemaining: number) {
    this.state.timeRemaining = timeRemaining;
    this.notify();
  }

  // Add participant
  addParticipant(participant: any) {
    this.state.participants = [...this.state.participants, participant];
    this.notify();
  }

  // Update participant answer
  updateParticipantAnswer(deviceId: string, questionNumber: string, answers: string[]) {
    this.state.participants = this.state.participants.map(participant => 
      participant.deviceId === deviceId 
        ? { ...participant, answers: { ...participant.answers, [questionNumber]: answers } }
        : participant
    );
    this.notify();
  }

  // End session
  endSession() {
    this.state.isActive = false;
    this.state.currentQuestion = null;
    this.state.timeRemaining = 0;
    this.state.currentQuestionIndex = 0;
    this.notify();
  }

  // Clear session data
  clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = {
      isActive: false,
      currentQuestion: null,
      timeRemaining: 0,
      sessionCode: '',
      participants: [],
      currentQuestionIndex: 0
    };
    this.notify();
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();

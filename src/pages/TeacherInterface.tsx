import React, { useState, useEffect } from 'react';
import { TeacherControls } from '../components/TeacherControls';
import { ClassSelection } from '../components/ClassSelection';
import { StudentSection } from '../components/StudentSection';
import { FreesoundSession } from '../components/FreesoundSession';
import { CreativitySession } from '../components/CreativitySession';
import { ClassPlanningSession } from '../components/ClassPlanningSession';
import { SoundMatchingSession } from '../components/SoundMatchingSession';
import { MusicWhoAreYouSession } from '../components/MusicWhoAreYouSession';
import { Status } from '../components/Status';
import { NowNextSession } from '../components/NowNextSession';
import { HowAreYouFeelingSession } from '../components/HowAreYouFeelingSession';
import { HandGestureSession } from '../components/HandGestureSession';
import { InstrumentLibrarySession } from '../components/InstrumentLibrarySession';
import { TeachingAssistantTasksSession } from '../components/TeachingAssistantTasksSession';
import { DocumentaryPlanningSession } from '../components/DocumentaryPlanningSession';
import { useStudentData } from '../hooks/useStudentData';
import { useStatus } from '../hooks/useStatus';
import { useAudio } from '../hooks/useAudio';
import type { CurrentClass, MusicQuestion } from '../types';
import { musicQuestionsData } from '../data/musicQuestions';

// Sessions that require a class to be selected
const SESSIONS_REQUIRING_CLASS = [
  'Music Who Are You?',
  'My Creativity',
  'Class Planning Session',
  'Sound Matching Session',
  'Now & Next'
];

/**
 * Main teacher interface for managing classes and sessions
 */
export const TeacherInterface: React.FC = () => {
  const { studentData, addStudent, clearAllData } = useStudentData();
  const { status, showSuccess, hideStatus } = useStatus();
  useAudio();

  const [currentClass, setCurrentClass] = useState<CurrentClass | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<MusicQuestion[]>([]);
  const [isClassSelectionVisible, setIsClassSelectionVisible] = useState(true);

  useEffect(() => {
    // Only load questions for sessions that require a class and have both class and session selected
    if (currentClass && currentSession && SESSIONS_REQUIRING_CLASS.includes(currentSession)) {
      // Get questions for the selected session and class level
      const questions = musicQuestionsData.filter(q => 
        q.session_type === currentSession && 
        q.class_level === currentClass.soiMedian
      );
      
      questions.sort((a, b) => parseInt(a.question_number) - parseInt(b.question_number));
      setSessionQuestions(questions);
      
      showSuccess(`Music Who Are You? session for class "${currentClass.name}" (SoI Level: ${currentClass.soiMedian}) loaded successfully!`);
      
      // Auto-hide the success message after 3 seconds
      setTimeout(() => {
        hideStatus();
      }, 3000);
    } else if (currentSession && !SESSIONS_REQUIRING_CLASS.includes(currentSession)) {
      // Clear questions for sessions that don't require a class
      setSessionQuestions([]);
    }
  }, [currentClass, currentSession, showSuccess, hideStatus]);

  const handleClassSelect = (selectedClass: CurrentClass) => {
    setCurrentClass(selectedClass);
  };

  const handleSessionSelect = (session: string) => {
    setCurrentSession(session);
    // Clear class selection if switching to a session that doesn't require a class
    if (session && !SESSIONS_REQUIRING_CLASS.includes(session)) {
      setCurrentClass(null);
    }
  };

  const handleSaveStudent = (studentData: any) => {
    addStudent(studentData);
    showSuccess(`Preferences for ${studentData.name} saved successfully!`);
    
    setTimeout(() => {
      hideStatus();
    }, 2000);
  };

  const handleClearAllData = () => {
    clearAllData();
    showSuccess('All data cleared successfully!');
    setTimeout(() => hideStatus(), 2000);
  };

  const handleToggleClassSelection = () => {
    setIsClassSelectionVisible(!isClassSelectionVisible);
  };

  const handleBackToSessions = () => {
    setCurrentSession(null);
    setSessionQuestions([]);
    // Note: We don't clear currentClass here as the user might want to keep it selected
    // The ClassSelection component will handle clearing it when switching sessions
  };

  // Render Freesound Session if selected
  if (currentSession === 'Freesound Session') {
    return (
      <div className="container">
        <FreesoundSession onBack={handleBackToSessions} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render My Creativity Session if selected
  if (currentSession === 'My Creativity') {
    return (
      <div className="container">
        <CreativitySession onBack={handleBackToSessions} currentClass={currentClass} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Class Planning Session if selected
  if (currentSession === 'Class Planning Session') {
    return (
      <div className="container">
        <ClassPlanningSession onBack={handleBackToSessions} currentClass={currentClass} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Sound Matching Session if selected
  if (currentSession === 'Sound Matching Session') {
    return (
      <div className="container">
        <SoundMatchingSession onBack={handleBackToSessions} currentClass={currentClass} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Now & Next if selected
  if (currentSession === 'Now & Next') {
    return (
      <div className="container">
        <NowNextSession onBack={handleBackToSessions} currentClass={currentClass} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render How Are You Feeling if selected
  if (currentSession === 'How Are You Feeling') {
    return (
      <div className="container">
        <HowAreYouFeelingSession onBack={handleBackToSessions} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Gesture Session if selected
  if (currentSession === 'Gesture Session') {
    return (
      <div className="container">
        <HandGestureSession onBack={handleBackToSessions} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Music Who Are You? if selected
  if (currentSession === 'Music Who Are You?') {
    return (
      <div className="container">
        <MusicWhoAreYouSession 
          onBack={handleBackToSessions}
          currentClass={currentClass}
          sessionQuestions={sessionQuestions}
          onSaveStudent={handleSaveStudent}
        />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Instrument Library if selected
  if (currentSession === 'Instrument Library') {
    return (
      <div className="container">
        <InstrumentLibrarySession onBack={handleBackToSessions} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Teaching Assistant Tasks if selected
  if (currentSession === 'Teaching Assistant Tasks') {
    return (
      <div className="container">
        <TeachingAssistantTasksSession onBack={handleBackToSessions} currentClass={currentClass} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  // Render Documentary Planning if selected
  if (currentSession === 'Documentary Planning') {
    return (
      <div className="container">
        <DocumentaryPlanningSession onBack={handleBackToSessions} />
        <Status message={status.message} type={status.type} />
      </div>
    );
  }

  return (
    <div className="container">
      <TeacherControls
        studentData={studentData}
        sessionQuestions={sessionQuestions}
        onClearAllData={handleClearAllData}
        onToggleClassSelection={handleToggleClassSelection}
        isClassSelectionVisible={isClassSelectionVisible}
      />

      {isClassSelectionVisible && (
        <ClassSelection
          onClassSelect={handleClassSelect}
          onSessionSelect={handleSessionSelect}
        />
      )}

      <StudentSection
        currentClass={currentClass}
        currentSession={currentSession}
        sessionQuestions={sessionQuestions}
        onSaveStudent={handleSaveStudent}
      />
      
      <Status message={status.message} type={status.type} />
      <div className="visual-feedback" id="visualFeedback">🎵</div>
    </div>
  );
};

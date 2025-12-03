import React, { useState, useEffect } from 'react';
import { TeacherControls } from '../components/TeacherControls';
import { ClassSelection } from '../components/ClassSelection';
import { StudentSection } from '../components/StudentSection';
import { FreesoundSession } from '../components/FreesoundSession';
import { CreativitySession } from '../components/CreativitySession';
import { ClassPlanningSession } from '../components/ClassPlanningSession';
import { SoundMatchingSession } from '../components/SoundMatchingSession';
import { Status } from '../components/Status';
import { NowNextSession } from '../components/NowNextSession';
import { HowAreYouFeelingSession } from '../components/HowAreYouFeelingSession';
import { useStudentData } from '../hooks/useStudentData';
import { useStatus } from '../hooks/useStatus';
import { useAudio } from '../hooks/useAudio';
import type { CurrentClass, MusicQuestion } from '../types';
import { musicQuestionsData } from '../data/musicQuestions';

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
    if (currentClass && currentSession) {
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
    }
  }, [currentClass, currentSession, showSuccess, hideStatus]);

  const handleClassSelect = (selectedClass: CurrentClass) => {
    setCurrentClass(selectedClass);
  };

  const handleSessionSelect = (session: string) => {
    setCurrentSession(session);
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

import React, { useState } from 'react';
import type { CurrentClass, StudentPreference } from '../types';
import { NameEntry } from './NameEntry';
import { Preferences } from './Preferences';

interface StudentSectionProps {
  currentClass: CurrentClass | null;
  currentSession: string | null;
  sessionQuestions: any[];
  onSaveStudent: (studentData: any) => void;
}

export const StudentSection: React.FC<StudentSectionProps> = ({
  currentClass,
  currentSession,
  sessionQuestions,
  onSaveStudent
}) => {
  const [currentStep, setCurrentStep] = useState<'name' | 'preferences'>('name');
  const [studentName, setStudentName] = useState('');

  const handleSaveName = (name: string) => {
    if (!currentClass || !currentSession) {
      return;
    }
    setStudentName(name);
    setCurrentStep('preferences');
  };

  const handleSavePreferences = (preferences: { [key: string]: StudentPreference | string | string[] }) => {
    if (!currentClass || !currentSession) {
      return;
    }

    const timestamp = new Date().toISOString();
    const studentEntry = {
      class: currentClass.name,
      session: currentSession,
      name: studentName,
      timestamp: timestamp,
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-GB'),
      soi_level: currentClass.soiMedian,
      ...preferences
    };

    onSaveStudent(studentEntry);
    
    // Reset to name entry
    setCurrentStep('name');
    setStudentName('');
  };

  const handleBackToName = () => {
    setCurrentStep('name');
    setStudentName('');
  };

  if (!currentClass || !currentSession) {
    return null;
  }

  return (
    <div className="student-section">
      {currentStep === 'name' ? (
        <NameEntry onSaveName={handleSaveName} />
      ) : (
        <Preferences
          studentName={studentName}
          sessionQuestions={sessionQuestions}
          currentClass={currentClass}
          onSavePreferences={handleSavePreferences}
          onBackToName={handleBackToName}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import type { CurrentClass, StudentPreference } from '../types';
import { NameEntry } from './NameEntry';
import { Preferences } from './Preferences';

interface MusicWhoAreYouSessionProps {
  onBack: () => void;
  currentClass: CurrentClass | null;
  sessionQuestions: any[];
  onSaveStudent: (studentData: any) => void;
}

export const MusicWhoAreYouSession: React.FC<MusicWhoAreYouSessionProps> = ({
  onBack,
  currentClass,
  sessionQuestions,
  onSaveStudent
}) => {
  const [currentStep, setCurrentStep] = useState<'name' | 'preferences'>('name');
  const [studentName, setStudentName] = useState('');

  const handleSaveName = (name: string) => {
    if (!currentClass) {
      return;
    }
    setStudentName(name);
    setCurrentStep('preferences');
  };

  const handleSavePreferences = (preferences: { [key: string]: StudentPreference | string | string[] }) => {
    if (!currentClass) {
      return;
    }

    const timestamp = new Date().toISOString();
    const studentEntry = {
      class: currentClass.name,
      session: 'Music Who Are You?',
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

  if (!currentClass) {
    return null;
  }

  return (
    <div className="music-who-are-you-session">
      <div className="session-header">
        <button 
          onClick={onBack}
          className="back-button"
          style={{
            background: 'linear-gradient(145deg, #667eea, #5a6fd8)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1em',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}
        >
          ← Back to Activities
        </button>
        <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>
          Music Who Are You? - {currentClass.name}
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          SoI Level: {currentClass.soiMedian}
        </p>
      </div>
      
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
    </div>
  );
};

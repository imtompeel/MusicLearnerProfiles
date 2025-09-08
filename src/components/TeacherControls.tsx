import React, { useState } from 'react';
import { downloadCSV } from '../utils/csv';
import type { StudentData, MusicQuestion } from '../types';

interface TeacherControlsProps {
  studentData: StudentData[];
  sessionQuestions: MusicQuestion[];
  onClearAllData: () => void;
  onToggleClassSelection: () => void;
  isClassSelectionVisible: boolean;
}

export const TeacherControls: React.FC<TeacherControlsProps> = ({
  studentData,
  sessionQuestions,
  onClearAllData,
  onToggleClassSelection,
  isClassSelectionVisible
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        (document.documentElement as any).msRequestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  const handleDownloadCSV = () => {
    try {
      downloadCSV(studentData, sessionQuestions);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to clear all student data? This cannot be undone.')) {
      onClearAllData();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="teacher-controls">
      <div className="teacher-info" onClick={toggleCollapse} style={{ cursor: 'pointer' }}>
        <h3>👨‍🏫 Teacher Controls {isCollapsed ? '▶️' : '🔽'}</h3>
        {!isCollapsed && <p>Manage classes and download data</p>}
      </div>
      {!isCollapsed && (
        <div className="teacher-buttons">
        <button 
          className="btn-teacher" 
          onClick={onToggleClassSelection}
        >
          {isClassSelectionVisible ? '📚 Hide Class Selection' : '📚 Show Class Selection'}
        </button>
        <button 
          className="btn-teacher" 
          onClick={toggleFullScreen}
        >
          {isFullScreen ? '📱 Exit Full Screen' : '🖥️ Full Screen'}
        </button>
        <button 
          className="btn-teacher" 
          onClick={handleDownloadCSV}
        >
          📥 Download Data
        </button>
        <button 
          className="btn-teacher" 
          onClick={handleClearAllData}
        >
          🗑️ Clear All Data
        </button>
        </div>
      )}
    </div>
  );
};

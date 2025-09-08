import React from 'react';
import { TeacherInterface } from '../pages/TeacherInterface';
import { StudentJoinPage } from '../pages/StudentJoinPage';
import { isStudentMode } from '../utils/routing';

/**
 * Main router component that determines which interface to show
 * based on URL parameters
 */
export const AppRouter: React.FC = () => {
  // Check if we're in student mode
  if (isStudentMode()) {
    return <StudentJoinPage />;
  }

  // Default to teacher interface
  return <TeacherInterface />;
};

import React from 'react';
import { TeacherInterface } from '../pages/TeacherInterface';
import { StudentJoinPage } from '../pages/StudentJoinPage';
import { isStudentMode, parseRouteParams } from '../utils/routing';
import { StudentFeelingSession } from './StudentFeelingSession';
import { TeachingAssistantTasksStudent } from './TeachingAssistantTasksStudent';

/**
 * Main router component that determines which interface to show
 * based on URL parameters
 */
export const AppRouter: React.FC = () => {
  // Check if we're in student mode
  if (isStudentMode()) {
    const { mode } = parseRouteParams();
    if (mode === 'feeling') {
      return <StudentFeelingSession />;
    }
    if (mode === 'taTasks') {
      return <TeachingAssistantTasksStudent />;
    }
    return <StudentJoinPage />;
  }

  // Default to teacher interface
  return <TeacherInterface />;
};

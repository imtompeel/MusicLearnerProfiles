import React from 'react';
import { TeacherInterface } from '../pages/TeacherInterface';
import { StudentJoinPage } from '../pages/StudentJoinPage';
import { isStudentMode, parseRouteParams } from '../utils/routing';
import { StudentFeelingSession } from './StudentFeelingSession';
import { TeachingAssistantTasksStudent } from './TeachingAssistantTasksStudent';
import { AuthGate } from './AuthGate';

export const AppRouter: React.FC = () => {
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

  return (
    <AuthGate>
      <TeacherInterface />
    </AuthGate>
  );
};

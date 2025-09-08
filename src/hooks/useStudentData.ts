import { useState, useEffect } from 'react';
import type { StudentData } from '../types';
import { loadStudentData, addStudentData, clearStudentData } from '../utils/storage';

export function useStudentData() {
  const [studentData, setStudentData] = useState<StudentData[]>([]);

  useEffect(() => {
    setStudentData(loadStudentData());
  }, []);

  const addStudent = (student: StudentData) => {
    const newData = [...studentData, student];
    setStudentData(newData);
    addStudentData(student);
  };

  const clearAllData = () => {
    setStudentData([]);
    clearStudentData();
  };

  const getDataSummary = () => {
    if (studentData.length === 0) {
      return 'No data to show!';
    }

    const summary = `Total Students: ${studentData.length}\n\nRecent entries:\n` + 
      studentData.slice(-5).map(student => 
        `• ${student.name} (${student.class}) - ${student.date}`
      ).join('\n');

    return summary;
  };

  return {
    studentData,
    addStudent,
    clearAllData,
    getDataSummary
  };
}

import type { StudentData, MusicQuestion } from '../types';

// Parse CSV text
export function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: any = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].replace(/"/g, '') : '';
    });
    data.push(row);
  }

  return data;
}

// Download CSV
export function downloadCSV(studentData: StudentData[], sessionQuestions: MusicQuestion[]): void {
  if (studentData.length === 0) {
    throw new Error('No data to download!');
  }

  const headers = ['Class', 'Session', 'Name', 'Date', 'Time', 'Timestamp', 'SoI Level'];
  sessionQuestions.forEach(q => {
    if (q.question_type === 'search') {
      headers.push(`Q${q.question_number}_Artist`, `Q${q.question_number}_Track`);
    } else {
      headers.push(`Q${q.question_number}`);
    }
  });

  const csvContent = [
    headers.join(','),
    ...studentData.map(student => {
      const row = [
        `"${student.class}"`,
        `"${student.session}"`,
        `"${student.name}"`,
        student.date,
        student.time,
        student.timestamp,
        student.soi_level
      ];
      
      sessionQuestions.forEach(q => {
        const value = student[q.question_number] || '';
        if (q.question_type === 'search' && typeof value === 'object') {
          row.push(`"${value.artist_name || ''}"`, `"${value.track_name || ''}"`);
        } else {
          row.push(`"${Array.isArray(value) ? value.join(';') : value}"`);
        }
      });
      
      return row.join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `student_profiles_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

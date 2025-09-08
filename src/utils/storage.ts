import type { ClassData, StudentData } from '../types';
import { defaultClasses } from '../data/defaultClasses';

// Local storage keys
const STORAGE_KEYS = {
  STUDENT_DATA: 'studentData',
  DYNAMIC_CLASSES: 'dynamicClasses'
} as const;

// Student data management
export function loadStudentData(): StudentData[] {
  const saved = localStorage.getItem(STORAGE_KEYS.STUDENT_DATA);
  return saved ? JSON.parse(saved) : [];
}

export function saveStudentData(data: StudentData[]): void {
  localStorage.setItem(STORAGE_KEYS.STUDENT_DATA, JSON.stringify(data));
}

export function addStudentData(student: StudentData): void {
  const existingData = loadStudentData();
  existingData.push(student);
  saveStudentData(existingData);
}

export function clearStudentData(): void {
  localStorage.removeItem(STORAGE_KEYS.STUDENT_DATA);
}

// Class data management
export function loadClasses(): ClassData[] {
  const saved = localStorage.getItem(STORAGE_KEYS.DYNAMIC_CLASSES);
  return saved ? JSON.parse(saved) : defaultClasses;
}

export function saveClasses(classes: ClassData[]): void {
  localStorage.setItem(STORAGE_KEYS.DYNAMIC_CLASSES, JSON.stringify(classes));
}

export function addClass(newClass: ClassData): void {
  const existingClasses = loadClasses();
  existingClasses.push(newClass);
  saveClasses(existingClasses);
}

export function updateClass(index: number, updatedClass: ClassData): void {
  const existingClasses = loadClasses();
  existingClasses[index] = updatedClass;
  saveClasses(existingClasses);
}

export function deleteClass(index: number): void {
  const existingClasses = loadClasses();
  existingClasses.splice(index, 1);
  saveClasses(existingClasses);
}

export function initializeClasses(): ClassData[] {
  const savedClasses = loadClasses();
  if (savedClasses.length === 0) {
    saveClasses(defaultClasses);
    return defaultClasses;
  }
  return savedClasses;
}

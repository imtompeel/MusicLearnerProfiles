import { useState, useEffect } from 'react';
import type { ClassData } from '../types';
import { 
  loadClassesFromFirestore,
  addClassToFirestore,
  updateClassInFirestore,
  deleteClassFromFirestore,
  getClassIdByName,
  subscribeToClasses
} from '../utils/firestoreClasses';

export function useClasses() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial classes
    const loadInitialClasses = async () => {
      try {
        setLoading(true);
        setError(null);
        const initialClasses = await loadClassesFromFirestore();
        setClasses(initialClasses);
      } catch (err) {
        console.error('Error loading initial classes:', err);
        setError('Failed to load classes');
      } finally {
        setLoading(false);
      }
    };

    loadInitialClasses();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToClasses(
      (updatedClasses) => {
        setClasses(updatedClasses);
        setError(null);
      },
      (err) => {
        console.error('Error in classes subscription:', err);
        setError('Failed to sync classes');
      }
    );

    return () => unsubscribe();
  }, []);

  const addNewClass = async (newClass: ClassData) => {
    try {
      setError(null);
      await addClassToFirestore(newClass);
      // The real-time subscription will update the classes state
    } catch (err) {
      console.error('Error adding class:', err);
      setError('Failed to add class');
      throw err;
    }
  };

  const updateExistingClass = async (index: number, updatedClass: ClassData) => {
    try {
      setError(null);
      const classToUpdate = classes[index];
      const classId = await getClassIdByName(classToUpdate.class_name);
      
      if (!classId) {
        throw new Error('Class not found in Firestore');
      }
      
      await updateClassInFirestore(classId, updatedClass);
      // The real-time subscription will update the classes state
    } catch (err) {
      console.error('Error updating class:', err);
      setError('Failed to update class');
      throw err;
    }
  };

  const removeClass = async (index: number) => {
    try {
      setError(null);
      const classToDelete = classes[index];
      const classId = await getClassIdByName(classToDelete.class_name);
      
      if (!classId) {
        throw new Error('Class not found in Firestore');
      }
      
      await deleteClassFromFirestore(classId);
      // The real-time subscription will update the classes state
    } catch (err) {
      console.error('Error deleting class:', err);
      setError('Failed to delete class');
      throw err;
    }
  };

  const refreshClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const refreshedClasses = await loadClassesFromFirestore();
      setClasses(refreshedClasses);
    } catch (err) {
      console.error('Error refreshing classes:', err);
      setError('Failed to refresh classes');
    } finally {
      setLoading(false);
    }
  };

  return {
    classes,
    loading,
    error,
    addNewClass,
    updateExistingClass,
    removeClass,
    refreshClasses
  };
}

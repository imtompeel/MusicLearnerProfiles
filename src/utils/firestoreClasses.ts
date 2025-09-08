import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy,
  writeBatch,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ClassData } from '../types';
import { defaultClasses } from '../data/defaultClasses';

const CLASSES_COLLECTION = 'classes';

// Load all classes from Firestore
export async function loadClassesFromFirestore(): Promise<ClassData[]> {
  try {
    const classesRef = collection(db, CLASSES_COLLECTION);
    const q = query(classesRef, orderBy('class_name'));
    const querySnapshot = await getDocs(q);
    
    const classes: ClassData[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      classes.push({
        class_name: data.class_name,
        soi_median: data.soi_median
      });
    });
    
    // If no classes exist, initialize with default classes
    if (classes.length === 0) {
      await initializeDefaultClasses();
      return defaultClasses;
    }
    
    return classes;
  } catch (error) {
    console.error('Error loading classes from Firestore:', error);
    // Fallback to default classes if Firestore fails
    return defaultClasses;
  }
}

// Initialize default classes in Firestore
export async function initializeDefaultClasses(): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    defaultClasses.forEach((classData) => {
      const docRef = doc(collection(db, CLASSES_COLLECTION));
      batch.set(docRef, classData);
    });
    
    await batch.commit();
    console.log('Default classes initialized in Firestore');
  } catch (error) {
    console.error('Error initializing default classes:', error);
    throw error;
  }
}

// Add a new class to Firestore
export async function addClassToFirestore(newClass: ClassData): Promise<void> {
  try {
    await addDoc(collection(db, CLASSES_COLLECTION), newClass);
  } catch (error) {
    console.error('Error adding class to Firestore:', error);
    throw error;
  }
}

// Update an existing class in Firestore
export async function updateClassInFirestore(classId: string, updatedClass: ClassData): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    await updateDoc(classRef, {
      class_name: updatedClass.class_name,
      soi_median: updatedClass.soi_median
    });
  } catch (error) {
    console.error('Error updating class in Firestore:', error);
    throw error;
  }
}

// Delete a class from Firestore
export async function deleteClassFromFirestore(classId: string): Promise<void> {
  try {
    const classRef = doc(db, CLASSES_COLLECTION, classId);
    await deleteDoc(classRef);
  } catch (error) {
    console.error('Error deleting class from Firestore:', error);
    throw error;
  }
}

// Get class document ID by class name
export async function getClassIdByName(className: string): Promise<string | null> {
  try {
    const classesRef = collection(db, CLASSES_COLLECTION);
    const q = query(classesRef, orderBy('class_name'));
    const querySnapshot = await getDocs(q);
    
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      if (data.class_name === className) {
        return docSnapshot.id;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting class ID by name:', error);
    return null;
  }
}

// Subscribe to real-time updates for classes
export function subscribeToClasses(
  onUpdate: (classes: ClassData[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const classesRef = collection(db, CLASSES_COLLECTION);
  const q = query(classesRef, orderBy('class_name'));
  
  return onSnapshot(
    q,
    (querySnapshot) => {
      const classes: ClassData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        classes.push({
          class_name: data.class_name,
          soi_median: data.soi_median
        });
      });
      onUpdate(classes);
    },
    (error) => {
      console.error('Error in classes subscription:', error);
      if (onError) {
        onError(error);
      }
    }
  );
}

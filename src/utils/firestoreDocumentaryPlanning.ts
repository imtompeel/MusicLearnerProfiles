import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'documentary_planning';

export interface DocumentaryRowData {
  interviewer: string;
  interviewee: string;
  location: string;
  director: string;
  cameraPerson: string;
  linkOperator: string;
}

export interface DocumentaryPlanningSession {
  id: string;
  teacherEmail: string;
  password: string;
  entries: { [date: string]: DocumentaryRowData };
}

export async function listDocumentaryPlanningSessions(): Promise<Pick<DocumentaryPlanningSession, 'id' | 'teacherEmail'>[]> {
  try {
    const ref = collection(db, COLLECTION);
    const snapshot = await getDocs(ref);
    const sessions: Pick<DocumentaryPlanningSession, 'id' | 'teacherEmail'>[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      sessions.push({ id: docSnap.id, teacherEmail: data.teacherEmail ?? '' });
    });
    sessions.sort((a, b) => a.teacherEmail.localeCompare(b.teacherEmail));
    return sessions;
  } catch (error) {
    console.error('Error listing documentary planning sessions:', error);
    throw error;
  }
}

export async function loadDocumentaryPlanningSession(id: string): Promise<DocumentaryPlanningSession | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      teacherEmail: data.teacherEmail ?? '',
      password: data.password ?? '',
      entries: data.entries ?? {},
    };
  } catch (error) {
    console.error('Error loading documentary planning session:', error);
    throw error;
  }
}

export async function createDocumentaryPlanningSession(
  teacherEmail: string,
  password: string
): Promise<DocumentaryPlanningSession> {
  const id = `dp-${teacherEmail.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
  const session: DocumentaryPlanningSession = { id, teacherEmail, password, entries: {} };
  try {
    await setDoc(doc(db, COLLECTION, id), {
      teacherEmail,
      password,
      entries: {},
      createdAt: serverTimestamp(),
    });
    return session;
  } catch (error) {
    console.error('Error creating documentary planning session:', error);
    throw error;
  }
}

export async function saveDocumentaryPlanningEntries(
  sessionId: string,
  entries: { [date: string]: DocumentaryRowData }
): Promise<void> {
  try {
    await setDoc(
      doc(db, COLLECTION, sessionId),
      { entries, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving documentary planning entries:', error);
    throw error;
  }
}

export async function deleteDocumentaryPlanningSession(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (error) {
    console.error('Error deleting documentary planning session:', error);
    throw error;
  }
}

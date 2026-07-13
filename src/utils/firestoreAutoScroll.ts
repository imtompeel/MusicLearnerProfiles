import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  loadSavedAutoScrollTexts,
  persistSavedAutoScrollTexts,
  type SavedAutoScrollText,
} from './autoScrollStorage';

const COLLECTION = 'auto_scroll_texts';

function toIsoString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  return fallback;
}

function mapDocToSavedText(docId: string, data: Record<string, unknown>): SavedAutoScrollText | null {
  if (typeof data.name !== 'string' || typeof data.text !== 'string') {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: docId,
    name: data.name,
    text: data.text,
    fontSize: typeof data.fontSize === 'number' ? data.fontSize : 48,
    speed: typeof data.speed === 'number' ? data.speed : 60,
    createdAt: toIsoString(data.createdAt, now),
    updatedAt: toIsoString(data.updatedAt, now),
  };
}

export async function listAutoScrollTexts(ownerUid: string): Promise<SavedAutoScrollText[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where('ownerUid', '==', ownerUid)),
  );

  const texts: SavedAutoScrollText[] = [];
  snapshot.forEach((docSnap) => {
    const mapped = mapDocToSavedText(docSnap.id, docSnap.data());
    if (mapped) {
      texts.push(mapped);
    }
  });

  texts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return texts;
}

export async function createAutoScrollText(
  ownerUid: string,
  payload: Pick<SavedAutoScrollText, 'name' | 'text' | 'fontSize' | 'speed'>,
): Promise<SavedAutoScrollText> {
  const id = `as-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  await setDoc(doc(db, COLLECTION, id), {
    ownerUid,
    name: payload.name,
    text: payload.text,
    fontSize: payload.fontSize,
    speed: payload.speed,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id,
    name: payload.name,
    text: payload.text,
    fontSize: payload.fontSize,
    speed: payload.speed,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAutoScrollText(
  ownerUid: string,
  id: string,
  payload: Pick<SavedAutoScrollText, 'name' | 'text' | 'fontSize' | 'speed'>,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, id),
    {
      ownerUid,
      name: payload.name,
      text: payload.text,
      fontSize: payload.fontSize,
      speed: payload.speed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteAutoScrollText(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function migrateLocalAutoScrollTexts(ownerUid: string): Promise<number> {
  const localTexts = loadSavedAutoScrollTexts();
  if (localTexts.length === 0) {
    return 0;
  }

  for (const item of localTexts) {
    await createAutoScrollText(ownerUid, {
      name: item.name,
      text: item.text,
      fontSize: item.fontSize,
      speed: item.speed,
    });
  }

  persistSavedAutoScrollTexts([]);
  return localTexts.length;
}

export type { SavedAutoScrollText };

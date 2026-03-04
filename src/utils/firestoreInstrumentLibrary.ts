import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const INSTRUMENTS_COLLECTION = 'instrument_library_instruments';
const LOANS_COLLECTION = 'instrument_library_loans';

export interface Instrument {
  id: string;
  name: string;
  category?: string;
}

export interface InstrumentLoanPayload {
  borrowerName: string;
  className: string;
  email: string;
  instrumentIds: string[];
  instrumentNames: string[];
}

// Load all instruments that can be signed out
export async function loadInstrumentsFromFirestore(): Promise<Instrument[]> {
  try {
    const instrumentsRef = collection(db, INSTRUMENTS_COLLECTION);
    const querySnapshot = await getDocs(instrumentsRef);

    const instruments: Instrument[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as { name?: string; category?: string };
      if (!data.name) {
        return;
      }
      instruments.push({
        id: docSnap.id,
        name: data.name,
        category: data.category,
      });
    });

    // Sort alphabetically by name for a tidy UI
    instruments.sort((a, b) => a.name.localeCompare(b.name));

    return instruments;
  } catch (error) {
    console.error('Error loading instruments from Firestore:', error);
    throw error;
  }
}

// Add a new instrument to the library
export async function addInstrumentToFirestore(
  name: string,
  category?: string,
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Instrument name is required');
  }

  try {
    await addDoc(collection(db, INSTRUMENTS_COLLECTION), {
      name: trimmedName,
      category: category?.trim() || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding instrument to Firestore:', error);
    throw error;
  }
}

// Record that one or more instruments have been borrowed
export async function createInstrumentLoanInFirestore(
  payload: InstrumentLoanPayload,
): Promise<void> {
  const { borrowerName, className, email, instrumentIds, instrumentNames } =
    payload;

  if (!borrowerName.trim()) {
    throw new Error('Borrower name is required');
  }

  if (!className.trim()) {
    throw new Error('Class is required');
  }

  if (!email.trim()) {
    throw new Error('Email is required');
  }

  if (!instrumentIds.length) {
    throw new Error('At least one instrument must be selected');
  }

  try {
    await addDoc(collection(db, LOANS_COLLECTION), {
      borrowerName: borrowerName.trim(),
      className: className.trim(),
      email: email.trim(),
      instrumentIds,
      instrumentNames,
      borrowedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating instrument loan in Firestore:', error);
    throw error;
  }
}


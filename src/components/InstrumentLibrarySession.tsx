import React, { useEffect, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import {
  loadInstrumentsFromFirestore,
  addInstrumentToFirestore,
  createInstrumentLoanInFirestore,
  type Instrument,
} from '../utils/firestoreInstrumentLibrary';

interface InstrumentLibrarySessionProps {
  onBack: () => void;
}

// 4-digit code to unlock the instrument library
// Prefer setting VITE_INSTRUMENT_LIBRARY_CODE in your .env file.
const INSTRUMENT_LIBRARY_CODE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_INSTRUMENT_LIBRARY_CODE) ||
  '1234';

export const InstrumentLibrarySession: React.FC<
  InstrumentLibrarySessionProps
> = ({ onBack }) => {
  const { showSuccess, showError } = useStatus();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);

  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>(
    [],
  );
  const [borrowerName, setBorrowerName] = useState('');
  const [className, setClassName] = useState('');
  const [email, setEmail] = useState('');

  const [newInstrumentName, setNewInstrumentName] = useState('');
  const [newInstrumentCategory, setNewInstrumentCategory] = useState('');

  const [isSavingLoan, setIsSavingLoan] = useState(false);
  const [isAddingInstrument, setIsAddingInstrument] = useState(false);

  const loadInstruments = async () => {
    setLoadingInstruments(true);
    try {
      const data = await loadInstrumentsFromFirestore();
      setInstruments(data);
    } catch (error) {
      console.error(error);
      showError('Could not load instruments. Please try again.');
    } finally {
      setLoadingInstruments(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      void loadInstruments();
    }
  }, [isUnlocked]);

  const handleUnlock = (event: React.FormEvent) => {
    event.preventDefault();
    if (codeInput.trim() === INSTRUMENT_LIBRARY_CODE) {
      setIsUnlocked(true);
      showSuccess('Instrument library unlocked');
    } else {
      showError('Incorrect code. Please try again.');
    }
  };

  const handleToggleInstrument = (instrumentId: string) => {
    setSelectedInstrumentIds((prev) =>
      prev.includes(instrumentId)
        ? prev.filter((id) => id !== instrumentId)
        : [...prev, instrumentId],
    );
  };

  const handleAddInstrument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newInstrumentName.trim()) {
      showError('Please enter an instrument name.');
      return;
    }

    setIsAddingInstrument(true);
    try {
      await addInstrumentToFirestore(
        newInstrumentName,
        newInstrumentCategory || undefined,
      );
      setNewInstrumentName('');
      setNewInstrumentCategory('');
      showSuccess('Instrument added to library.');
      await loadInstruments();
    } catch (error) {
      console.error(error);
      showError('Could not add instrument. Please try again.');
    } finally {
      setIsAddingInstrument(false);
    }
  };

  const handleSubmitLoan = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedInstrumentIds.length) {
      showError('Please select at least one instrument to borrow.');
      return;
    }
    if (!borrowerName.trim() || !className.trim() || !email.trim()) {
      showError('Please fill in name, class and email.');
      return;
    }

    const selectedInstruments = instruments.filter((instrument) =>
      selectedInstrumentIds.includes(instrument.id),
    );
    const instrumentNames = selectedInstruments.map(
      (instrument) => instrument.name,
    );

    setIsSavingLoan(true);
    try {
      await createInstrumentLoanInFirestore({
        borrowerName,
        className,
        email,
        instrumentIds: selectedInstrumentIds,
        instrumentNames,
      });

      showSuccess('Instrument loan recorded successfully.');

      // Clear selection and form
      setSelectedInstrumentIds([]);
      setBorrowerName('');
      setClassName('');
      setEmail('');
    } catch (error) {
      console.error(error);
      showError('Could not save loan. Please try again.');
    } finally {
      setIsSavingLoan(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="instrument-library-session container">
        <div className="session-header">
          <button className="btn-back" type="button" onClick={onBack}>
            ← Back to Sessions
          </button>
          <h2>🎺 Instrument Library (Locked)</h2>
          <p>Enter the 4-digit code to manage instrument loans.</p>
        </div>

        <form
          onSubmit={handleUnlock}
          className="instrument-lock-form"
          style={{
            maxWidth: '320px',
            margin: '40px auto',
            textAlign: 'center',
          }}
        >
          <label
            htmlFor="instrument-code"
            style={{ display: 'block', marginBottom: '8px' }}
          >
            4-digit code
          </label>
          <input
            id="instrument-code"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            style={{
              fontSize: '1.5rem',
              textAlign: 'center',
              letterSpacing: '0.4rem',
              padding: '8px 12px',
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: '12px',
            }}
          />
          <button
            type="submit"
            className="btn-teacher"
            style={{ width: '100%' }}
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="instrument-library-session container">
      <div className="session-header">
        <button className="btn-back" type="button" onClick={onBack}>
          ← Back to Sessions
        </button>
        <h2>🎺 Instrument Library</h2>
        <p>Track which instruments learners are borrowing.</p>
      </div>

      <div
        className="instrument-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          alignItems: 'flex-start',
        }}
      >
        <section className="instrument-list-panel">
          <h3>Available instruments</h3>
          {loadingInstruments ? (
            <p>Loading instruments...</p>
          ) : instruments.length === 0 ? (
            <p>
              No instruments found yet. Add instruments below to build your
              library.
            </p>
          ) : (
            <div
              className="instrument-list"
              style={{
                maxHeight: '320px',
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '8px 12px',
                background: '#fff',
                color: '#000',
              }}
            >
              {instruments.map((instrument) => {
                const isSelected = selectedInstrumentIds.includes(
                  instrument.id,
                );
                return (
                  <label
                    key={instrument.id}
                    className="instrument-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 0',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleInstrument(instrument.id)}
                    />
                    <span>
                      {instrument.name}
                      {instrument.category
                        ? ` (${instrument.category})`
                        : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <form
            onSubmit={handleAddInstrument}
            className="add-instrument-form"
            style={{ marginTop: '16px' }}
          >
            <h4>Add an instrument</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Instrument name (e.g. Violin 1)"
                value={newInstrumentName}
                onChange={(e) => setNewInstrumentName(e.target.value)}
                style={{ flex: 2, padding: '6px 8px' }}
              />
              <input
                type="text"
                placeholder="Optional category (e.g. Strings)"
                value={newInstrumentCategory}
                onChange={(e) => setNewInstrumentCategory(e.target.value)}
                style={{ flex: 2, padding: '6px 8px' }}
              />
            </div>
            <button
              type="submit"
              className="btn-teacher"
              disabled={isAddingInstrument}
            >
              {isAddingInstrument ? 'Adding…' : 'Add instrument'}
            </button>
          </form>
        </section>

        <section className="loan-form-panel">
          <h3>Borrower details</h3>
          <form onSubmit={handleSubmitLoan}>
            <div className="form-group">
              <label htmlFor="borrower-name">Name</label>
              <input
                id="borrower-name"
                type="text"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Learner name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="borrower-class">Class</label>
              <input
                id="borrower-class"
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Challenge 1"
              />
            </div>
            <div className="form-group">
              <label htmlFor="borrower-email">Email</label>
              <input
                id="borrower-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.org"
              />
            </div>

            <p style={{ fontSize: '0.9rem', color: '#555' }}>
              The selected instruments and these details will be saved to
              Firestore so you have a record of who has borrowed what.
            </p>

            <button
              type="submit"
              className="btn-teacher"
              disabled={isSavingLoan}
            >
              {isSavingLoan ? 'Saving…' : 'Save instrument loan'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};


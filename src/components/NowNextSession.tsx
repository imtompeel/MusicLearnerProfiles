import React, { useMemo, useState } from 'react';
import type { CurrentClass } from '../types';

interface NowNextSessionProps {
  onBack: () => void;
  currentClass: CurrentClass | null;
}

interface BankItem {
  id: string;
  label: string;
  emoji?: string;
  imageUrl?: string; // optional future: symbol/image support
}

export const NowNextSession: React.FC<NowNextSessionProps> = ({ onBack, currentClass }) => {
  const defaultBank: BankItem[] = useMemo(() => [
    { id: 'arrive', label: 'Arrive', emoji: '🚪' },
    { id: 'hello', label: 'Hello Song', emoji: '👋' },
    { id: 'warmup', label: 'Warm-up', emoji: '🎶' },
    { id: 'listen', label: 'Listening', emoji: '🎧' },
    { id: 'create', label: 'Create', emoji: '🎨' },
    { id: 'perform', label: 'Perform', emoji: '🎤' },
    { id: 'choice', label: 'Pupil Choice', emoji: '🗳️' },
    { id: 'pack', label: 'Pack Away', emoji: '🧺' },
    { id: 'goodbye', label: 'Goodbye', emoji: '👋' }
  ], []);

  const [bank, setBank] = useState<BankItem[]>(defaultBank);
  const [nowItem, setNowItem] = useState<BankItem | null>(null);
  const [nextItem, setNextItem] = useState<BankItem | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('');

  const moveToNow = (item: BankItem) => {
    setNowItem(item);
    setBank(prev => prev.filter(i => i.id !== item.id));
  };

  const moveToNext = (item: BankItem) => {
    setNextItem(item);
    setBank(prev => prev.filter(i => i.id !== item.id));
  };

  const returnToBank = (slot: 'now' | 'next') => {
    if (slot === 'now' && nowItem) {
      setBank(prev => [...prev, nowItem]);
      setNowItem(null);
    }
    if (slot === 'next' && nextItem) {
      setBank(prev => [...prev, nextItem]);
      setNextItem(null);
    }
  };

  const swapNowNext = () => {
    setNowItem(nextItem);
    setNextItem(nowItem);
  };

  const advanceToNext = () => {
    // Move Next to Now, clear Next
    setNowItem(nextItem);
    setNextItem(null);
  };

  const addToBank = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const item: BankItem = { id, label, emoji: newEmoji || undefined };
    setBank(prev => [...prev, item]);
    setNewLabel('');
    setNewEmoji('');
  };

  const bankItemButton = (item: BankItem) => (
    <div key={item.id} className="nn-bank-item">
      <div className="nn-bank-item-label">
        <span className="nn-emoji">{item.emoji || '⬜'}</span>
        <span className="nn-text">{item.label}</span>
      </div>
      <div className="nn-bank-actions">
        <button className="btn-teacher" onClick={() => moveToNow(item)}>Now</button>
        <button className="btn-teacher" onClick={() => moveToNext(item)}>Next</button>
      </div>
    </div>
  );

  return (
    <div className="container">
      <div className="nn-header">
        <button className="btn-teacher" onClick={onBack}>⬅️ Back</button>
        <h2>Now & Next {currentClass ? `— ${currentClass.name}` : ''}</h2>
        <div className="nn-quick-actions">
          <button className="btn-teacher" onClick={swapNowNext} disabled={!nowItem || !nextItem}>↔️ Swap</button>
          <button className="btn-teacher" onClick={advanceToNext} disabled={!nextItem}>⏭️ Advance</button>
        </div>
      </div>

      <div className="nn-stage">
        <div className="nn-slot">
          <div className="nn-slot-title">Now</div>
          {nowItem ? (
            <div className="nn-card" onClick={() => returnToBank('now')} title="Click to return to bank">
              <div className="nn-card-emoji">{nowItem.emoji || '⬜'}</div>
              <div className="nn-card-text">{nowItem.label}</div>
            </div>
          ) : (
            <div className="nn-card nn-empty">Choose from bank</div>
          )}
        </div>
        <div className="nn-slot">
          <div className="nn-slot-title">Next</div>
          {nextItem ? (
            <div className="nn-card" onClick={() => returnToBank('next')} title="Click to return to bank">
              <div className="nn-card-emoji">{nextItem.emoji || '⬜'}</div>
              <div className="nn-card-text">{nextItem.label}</div>
            </div>
          ) : (
            <div className="nn-card nn-empty">Choose from bank</div>
          )}
        </div>
      </div>

      <div className="nn-bank">
        <div className="nn-bank-header">
          <h3>Bank</h3>
          <div className="nn-add-form">
            <input
              type="text"
              placeholder="Add label e.g. Instruments"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="class-input"
            />
            <input
              type="text"
              placeholder="Emoji (optional)"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="class-input"
              style={{ width: 120 }}
            />
            <button className="btn-teacher" onClick={addToBank}>➕ Add</button>
          </div>
        </div>
        <div className="nn-bank-grid">
          {bank.map(bankItemButton)}
        </div>
      </div>

      <style>{`
        .nn-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .nn-quick-actions { display: flex; gap: 8px; }
        .nn-stage { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0 24px; }
        .nn-slot { background: #f5f5f7; border-radius: 12px; padding: 12px; min-height: 180px; display: flex; flex-direction: column; }
        .nn-slot-title { font-weight: 600; margin-bottom: 8px; }
        .nn-card { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; border-radius: 12px; background: white; border: 2px solid #e5e7eb; font-size: 28px; padding: 16px; cursor: pointer; }
        .nn-empty { color: #9ca3af; font-size: 18px; cursor: default; }
        .nn-card-emoji { font-size: 40px; }
        .nn-card-text { font-size: 28px; font-weight: 700; }
        .nn-bank { background: #fafafa; border-radius: 12px; padding: 12px; }
        .nn-bank-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .nn-add-form { display: flex; gap: 8px; align-items: center; }
        .nn-bank-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
        .nn-bank-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: white; border: 1px solid #e5e7eb; border-radius: 10px; }
        .nn-bank-item-label { display: flex; align-items: center; gap: 8px; }
        .nn-emoji { font-size: 22px; }
        .nn-text { font-weight: 600; }
        .nn-bank-actions { display: flex; gap: 6px; }
        @media (max-width: 900px) {
          .nn-card-text { font-size: 22px; }
          .nn-card-emoji { font-size: 32px; }
        }
      `}</style>
    </div>
  );
};




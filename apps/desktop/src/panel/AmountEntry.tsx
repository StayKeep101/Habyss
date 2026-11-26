import { useState, type FormEvent } from 'react';

/** How much of an amount habit was done ("12 pages"), saved with Enter. */
export function AmountEntry({ title, unit, target, onSave, onCancel }: { title: string; unit: string; target: number; onSave: (value: number) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(text.replace(',', '.'));
    if (Number.isFinite(value) && value > 0 && value <= 100_000_000) onSave(value);
  };
  const label = `${unit.charAt(0).toUpperCase()}${unit.slice(1)} of ${title}`;
  return (
    <form className="mp-amount" onSubmit={submit} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <input autoFocus type="number" min="0" step="any" inputMode="decimal" aria-label={label} placeholder={`${target}`} value={text} onChange={e => setText(e.target.value)} />
      <span>{unit}</span>
      <button type="submit">Save</button>
    </form>
  );
}

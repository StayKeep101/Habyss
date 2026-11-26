export function Segmented<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="ui-seg" role="tablist">
      {options.map(o => (
        <button key={o} type="button" role="tab" aria-selected={o === value} className="ui-seg-item" onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

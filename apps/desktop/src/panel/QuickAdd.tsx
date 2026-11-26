import { useState, type FormEvent } from 'react';

type Mode = 'task' | 'habit' | 'time';
const toMs = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();

/** "+ Task", "+ Habit", "+ Log time" from the menu bar: the few fields that matter; the full editors live in the app. */
export function QuickAdd({ date, apps, run, onSaved }: {
  date: string; apps: { name: string; bundle: string | null }[];
  run: (cmd: string, args: Record<string, unknown>) => Promise<boolean>; onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [name, setName] = useState('');
  const [at, setAt] = useState('');
  const [length, setLength] = useState(90);
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [app, setApp] = useState('');
  const [note, setNote] = useState('');
  const open = (m: Mode) => { setMode(mode === m ? null : m); setName(''); setAt(''); setLength(m === 'habit' ? 30 : 90); setPriority(2); setFrom(''); setTo(''); setApp(''); setNote(''); };
  const done = () => { setMode(null); onSaved(); };
  const validTime = !!from && !!to && to > from;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const title = name.trim();
    if (!title) return;
    if (mode === 'task' && await run('cloud_save', { table: 'tasks', row: { title, due_date: date, due_time: at || null, estimated_minutes: length, priority, status: 'open', flexible: at ? 0 : null } })) done();
    if (mode === 'habit' && await run('cloud_save', { table: 'habits', row: { name: title, start_time: at || null, duration_minutes: length, start_date: date, frequency: 'daily', type: 'build', tracking_method: 'boolean', goal_value: 1, goal_period: 'daily', unit: 'count' } })) done();
    if (mode === 'time' && validTime) {
      const picked = apps.find(a => a.name === app);
      if (await run('log_time', { name: picked?.name ?? title, bundle: picked?.bundle ?? null, start: toMs(date, from), end: toMs(date, to), note: note.trim() || (picked ? title : null) })) done();
    }
  };

  return (
    <div className="mp-add">
      <div className="mp-add-buttons">
        {([['task', '+ Task'], ['habit', '+ Habit'], ['time', '+ Log time']] as [Mode, string][]).map(([m, label]) =>
          <button key={m} type="button" className={`mp-chip${mode === m ? ' on' : ''}`} aria-expanded={mode === m} onClick={() => open(m)}>{label}</button>)}
      </div>
      {mode && (
        <form className="mp-add-form" onSubmit={e => void submit(e)} onKeyDown={e => { if (e.key === 'Escape') setMode(null); }}>
          {mode === 'task' && <>
            <input autoFocus aria-label="Task" placeholder="New task" value={name} onChange={e => setName(e.target.value)} />
            <label>At <input type="time" value={at} onChange={e => setAt(e.target.value)} /></label>
            <label>For <select aria-label="Length" value={length} onChange={e => setLength(Number(e.target.value))}>{[15, 30, 45, 60, 90, 120, 180].map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}</select></label>
            <label>Priority <select aria-label="Priority" value={priority} onChange={e => setPriority(Number(e.target.value) as 1 | 2 | 3)}><option value={1}>Urgent</option><option value={2}>Normal</option><option value={3}>Low</option></select></label>
            <button type="submit" disabled={!name.trim()}>Add task</button>
          </>}
          {mode === 'habit' && <>
            <input autoFocus aria-label="Habit" placeholder="New habit, every day" value={name} onChange={e => setName(e.target.value)} />
            <label>At <input type="time" value={at} onChange={e => setAt(e.target.value)} /></label>
            <label>For <select aria-label="Length" value={length} onChange={e => setLength(Number(e.target.value))}>{[5, 10, 15, 20, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}</select></label>
            <button type="submit" disabled={!name.trim()}>Add habit</button>
          </>}
          {mode === 'time' && <>
            <input autoFocus aria-label="What" placeholder="What did you do?" value={name} onChange={e => setName(e.target.value)} />
            <label>From <input type="time" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label>To <input type="time" value={to} onChange={e => setTo(e.target.value)} /></label>
            {apps.length > 0 && <label>In <select aria-label="App" value={app} onChange={e => setApp(e.target.value)}><option value="">No app</option>{apps.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}</select></label>}
            <input aria-label="Note" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
            <button type="submit" disabled={!name.trim() || !validTime}>Log</button>
          </>}
        </form>
      )}
    </div>
  );
}

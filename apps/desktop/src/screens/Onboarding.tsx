import { useState } from 'react';
import { enable } from '@tauri-apps/plugin-autostart';
import { Activity, ArrowUpRight, ChevronRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { Act, Snapshot } from '../types';
import { Toggle } from '../components/ui';
export function Onboarding({ data, busy, error, act }: {
    data: Snapshot;
    busy: boolean;
    error: string;
    act: Act;
}) { const [step, setStep] = useState(0); const [titles, setTitles] = useState(false); const [login, setLogin] = useState(false); const [localError, setLocalError] = useState(''); const steps = [['A clearer relationship with your time.', 'Habyss quietly records which applications you use, so you can understand your day. Your history stays on this Mac.'], ['Automatic. Respectful. Local.', 'The native engine observes your foreground application and time since the last input. It pauses attribution while you are idle, locked, or asleep. Closing the dashboard keeps tracking in the menu bar.'], ['A little more context. Only if you want it.', 'Optional Accessibility access lets Habyss read window titles, including document names. App-level tracking works without it. No screenshots, typed text, or clipboard contents are collected.'], ['Your time belongs to you.', 'No account. No cloud synchronization. You can pause, exclude applications, export your data, or erase your history at any time.']]; const finish = async () => { setLocalError(''); try {
    if (login)
        await enable();
    await act('save_settings', { settings: { ...data.settings, onboarding_complete: true, tracking_enabled: true, collect_titles: titles } });
}
catch (e) {
    setLocalError(String(e));
} }; return <div className="onboarding"><div data-tauri-drag-region className="onboarding-drag"/><div className="brand"><img src="/logo.png" alt=""/>Habyss</div><section><div className="onboarding-symbol">{step === 2 ? <ShieldCheck size={42}/> : step === 3 ? <LockKeyhole size={42}/> : <Activity size={42}/>}</div><p className="eyebrow">WELCOME TO YOUR WORKSPACE</p><h1>{steps[step][0]}</h1><p>{steps[step][1]}</p>{step === 2 && <div className="setup-options"><Toggle title="Include window titles" detail="Optional. Change this any time in Settings." checked={titles} onChange={setTitles}/>{titles && <><button onClick={() => void act('request_permission')}>Allow Accessibility <ArrowUpRight size={15}/></button><small>{data.trusted ? 'Permission granted' : 'Not granted — you can continue with app-level tracking'}</small></>}</div>}{step === 3 && <Toggle title="Launch at Login" detail="Keep Habyss available in the menu bar." checked={login} onChange={setLogin}/>}<div className="onboarding-actions">{step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}<button className="primary" disabled={busy} onClick={() => step < 3 ? setStep(step + 1) : void finish()}>{step === 3 ? 'Start tracking' : 'Continue'}<ChevronRight size={16}/></button></div>{(error || localError) && <p className="error" role="alert">{error || localError}</p>}<div className="step-dots">{steps.map((_, i) => <i key={i} className={i === step ? 'active' : ''}/>)}</div></section><footer><ShieldCheck size={14}/> Private by design. Built for your Mac.</footer></div>; }

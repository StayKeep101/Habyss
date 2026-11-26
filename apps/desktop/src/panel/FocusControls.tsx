import type { FocusSession } from '../types';
import { countdown, FOCUS_MINUTES, focusElapsed, precise } from '../analytics';
import { AppIcon } from '../ui';

export interface FocusControlsProps {
  variant: 'compact' | 'full';
  session: FocusSession | null;
  now: number;
  /** Shown under the countdown (full) and used as the switch's context. */
  label?: string;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Full variant only. Without a handler the button is hidden. Idle, previous/next pick the item to start on. */
  onPrevious?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
}

/** Remaining time for a timed session, elapsed time for an open one. Paused time never counts. */
export function focusClock(s: FocusSession, now: number): number {
  const elapsed = focusElapsed(s, now);
  return s.target_ms > 0 ? Math.max(0, s.target_ms - elapsed) : elapsed;
}
/** The clock text: remaining time rounds up, as the menu bar does; elapsed time rounds down. */
export function focusClockText(s: FocusSession, now: number): string {
  return s.target_ms > 0 ? countdown(focusClock(s, now)) : precise(focusClock(s, now));
}

const Round = ({ icon, label, onClick, primary = false }: { icon: 'stop' | 'play' | 'pause' | 'play-skip-forward'; label: string; onClick: () => void; primary?: boolean }) => (
  <button type="button" className={`fc-round${primary ? ' primary' : ''}`} aria-label={label} title={label} onClick={onClick}><AppIcon name={icon} size={primary ? 26 : 20} filled={primary} /></button>
);

export function FocusControls(p: FocusControlsProps) {
  const running = p.session !== null;
  if (p.variant === 'compact') {
    return <button type="button" role="switch" aria-checked={running} aria-label="Focus Mode" className="fc-switch" onClick={running ? p.onStop : p.onStart}><span className="fc-knob" /></button>;
  }
  const nav = (label: string) => (
    <div className="fc-nav">
      {p.onPrevious && <button type="button" className="fc-step" aria-label="Previous item" onClick={p.onPrevious}><AppIcon name="chevron-back" size={16} /></button>}
      <span className="fc-label">{label}</span>
      {p.onNext && <button type="button" className="fc-step" aria-label="Next item" onClick={p.onNext}><AppIcon name="chevron-forward" size={16} /></button>}
    </div>
  );
  if (!p.session) {
    // Idle: previous and next pick the item that play will focus on.
    return <div className="fc-full"><div className="fc-clock">{countdown(FOCUS_MINUTES * 60000)}</div>{nav(p.label ?? 'Focus')}<div className="fc-row"><Round icon="play" label="Start focus" onClick={p.onStart} primary /></div></div>;
  }
  const paused = p.session.paused_at !== null;
  return (
    <div className="fc-full">
      <div className="fc-clock" aria-live="off">{focusClockText(p.session, p.now)}</div>
      {nav(p.session.label)}
      <div className="fc-row">
        <Round icon="stop" label="Stop focus" onClick={p.onStop} />
        <Round icon={paused ? 'play' : 'pause'} label={paused ? 'Resume focus' : 'Pause focus'} onClick={paused ? p.onResume : p.onPause} primary />
        {p.onFinish && <Round icon="play-skip-forward" label="Finish focus" onClick={p.onFinish} />}
      </div>
    </div>
  );
}

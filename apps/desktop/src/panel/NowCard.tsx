import type { FocusSession } from '../types';
import type { Today, TodayItem } from '../today/today';
import { focusClock } from './FocusControls';
import { countdown } from './countdown';
import { AppIcon } from '../ui';

/** Where the card stands: the running focus session wins, then the item on now, then the next one (counting to its start). */
export interface NowState { title: string; caption: string; remaining: number; progress: number; item: TodayItem | null; focus: FocusSession | null }
export function nowState(today: Today, focus: FocusSession | null, now: number): NowState | null {
  if (focus && focus.end === null) {
    const left = focusClock(focus, now);
    return { title: focus.label, caption: focus.paused_at ? 'Paused' : 'Focus', remaining: left, progress: focus.target_ms > 0 ? 1 - left / focus.target_ms : 0, item: null, focus };
  }
  const [y, m, d] = today.day.split('-').map(Number);
  const base = new Date(y, m - 1, d).getTime(), at = (minute: number) => base + minute * 60_000;
  const on = today.items.find(i => !i.done && at(i.start) <= now && now < at(i.end));
  if (on) return { title: on.title, caption: 'Now', remaining: at(on.end) - now, progress: (now - at(on.start)) / Math.max(1, at(on.end) - at(on.start)), item: on, focus: null };
  const next = today.items.filter(i => !i.done && at(i.start) > now).sort((a, b) => a.start - b.start)[0];
  if (next) return { title: next.title, caption: 'Next', remaining: at(next.start) - now, progress: 0, item: next, focus: null };
  return null;
}

const R = 26, C = 2 * Math.PI * R;

/**
 * The phone's Live Activity, as a card: the Habyss mark in a ring that fills as what is on runs out, the title and
 * countdown, and a check for what is on now. The mark opens the app (the full calendar and analytics). A focus session
 * started elsewhere (the app, the pill) shows Pause and Stop here; nothing here starts one.
 */
export function NowCard({ state, onCheck, onOpen, onPause, onResume, onStop }: {
  state: NowState | null; onCheck: (item: TodayItem) => void; onOpen: () => void;
  onPause: () => void; onResume: () => void; onStop: () => void;
}) {
  const checkable = state?.item && (state.item.kind === 'habit' || state.item.kind === 'task') && state.caption === 'Now';
  const progress = Math.max(0, Math.min(1, state?.progress ?? 0));
  return (
    <section className="mp-now" aria-label="Now">
      <button type="button" className="mp-ring" aria-label="Open Habyss" title="Open Habyss (⌘O)" onClick={onOpen}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r={R} className="mp-ring-track" />
          <circle cx="32" cy="32" r={R} className="mp-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 32 32)" />
        </svg>
        <img src="/mark.png" alt="" draggable={false} />
      </button>
      <div className="mp-now-text">
        <small>{state ? `${state.caption} · ${state.title}` : 'Nothing left today'}</small>
        <strong className="mp-now-clock">{state ? countdown(state.remaining) : '–'}</strong>
        {state?.focus && <div className="mp-now-actions">
          {state.focus.paused_at
            ? <button type="button" className="mp-chip" onClick={onResume}><AppIcon name="play" size={14} />Resume</button>
            : <button type="button" className="mp-chip" onClick={onPause}><AppIcon name="pause" size={14} />Pause</button>}
          <button type="button" className="mp-chip" onClick={onStop}><AppIcon name="stop" size={14} />Stop</button>
        </div>}
      </div>
      {checkable
        ? <button type="button" className="mp-check" aria-label={`Mark ${state!.item!.title} done`} title="Mark done" onClick={() => onCheck(state!.item!)}><AppIcon name="checkmark" size={20} /></button>
        : <span className="mp-check-space" aria-hidden="true" />}
    </section>
  );
}

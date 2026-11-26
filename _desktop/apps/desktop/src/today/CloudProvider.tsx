import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSignedIn, useCloud, type Cloud } from './useCloud';

const MIN = 60000;
/** Seconds while a focus clock is showing; otherwise the day figures only move by the minute. */
const FAST_MS = 1000, SLOW_MS = 30000;

export interface SharedCloud {
  cloud: Cloud;
  /** Signed in, from the durable account flag. */
  signedIn: boolean;
  /** The status has not arrived yet: show neither the sign-in prompt nor numbers. */
  statusLoading: boolean;
  /** Live time, for focus clocks. */
  now: number;
  /** `now` truncated to the minute: every day and range figure uses it, so the panel and the Dashboard agree. */
  minute: number;
  /** Ticks every second while the returned release has not been called. */
  holdFastClock(): () => void;
}

const Context = createContext<SharedCloud | null>(null);

/** One `useCloud` and one clock for everything under it: the Shell's Dashboard and right-column panel share them. */
export function CloudProvider({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const [now, setNow] = useState(Date.now());
  const [fast, setFast] = useState(0);
  const holdFastClock = useCallback(() => { setFast(n => n + 1); return () => setFast(n => n - 1); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), fast > 0 ? FAST_MS : SLOW_MS); return () => clearInterval(t); }, [fast]);
  const minute = Math.floor(now / MIN) * MIN;
  const value = useMemo<SharedCloud>(() => ({ cloud, signedIn: isSignedIn(cloud.status), statusLoading: cloud.status === null, now, minute, holdFastClock }), [cloud, now, minute, holdFastClock]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Uses the surrounding provider, or starts one: the menu bar panel window stands alone. */
export function WithCloud({ children }: { children: ReactNode }) {
  return useContext(Context) ? <>{children}</> : <CloudProvider>{children}</CloudProvider>;
}

export function useSharedCloud(): SharedCloud {
  const shared = useContext(Context);
  if (!shared) throw new Error('useSharedCloud needs a CloudProvider');
  return shared;
}

/** Keeps the shared clock on seconds while `on`. */
export function useFastClock(on: boolean) {
  const { holdFastClock } = useSharedCloud();
  useEffect(() => (on ? holdFastClock() : undefined), [on, holdFastClock]);
}

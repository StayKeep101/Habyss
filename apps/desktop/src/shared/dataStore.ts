// The Mac's counterpart of the phone's apps/mobile/lib/dataStore.ts: the one copy of habit history the schedule rules read for display.
// The desktop fills it from the account's completions (src/today/buildDay.ts).
let history: Record<string, string[]> = {};
/** Streak freezes and time off: kept on the phone for now, so none here. */
const none = new Set<string>();
export const getData = (): { history: Record<string, string[]>; freezes: Set<string>; off: Set<string> } => ({ history, freezes: none, off: none });
export function setHistory(next: Record<string, string[]>): void { history = next; }

/** Time left as the phone's Live Activity and the menu bar pill show it (src-tauri/src/pill.rs clock): M:SS, or H:MM:SS from an hour. */
export function countdown(ms: number): string {
  const secs = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, s = secs % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** Minutes from midnight as the phone writes times: 9:00 AM. */
export function clockLabel(minute: number): string {
  const h = Math.floor(minute / 60) % 24, m = Math.round(minute % 60);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "14 h 37 min", "45 min", "2 h". */
export function hoursLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes)), h = Math.floor(total / 60), m = total % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

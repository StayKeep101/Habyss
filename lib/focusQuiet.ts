/**
 * Focus mode is quiet: while a focus session is on, nothing from Habyss
 * shows, sounds or vibrates (lib/notificationService.ts reads this).
 * FocusTimeContext switches it.
 */
let quiet = false;

export const focusQuiet = () => quiet;
export function setFocusQuiet(next: boolean): void { quiet = next; }

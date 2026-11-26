/**
 * Rule 5 (lib/dayFlow.ts): habits and tasks rescheduled today by a swipe, and
 * the minute each one was. Today only, kept on this phone; a new day starts
 * empty.
 */
export interface Reschedules { day: string; at: Record<string, number> }

/** Today's reschedules for `day`, or none when they were made on another day. */
export const reschedulesFor = (all: Reschedules, day: string): Record<string, number> => (all.day === day ? all.at : {});

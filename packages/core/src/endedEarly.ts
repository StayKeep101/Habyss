/**
 * Meals and calendar events that finished early today ("class let out at
 * 2:10"), and the minute each one did. The timeline ends them there (lib/dayFlow.ts
 * rule 6) and what comes next moves up into the time they gave back. Today
 * only, kept on this phone; a new day starts empty.
 */
export interface EndedEarly { day: string; at: Record<string, number> }

export const endedFor = (all: EndedEarly, day: string): Record<string, number> => (all.day === day ? all.at : {});

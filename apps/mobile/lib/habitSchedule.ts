// The shared module, one source for the phone and the Mac (packages/core/src/habitSchedule.ts). Change it there.
import { setHistorySource } from '@habyss/core/habitSchedule';

// Past ticks for "3 times a week" habits come from the phone's one copy of history (lib/dataStore.ts).
setHistorySource(() => (require('./dataStore') as typeof import('./dataStore')).getData().history);

export * from '@habyss/core/habitSchedule';

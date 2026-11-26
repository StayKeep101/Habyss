// The shared module, one source for the phone and the Mac (packages/core/src/habitSchedule.ts). Change it there.
import { setHistorySource } from '@habyss/core/habitSchedule';
import { getData } from './dataStore';

// Past ticks for "3 times a week" habits come from the Mac's copy of the account's history (src/shared/dataStore.ts).
setHistorySource(() => getData().history);

export * from '@habyss/core/habitSchedule';

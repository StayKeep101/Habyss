// The shared module, one source for the phone and the Mac (packages/core/src/dayComplete.ts). Change it there.
import { setKeptDaysSource } from '@habyss/core/dayComplete';
import { getData } from './dataStore';

// Freezes and days off, from the Mac's copy of the account (src/shared/dataStore.ts).
setKeptDaysSource(() => { const { freezes, off } = getData(); return { freezes, off }; });

export * from '@habyss/core/dayComplete';

import { useEffect, useSyncExternalStore } from 'react';
import { currentMemory, loadMemory, subscribeMemory, type EchoMemoryState } from '@/lib/echoMemory';
import { currentExperiments, loadExperiments, subscribeExperiments, type Experiment } from '@/lib/echoExperiments';

/** What Echo remembers (lib/echoMemory.ts), one copy for every screen. */
export function useEchoMemory(): EchoMemoryState {
    useEffect(() => { void loadMemory(); }, []);
    return useSyncExternalStore(subscribeMemory, currentMemory, currentMemory);
}

/** Echo's experiments (lib/echoExperiments.ts). */
export function useExperiments(): Experiment[] {
    useEffect(() => { void loadExperiments(); }, []);
    return useSyncExternalStore(subscribeExperiments, currentExperiments, currentExperiments);
}

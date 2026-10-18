import { useEffect, useSyncExternalStore } from 'react';
import { currentCustomColors, loadCustomColors, subscribeCustomColors } from '@/lib/customColors';

/** Colours the person kept from the wheel (lib/customColors.ts). */
export function useCustomColors(): string[] {
    useEffect(() => { void loadCustomColors(); }, []);
    return useSyncExternalStore(subscribeCustomColors, currentCustomColors, currentCustomColors);
}

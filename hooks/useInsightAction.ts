import { useCallback } from 'react';
import { router } from 'expo-router';
import { addNote } from '@/lib/echoMemory';
import type { InsightAction } from '@/lib/echoInsights';

/** What tapping an insight's button does. Nothing is changed without the person going on to confirm it. */
export function useInsightAction() {
    return useCallback((action: InsightAction) => {
        switch (action.type) {
            case 'start':
                router.push({ pathname: '/(root)/start-now' as never, params: { item: action.item, title: action.title } });
                return;
            case 'experiment':
                router.push({ pathname: '/(root)/echo' as never, params: { propose: action.habitId } });
                return;
            case 'open':
                router.push({ pathname: action.path as never, params: action.params });
                return;
            case 'remember':
                void addNote('pattern', action.text, 'echo', { evidence: action.evidence, key: action.key });
                return;
        }
    }, []);
}

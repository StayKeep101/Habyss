import { useEffect, useMemo } from 'react';
import { useDayData } from '@/hooks/useDayData';
import { useEchoMemory } from '@/hooks/useEchoMemory';
import { useCheckIns } from '@/hooks/useCheckIns';
import { todays } from '@/lib/checkIns';
import { useAppSettings } from '@/context/AppSettingsContext';
import { computeInsights } from '@/lib/echoInsights';
import { energyToday, settleHelps } from '@/lib/echoMemory';
import { localDateKey } from '@/lib/habitSchedule';
import { normalizeAIPersonality } from '@/lib/aiAgentService';
import type { HistoryDay } from '@/lib/habitDays';

/** The shared history as the day list the stats read. */
export function toHistoryDays(history: Record<string, string[]>, skips: Record<string, string[]>): HistoryDay[] {
    const dates = new Set([...Object.keys(history), ...Object.keys(skips)]);
    return [...dates].sort().map(date => ({ date, completedIds: history[date] ?? [], skippedIds: skips[date] ?? [] }));
}

/**
 * Everything Echo's coaching reads, from the data every screen already
 * shares: no extra queries, and recomputed only when that data changes.
 */
export function useEchoCoach() {
    const data = useDayData();
    const memory = useEchoMemory();
    const { aiPersonality } = useAppSettings();
    const voice = normalizeAIPersonality(aiPersonality);
    // Energy as you said it today (the pull-down question), else as set on the old card.
    const checkIns = useCheckIns();
    const said = todays(checkIns, 'energy');
    const energy = said ? (said <= 2 ? 'low' : said >= 4 ? 'high' : 'ok') : energyToday(memory, data.today);
    const historyDays = useMemo(() => toHistoryDays(data.history, data.skips), [data.history, data.skips]);
    const remembered = useMemo(() => memory.notes.map(note => note.key).filter((key): key is string => !!key), [memory.notes]);

    const insights = useMemo(() => !data.loaded ? [] : computeInsights({
        habits: data.habits, tasks: data.tasks, history: historyDays, completions: data.completions,
        today: data.today, voice, energy, dismissed: memory.dismissed, remembered,
    }), [data.loaded, data.habits, data.tasks, historyDays, data.completions, data.today, voice, energy, memory.dismissed, remembered]);

    // Learn whether the help Echo gave was followed by the thing getting done.
    useEffect(() => {
        if (!data.loaded || !memory.helps.some(help => !help.outcome)) return;
        const doneOn = (item: string, day: string) => {
            const [kind, id] = [item.slice(0, item.indexOf(':')), item.slice(item.indexOf(':') + 1)];
            if (kind === 'habit') return (data.history[day] ?? []).includes(id);
            const task = data.tasks.find(each => each.id === id);
            const at = task?.status === 'done' ? (task.completedAt ?? task.updatedAt) : null;
            return !!at && localDateKey(new Date(at)) === day;
        };
        void settleHelps(doneOn, data.today);
    }, [data.loaded, data.history, data.tasks, data.today, memory.helps]);

    return { ...data, historyDays, insights, memory, energy, voice };
}

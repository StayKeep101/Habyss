import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays } from '@/lib/goalInsights';
import { questWeek } from '@/lib/crewQuest';
import { localDateKey } from '@/lib/habitSchedule';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
    challengesFor, crewKing, crewStandings, myMission, revealedMissions,
    type Challenge, type CrewPerson, type Mission, type Revealed,
} from '@/lib/weekly';

export interface CrewWeek {
    week: { from: string; to: string };
    mission: Mission | null;
    revealed: Revealed[];
    /** Last week's most consistent: wears the crown this week. */
    king: CrewPerson | null;
    /** The week before's, to tell when the crown changed hands. */
    previousKing: CrewPerson | null;
    /** This week so far, most consistent first: the race for next week's crown. */
    race: CrewPerson[];
    challenges: Challenge[];
    /** Something on This week you have not seen: a new mission, secrets out, a new challenge. */
    fresh: boolean;
    /** The crown changed hands and this phone has not shown it yet. */
    dethroned: boolean;
    markSeen: () => void;
    markCrownSeen: () => void;
    reload: () => void;
}

const SEEN = 'habyss_week_seen';
const CROWN_SEEN = 'habyss_crown_seen';

/**
 * The week in your crew, for Community: your secret mission, last week's
 * secrets, who wears the crown, this week's race, and the king's challenge.
 * Read again whenever Community asks (it does on focus and pull to refresh).
 */
export function useCrewWeek(enabled: boolean): CrewWeek {
    const mondayFirst = useWeekStart() === 'monday';
    const [state, setState] = useState<Omit<CrewWeek, 'markSeen' | 'markCrownSeen' | 'reload'>>({
        week: questWeek(localDateKey(new Date()), mondayFirst), mission: null, revealed: [], king: null, previousKing: null,
        race: [], challenges: [], fresh: false, dethroned: false,
    });

    // What This week held when it was last read, to mark as seen.
    const stampRef = useRef<string | null>(null);

    const reload = useCallback(() => {
        if (!enabled) return;
        const week = questWeek(localDateKey(new Date()), mondayFirst);
        const last = { from: addDays(week.from, -7), to: addDays(week.from, -1) };
        const before = { from: addDays(week.from, -14), to: addDays(week.from, -8) };
        void Promise.all([
            myMission(week.from), revealedMissions(week.from), crewKing(last.from, last.to), crewKing(before.from, before.to),
            crewStandings(week.from, week.to), challengesFor(week.from), AsyncStorage.getItem(SEEN), AsyncStorage.getItem(CROWN_SEEN),
        ]).then(([mission, revealed, king, previousKing, race, challenges, seen, crownSeen]) => {
            // What This week holds, as one stamp: anything new changes it.
            const stamp = `${week.from}:${mission?.completed ? 1 : 0}:${revealed.length}:${challenges.map(item => item.kingId).join(',')}`;
            setState({
                week, mission, revealed, king, previousKing, race, challenges,
                fresh: !!(mission || revealed.length || challenges.length) && seen !== stamp,
                dethroned: !!king && !!previousKing && king.userId !== previousKing.userId && crownSeen !== week.from,
            });
            stampRef.current = stamp;
        }).catch(() => undefined);
    }, [enabled, mondayFirst]);

    useEffect(() => { reload(); }, [reload]);

    const markSeen = useCallback(() => {
        if (!stampRef.current) return;
        void AsyncStorage.setItem(SEEN, stampRef.current).catch(() => undefined);
        setState(current => ({ ...current, fresh: false }));
    }, []);
    const markCrownSeen = useCallback(() => {
        setState(current => {
            void AsyncStorage.setItem(CROWN_SEEN, current.week.from).catch(() => undefined);
            return { ...current, dethroned: false };
        });
    }, []);

    return { ...state, markSeen, markCrownSeen, reload };
}


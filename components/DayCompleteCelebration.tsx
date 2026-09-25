import React, { useEffect, useState } from 'react';
import { StreakSuccessModal } from '@/components/Home/StreakSuccessModal';
import { on } from '@/lib/appEvents';

interface Finished { streak: number; completedDates: string[] }

/**
 * Shows the streak card wherever the user happens to be.
 *
 * It lives at the root of the app rather than inside Home, because a habit can
 * be ticked off from the roadmap, a goal, a notification or a widget, and the
 * moment it completes the day is the moment worth marking.
 */
export const DayCompleteCelebration: React.FC = () => {
    const [finished, setFinished] = useState<Finished | null>(null);

    useEffect(() => {
        const sub = on('day_complete', (data: Finished) => {
            setFinished({ streak: data?.streak ?? 1, completedDates: data?.completedDates ?? [] });
        });
        return () => sub.remove();
    }, []);

    return (
        <StreakSuccessModal
            visible={!!finished}
            streak={finished?.streak ?? 0}
            completedDates={finished?.completedDates ?? []}
            onClose={() => setFinished(null)}
        />
    );
};

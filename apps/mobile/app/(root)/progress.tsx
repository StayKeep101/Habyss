import React from 'react';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { StreakView, StreakWhosePill, useStreakWhose } from '@/components/Streak/StreakView';

/** The Streak page on its own (from your profile): the same view as the Wallet · Streak · Missed sheet's middle page. */
export default function ProgressScreen() {
    const whose = useStreakWhose();
    return (
        <SheetScreen title="Streak" align="start" rightSlot={<StreakWhosePill whose={whose} />}>
            <StreakView whose={whose} />
        </SheetScreen>
    );
}

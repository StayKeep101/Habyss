import React from 'react';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { StreakView } from '@/components/Streak/StreakView';

/** The Streak page on its own (from your profile): the same view as the Wallet · Streak · Missed sheet's middle page. */
export default function ProgressScreen() {
    return (
        <SheetScreen title="Streak" align="start">
            <StreakView />
        </SheetScreen>
    );
}

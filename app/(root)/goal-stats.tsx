import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { GoalStatsView } from '@/components/Goal/GoalStatsView';

/** The same stats the goal page shows in place, as a page of its own. */
export default function GoalStatsScreen() {
    const { goalId } = useLocalSearchParams<{ goalId?: string }>();
    return (
        <SheetScreen title="Stats" onBack={() => router.back()} backIcon="close">
            <GoalStatsView goalId={typeof goalId === 'string' ? goalId : undefined} />
        </SheetScreen>
    );
}

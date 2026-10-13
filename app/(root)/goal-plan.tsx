import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { GoalPlanView } from '@/components/Goal/GoalPlanView';

/** The same roadmap the goal page shows in place, as a page of its own. */
export default function GoalPlanScreen() {
    const { goalId } = useLocalSearchParams<{ goalId?: string }>();
    return (
        <SheetScreen title="Roadmap" onBack={() => router.back()} backIcon="close">
            <GoalPlanView goalId={typeof goalId === 'string' ? goalId : undefined} />
        </SheetScreen>
    );
}

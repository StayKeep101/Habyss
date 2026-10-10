import React from 'react';
import { Card, StatTile } from '@/components/ui';

interface StreakCardProps {
    streak: number;
    completionTier: number; // 0-4
    onPress: () => void;
}

/** Days in a row with at least one thing done. A finished day turns it green. */
export const StreakCard: React.FC<StreakCardProps> = ({ streak, completionTier, onPress }) => (
    <Card grow centered padding="md" onPress={onPress} accessibilityLabel={`${streak} day streak. Open progress.`}>
        <StatTile icon="flame" iconTone={completionTier === 4 ? 'success' : 'warning'} value={String(streak)} label="Day streak" />
    </Card>
);

import React from 'react';
import { Card, CardHeader, ProgressBar, Stack, Text } from '@/components/ui';

interface GoalsProgressBarProps {
    progress: number; // 0-100
    onPress: () => void;
    goalsCount: number;
}

/** Every goal's progress in one bar, opening the goals overview. */
export const GoalsProgressBar: React.FC<GoalsProgressBarProps> = ({ progress, onPress, goalsCount }) => (
    <Card onPress={onPress} padding="xl" gap="lg" accessibilityLabel={`Goals, ${Math.round(progress)} percent done across ${goalsCount}. Open goals.`}>
        <CardHeader title="Goals progress" icon="flag" trailing={String(goalsCount)} chevron />
        <Stack direction="row" gap="lg">
            <Stack grow><ProgressBar progress={progress / 100} /></Stack>
            <Text variant="title" numeric>{`${Math.round(progress)}%`}</Text>
        </Stack>
    </Card>
);

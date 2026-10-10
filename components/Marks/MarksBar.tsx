import React from 'react';
import { Pressable } from 'react-native';
import { ProgressBar, Stack, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import type { Marks } from '@/hooks/useMarks';

/**
 * Your Marks and rank, beside your picture: a rank, a number and a line of
 * progress to the next rank. A record, not a game score.
 */
export const MarksBar: React.FC<{ marks: Marks; onPress: () => void }> = ({ marks, onPress }) => {
    const { lightFeedback } = useHaptics();
    const change = marks.todayChange;
    return (
        <Stack grow>
            <Pressable accessibilityRole="button" onPress={() => { lightFeedback(); onPress(); }}
                accessibilityLabel={`${marks.total} Marks, rank ${marks.rank.name}.${marks.next ? ` ${marks.toNext} to ${marks.next.name}.` : ''} Open the Marks chart.`}>
                <Stack gap="sm">
                    <Stack direction="row" justify="between" align="baseline">
                        <Text variant="label" tone="accent">{marks.rank.name}</Text>
                        <Text variant="title" numeric>{marks.total.toLocaleString()}</Text>
                    </Stack>
                    <ProgressBar progress={marks.progress} />
                    <Stack direction="row" justify="between">
                        <Text variant="caption" tone="muted" numberOfLines={1} grow>
                            {marks.next ? `${marks.toNext.toLocaleString()} to ${marks.next.name}` : 'Highest rank'}
                        </Text>
                        {change !== 0 ? <Text variant="caption" tone={change > 0 ? 'success' : 'danger'} numeric>{`${change > 0 ? '+' : '−'}${Math.abs(change)} today`}</Text> : null}
                    </Stack>
                </Stack>
            </Pressable>
        </Stack>
    );
};

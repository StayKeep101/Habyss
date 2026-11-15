import React from 'react';
import { View } from 'react-native';
import { AppButton, IconTile, Text, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useTimeOff } from '@/hooks/useTimeOff';
import { endTimeOff, timeOffLabel } from '@/lib/timeOff';
import { styles } from '@/styles/screens/time-off.styles';

/** The icon for each kind of time off. */
export const TIME_OFF_ICON = { sick: 'medkit', vacation: 'airplane' } as const;

/**
 * On Home while you are off sick or on vacation: what is running, that the
 * streak is safe, and "I'm back". Nothing while it is not.
 */
export function TimeOffCard() {
    const t = useTokens();
    const { mediumFeedback } = useHaptics();
    const timeOff = useTimeOff();
    if (!timeOff) return null;
    return (
        <VoidCard style={styles.card}>
            <View style={styles.head}>
                <IconTile icon={TIME_OFF_ICON[timeOff.kind]} color={t.color.accent} />
                <View style={styles.text}>
                    <Text variant="heading">{timeOffLabel(timeOff)}</Text>
                    <Text variant="caption" tone="muted">Your streak is safe and reminders are quiet.</Text>
                </View>
            </View>
            <AppButton label="I'm back" variant="default" onPress={() => { mediumFeedback(); endTimeOff(); }} />
        </VoidCard>
    );
}

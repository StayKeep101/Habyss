import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { ALERT_CHOICES } from '@/lib/itemAlerts';

/**
 * A habit's or task's own reminders before it begins, as many as wanted:
 * 5, 10, 15, 30 minutes or an hour before. Its start is always told
 * (lib/dayGuide.ts); these are the extras. The same row in the habit and the
 * task forms, so both are reminded the same way.
 */
export function BeforeReminders({ value, onChange, accent }: {
    value: number[] | undefined;
    onChange: (alerts: number[]) => void;
    accent: string;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const chosen = new Set(value ?? []);
    const toggle = (minutes: number) => {
        selectionFeedback();
        const next = new Set(chosen);
        if (next.has(minutes)) next.delete(minutes); else next.add(minutes);
        onChange([...next].sort((a, b) => b - a));
    };
    return (
        <View style={{ gap: t.space.sm }}>
            <Text style={[t.type.caption, { color: t.color.textMuted }]}>Told as it starts. Also before:</Text>
            <View style={[styles.row, { gap: t.space.sm }]}>
                {ALERT_CHOICES.map(minutes => (
                    <ChoicePill key={minutes} label={minutes === 60 ? '1 hr' : `${minutes} min`} on={chosen.has(minutes)} color={accent}
                        role="checkbox" accessibilityLabel={`${minutes === 60 ? '1 hour' : `${minutes} minutes`} before`}
                        onPress={() => toggle(minutes)} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap' },
});

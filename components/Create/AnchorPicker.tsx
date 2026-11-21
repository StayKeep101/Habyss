import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton, ChoicePill, ChoiceRow, MatteInput } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAnchorSuggestions } from '@/hooks/useAnchorSuggestions';
import { anchorLabel, type HabitAnchor } from '@/lib/habitAnchor';

const SIDES: { id: 'before' | 'after'; label: string }[] = [{ id: 'before', label: 'Before' }, { id: 'after', label: 'After' }];

/**
 * A habit held to something in the day (lib/habitAnchor.ts), in two steps,
 * top to bottom, with the result said as one sentence above them:
 *   1. What to: a habit, a task, a class, a meal or an event, or typed.
 *   2. Right before or right after it.
 * Until something is chosen, only the first step shows. Unlink takes it away.
 * On a day the linked thing happens, the timeline places the habit against it;
 * other days it fits in where there is room.
 */
export function AnchorPicker({ value, onChange, accent }: {
    value: HabitAnchor | null | undefined;
    onChange: (anchor: HabitAnchor | null) => void;
    accent: string;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const suggestions = useAnchorSuggestions(true);
    // Right before or right after: no gap to choose.
    const set = (patch: Partial<HabitAnchor>) => onChange({ to: value?.to ?? '', side: value?.side ?? 'after', ...patch, gap: 0 });
    const name = value?.to.trim();
    const step = (text: string) => <Text style={[t.type.caption, { color: t.color.textMuted }]}>{text}</Text>;

    return (
        <View style={{ gap: t.space.md }}>
            {/* The result, first: what it will do. */}
            {name && value ? (
                <Text style={[t.type.heading, { color: t.color.textPrimary }]} accessibilityRole="header">{anchorLabel(value)}</Text>
            ) : (
                <Text style={[t.type.caption, { color: t.color.textMuted }]}>Tie it to a class, a meal or an event. It moves when that moves.</Text>
            )}

            {step('1 · Link it to')}
            {suggestions.length ? (
                <View style={[styles.wrap, { gap: t.space.sm }]}>
                    {suggestions.slice(0, 12).map(suggestion => (
                        <ChoicePill key={suggestion} label={suggestion} on={name?.toLowerCase() === suggestion.toLowerCase()} color={accent}
                            onPress={() => { selectionFeedback(); set({ to: suggestion }); }} />
                    ))}
                </View>
            ) : null}
            <MatteInput value={value?.to ?? ''} onChangeText={to => (to || value ? set({ to }) : undefined)} placeholder={suggestions.length ? 'Or type one: Gym, Lunch…' : 'Accounting, Gym, Lunch…'}
                placeholderTextColor={t.color.textSubtle} autoCapitalize="words" returnKeyType="done"
                accessibilityLabel="What it is linked to" style={[t.type.body, { color: t.color.textPrimary }]} />

            {name && value ? (
                <>
                    {step('2 · Right before or right after')}
                    <ChoiceRow accessibilityLabel="Before or after" options={SIDES} value={value.side} onChange={side => set({ side })} color={accent} />

                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>
                        {`On days with ${name}, it goes there, whatever time ${name} is. Other days it fits in where there's room.`}
                    </Text>
                    <AppButton label="Unlink" icon="unlink-outline" variant="ghost" onPress={() => { selectionFeedback(); onChange(null); }} />
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});

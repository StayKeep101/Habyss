import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { MatteInput } from '@/components/ui/MatteInput';
import { Choices } from '@/components/Create/DetailBar';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAnchorSuggestions } from '@/hooks/useAnchorSuggestions';
import { ANCHOR_GAPS, type HabitAnchor } from '@/lib/habitAnchor';

const SIDES: { id: '' | 'before' | 'after'; label: string }[] = [
    { id: '', label: 'Not linked' },
    { id: 'before', label: 'Before' },
    { id: 'after', label: 'After' },
];
const gapLabel = (minutes: number) => (minutes === 0 ? 'Right then' : minutes === 60 ? '1 hr' : `${minutes} min`);

/**
 * A habit held to something in the day (lib/habitAnchor.ts): before or after a
 * class or a meal, by its name. On a day it is on, the timeline places the
 * habit against it; other days the habit is flexible.
 */
export function AnchorPicker({ value, onChange, accent }: {
    value: HabitAnchor | null | undefined;
    onChange: (anchor: HabitAnchor | null) => void;
    accent: string;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const suggestions = useAnchorSuggestions(!!value);
    const set = (patch: Partial<HabitAnchor>) => onChange({ to: value?.to ?? '', side: value?.side ?? 'before', gap: value?.gap ?? 0, ...patch });
    const name = value?.to.trim();
    return (
        <View style={{ gap: t.space.md }}>
            <Choices options={SIDES} value={value?.side ?? ''} accent={accent}
                onChange={side => (side === 'before' || side === 'after' ? set({ side }) : onChange(null))} />
            {value ? (
                <>
                    <MatteInput value={value.to} onChangeText={to => set({ to })} placeholder="Accounting, Gym, Lunch…"
                        placeholderTextColor={t.color.textSubtle} autoCapitalize="words" returnKeyType="done"
                        accessibilityLabel={`What it goes ${value.side}`} style={[t.type.body, { color: t.color.textPrimary }]} />
                    {suggestions.length ? (
                        <View style={[styles.wrap, { gap: t.space.sm }]}>
                            {suggestions.map(suggestion => (
                                <ChoicePill key={suggestion} label={suggestion} on={value.to.trim().toLowerCase() === suggestion.toLowerCase()} color={accent}
                                    onPress={() => { selectionFeedback(); set({ to: suggestion }); }} />
                            ))}
                        </View>
                    ) : null}
                    <View style={[styles.wrap, { gap: t.space.sm }]}>
                        {ANCHOR_GAPS.map(gap => (
                            <ChoicePill key={gap} label={gapLabel(gap)} on={value.gap === gap} color={accent}
                                accessibilityLabel={gap === 0 ? `Right ${value.side}` : `${gapLabel(gap)} ${value.side}`}
                                onPress={() => { selectionFeedback(); set({ gap }); }} />
                        ))}
                    </View>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>
                        {name
                            ? `On days with ${name}, it goes ${value.side === 'before' ? 'just before it' : 'just after it'}, whatever time it is. Other days it fits in where there's room.`
                            : 'Type the name of a class, an event or a meal.'}
                    </Text>
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});

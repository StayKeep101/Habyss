import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChoicePill, ChoiceRow, IconButton } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAnchorOptions, type AnchorKind } from '@/hooks/useAnchorSuggestions';
import { Spacing } from '@/theme/designSystem';
import type { HabitAnchor } from '@/lib/habitAnchor';

const SIDES: { id: 'before' | 'after'; label: string }[] = [{ id: 'before', label: 'Before' }, { id: 'after', label: 'After' }];
const KINDS: { id: AnchorKind; label: string; icon: string }[] = [
    { id: 'event', label: 'Events', icon: 'calendar' },
    { id: 'task', label: 'Tasks', icon: 'checkbox' },
    { id: 'habit', label: 'Habits', icon: 'repeat' },
    { id: 'meal', label: 'Meals', icon: 'restaurant' },
];
const SHOWN = 24;

/**
 * A habit held to something in the day (lib/habitAnchor.ts): the kinds
 * (events, tasks, habits, meals) in one row; once one is linked, Before or
 * After and ✕ to unlink right under them; then that kind's list, the linked
 * one lit. On a day the linked thing happens, the
 * timeline places the habit against it; other days it fits in where there is room.
 */
export function AnchorPicker({ value, onChange, accent }: {
    value: HabitAnchor | null | undefined;
    onChange: (anchor: HabitAnchor | null) => void;
    accent: string;
}) {
    const t = useTokens();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const options = useAnchorOptions(true);
    const [kind, setKind] = useState<AnchorKind | null>(null);
    // Right before or right after: no gap to choose.
    const set = (patch: Partial<HabitAnchor>) => onChange({ to: value?.to ?? '', side: value?.side ?? 'after', ...patch, gap: 0 });
    const name = value?.to.trim();
    const kinds = KINDS.filter(item => options.some(option => option.kind === item.id));
    // Always one kind showing: the one tapped, else the kind of what is linked, else the first there is.
    const linkedKind = options.find(option => option.name.toLowerCase() === name?.toLowerCase())?.kind;
    const shownKind: AnchorKind = kind && kinds.some(item => item.id === kind) ? kind : linkedKind ?? kinds[0]?.id ?? 'event';
    // Still to do first; what is already done today apart, under a label of its own.
    const ofKind = options.filter(option => option.kind === shownKind).slice(0, SHOWN);
    const open = ofKind.filter(option => !option.done);
    const done = ofKind.filter(option => option.done);
    const pick = (to: string) => { selectionFeedback(); set({ to }); };

    return (
        <View style={styles.wrap}>
            {/* The kinds, one row on any phone; that kind's list under them. */}
            {kinds.length > 1 ? (
                <ChoiceRow accessibilityLabel="What to link it to" options={kinds.map(item => ({ id: item.id, label: item.label }))}
                    value={shownKind} onChange={id => setKind(id)} color={accent} />
            ) : null}

            {/* Linked: right before or right after it (the item lit below), and ✕ to unlink. */}
            {name && value ? (
                <View style={styles.row}>
                    <View style={styles.flex}>
                        <ChoiceRow accessibilityLabel={`Right before or right after ${name}`} options={SIDES} value={value.side}
                            onChange={side => set({ side })} color={accent} />
                    </View>
                    <IconButton icon="close" label="Unlink" diameter={36} size={15} color={t.color.textSubtle}
                        onPress={() => { lightFeedback(); onChange(null); }} />
                </View>
            ) : null}

            <View style={styles.pills}>
                {open.map(option => (
                    <ChoicePill key={`${option.kind}-${option.name}`} label={option.name} on={name?.toLowerCase() === option.name.toLowerCase()} color={accent}
                        onPress={() => pick(option.name)} />
                ))}
            </View>
            {done.length ? (
                <>
                    <Text style={[t.type.caption, { color: t.color.textMuted }]}>Done today</Text>
                    <View style={styles.pills}>
                        {done.map(option => (
                            <ChoicePill key={`${option.kind}-${option.name}`} label={option.name} icon="checkmark-circle" on={name?.toLowerCase() === option.name.toLowerCase()} color={accent}
                                accessibilityLabel={`${option.name}, done today`} onPress={() => pick(option.name)} />
                        ))}
                    </View>
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    flex: { flex: 1 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});

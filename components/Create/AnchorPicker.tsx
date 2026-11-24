import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, ChoicePill, IconButton, MatteInput, MatteSurface } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useAnchorOptions, type AnchorKind } from '@/hooks/useAnchorSuggestions';
import { textOn } from '@/theme/tokens';
import { Radius, Spacing } from '@/theme/designSystem';
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
 * A habit held to something in the day (lib/habitAnchor.ts). Linked, one line
 * on top: what to, Before or After, and ✕ to unlink. Below, a search and the
 * kinds (events, tasks, habits, meals) to narrow the list; typing a name no
 * list has links to it as written. On a day the linked thing happens, the
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
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<AnchorKind | null>(null);
    // Right before or right after: no gap to choose.
    const set = (patch: Partial<HabitAnchor>) => onChange({ to: value?.to ?? '', side: value?.side ?? 'after', ...patch, gap: 0 });
    const name = value?.to.trim();
    const kinds = KINDS.filter(item => options.some(option => option.kind === item.id));
    const words = query.trim().toLowerCase();
    const shown = useMemo(() => options
        .filter(option => (!kind || option.kind === kind) && (!words || option.name.toLowerCase().includes(words)))
        .slice(0, SHOWN), [options, kind, words]);
    const typed = query.trim();
    const exact = !typed || options.some(option => option.name.toLowerCase() === typed.toLowerCase());
    const pick = (to: string) => { selectionFeedback(); set({ to }); setQuery(''); };

    return (
        <View style={styles.wrap}>
            {/* Linked: what to, before or after, unlink. */}
            {name && value ? (
                <View style={styles.row}>
                    <MatteSurface radius={Radius.control} level="control" style={styles.linked}>
                        <AppIcon name="link" size={Spacing.lg} color={accent} />
                        <Text numberOfLines={1} style={[t.type.body, styles.shrink, { color: t.color.textPrimary }]}>{name}</Text>
                    </MatteSurface>
                    {SIDES.map(side => {
                        const on = value.side === side.id;
                        return (
                            <Pressable key={side.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Right ${side.id} ${name}`}
                                hitSlop={Spacing.sm} onPress={() => { if (!on) { selectionFeedback(); set({ side: side.id }); } }}>
                                <MatteSurface radius={Radius.pill} level="control" tint={on ? accent : undefined} style={styles.side}>
                                    <Text style={[t.type.caption, { color: on ? textOn(accent) : t.color.textMuted }]}>{side.label}</Text>
                                </MatteSurface>
                            </Pressable>
                        );
                    })}
                    <IconButton icon="close" label="Unlink" diameter={26} size={13} color={t.color.textSubtle}
                        onPress={() => { lightFeedback(); onChange(null); }} />
                </View>
            ) : null}

            <MatteInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={t.color.textSubtle}
                autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => { if (typed) pick(typed); }}
                accessibilityLabel="Search what to link it to" style={[t.type.body, { color: t.color.textPrimary }]} />

            {kinds.length > 1 ? (
                <View style={styles.pills}>
                    {kinds.map(item => (
                        <ChoicePill key={item.id} label={item.label} icon={item.icon} on={kind === item.id} color={accent}
                            onPress={() => { selectionFeedback(); setKind(current => (current === item.id ? null : item.id)); }} />
                    ))}
                </View>
            ) : null}

            <View style={styles.pills}>
                {/* A name no list has: linked as written. */}
                {!exact ? <ChoicePill label={typed} icon="add" on={false} color={accent} onPress={() => pick(typed)} /> : null}
                {shown.map(option => (
                    <ChoicePill key={`${option.kind}-${option.name}`} label={option.name} on={name?.toLowerCase() === option.name.toLowerCase()} color={accent}
                        onPress={() => pick(option.name)} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    linked: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + Spacing.xs / 2 },
    shrink: { flexShrink: 1 },
    side: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});

import React, { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { AppIcon } from '@/components/ui/AppIcon';
import { Text } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { Spacing } from '@/theme/designSystem';
import { useHaptics } from '@/hooks/useHaptics';
import { findUnits, UNIT_GROUPS } from '@/lib/units';

type Group = keyof typeof UNIT_GROUPS;
const GROUPS = (Object.keys(UNIT_GROUPS) as Group[]).filter(group => group !== 'All');
const groupOf = (unit?: string): Group => GROUPS.find(group => unit && UNIT_GROUPS[group].includes(unit)) ?? GROUPS[0];

/**
 * How much, of what — the one measure control, shared by a habit's Measure and
 * a goal's Target so both look and work the same.
 *
 * Three lines, all in view, nothing to open: the amount, then the kind of thing
 * (count, time, distance…), then that kind's units. The search icon finds any
 * unit by name when it is not in the first few.
 */
export function MeasureField({ amount, onAmount, unit, onUnit, accent, amountLabel, onClear, only, source }: {
    /** Only these units (what Apple Health can count for this habit): no kinds, no search. */
    only?: { id: string; label: string }[];
    /** Who counts it, said over the amount ("Apple Health"). */
    source?: { label: string; icon: string };
    amount: string;
    onAmount: (text: string) => void;
    unit?: string;
    onUnit: (unit: string) => void;
    accent: string;
    amountLabel: string;
    /** Shown as a small × to take the measure off altogether. */
    onClear?: () => void;
}) {
    const { selectionFeedback, lightFeedback } = useHaptics();
    const [group, setGroup] = useState<Group>(() => groupOf(unit));
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState('');
    const units = findUnits(searching ? query : '', group);

    return (
        <View testID="measure-field" style={styles.wrap}>
            {source ? (
                <View style={styles.source}>
                    <AppIcon name={source.icon as never} filled size={Spacing.lg} color={accent} />
                    <Text variant="caption" tone="muted">{source.label}</Text>
                </View>
            ) : null}
            <View style={styles.row}>
                <MatteInput accessibilityLabel={amountLabel} value={amount} onChangeText={onAmount}
                    keyboardType="decimal-pad" placeholder="0" style={styles.amount} />
                {onClear ? <IconButton icon="close" label="No measure" diameter={44} size={18} onPress={() => { lightFeedback(); onClear(); }} /> : null}
            </View>

            {only ? (
                <View style={styles.wrapPills}>
                    {only.map(item => (
                        <ChoicePill key={item.id} label={item.label} on={unit === item.id} color={accent} accessibilityLabel={`Unit ${item.label}`}
                            onPress={() => { Keyboard.dismiss(); selectionFeedback(); onUnit(item.id); }} />
                    ))}
                </View>
            ) : (
            <>
            <View style={styles.row}>
                {searching ? (
                    <MatteInput autoFocus accessibilityLabel="Unit search" placeholder="Search units" value={query}
                        onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" style={styles.search} />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
                        style={styles.strip} contentContainerStyle={styles.pills}>
                        {GROUPS.map(item => (
                            <ChoicePill key={item} label={item} on={group === item} color={accent}
                                accessibilityLabel={`${item} units`}
                                onPress={() => { selectionFeedback(); setGroup(item); }} />
                        ))}
                    </ScrollView>
                )}
                <IconButton icon={searching ? 'close' : 'search'} label={searching ? 'Stop searching units' : 'Search units'}
                    diameter={36} size={16}
                    onPress={() => { lightFeedback(); setSearching(!searching); setQuery(''); }} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.pills}>
                {units.map(item => (
                    <ChoicePill key={item.id} label={item.label} on={unit === item.id} color={accent}
                        accessibilityLabel={`Unit ${item.label}`}
                        onPress={() => { Keyboard.dismiss(); selectionFeedback(); onUnit(item.id); setSearching(false); setQuery(''); }} />
                ))}
            </ScrollView>
            </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    source: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    wrapPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    amount: { flex: 1, height: 48, fontSize: 20 },
    search: { flex: 1, height: 36 },
    strip: { flex: 1 },
    pills: { gap: Spacing.xs + 2, paddingRight: Spacing.sm },
});

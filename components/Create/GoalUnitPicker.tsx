import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { findGoalUnits, UNIT_GROUPS } from '@/lib/goalUnits';

export function GoalUnitPicker({ value, onChange, accent }: {
    value?: string; onChange: (unit: string) => void; accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState<keyof typeof UNIT_GROUPS>('All');
    const units = findGoalUnits(query, group);
    return <View testID="goal-unit-picker" style={styles.content}>
        <View style={[styles.search, { borderColor: colors.border }]}>
            <AppIcon name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search units"
                placeholder="Search units, e.g. books or USD" placeholderTextColor={colors.textTertiary}
                autoCorrect={false} style={[styles.input, { color: colors.textPrimary }]} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear unit search" onPress={() => setQuery('')} hitSlop={10}>
                <AppIcon name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable> : null}
        </View>
        {!query ? <View style={styles.groups}>
            {(Object.keys(UNIT_GROUPS) as (keyof typeof UNIT_GROUPS)[]).map(item =>
                <Pressable key={item} accessibilityRole="radio" accessibilityLabel={`${item} units`}
                    accessibilityState={{ selected: group === item }} onPress={() => { selectionFeedback(); setGroup(item); }}
                    style={[styles.group, { backgroundColor: group === item ? accent + '1f' : colors.background }]}>
                    <Text style={[styles.groupText, { color: group === item ? accent : colors.textSecondary }]}>{item}</Text>
                </Pressable>)}
        </View> : null}
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 176, flexGrow: 0 }} contentContainerStyle={styles.grid}>
            {units.map(unit => <Pressable key={unit.id} accessibilityRole="radio"
                accessibilityLabel={`Unit ${unit.label}`} accessibilityState={{ selected: value === unit.id }}
                onPress={() => { Keyboard.dismiss(); selectionFeedback(); onChange(unit.id); }}
                style={[styles.unit, { borderColor: value === unit.id ? accent : colors.border, backgroundColor: value === unit.id ? accent + '18' : colors.background }]}>
                <Text style={[styles.label, { color: value === unit.id ? accent : colors.textPrimary }]}>{unit.label}</Text>
            </Pressable>)}
        </ScrollView>
        {!units.length ? <Text style={[styles.empty, { color: colors.textSecondary }]}>No matching units. Try “pages”, “km” or “USD”.</Text> : null}
    </View>;
}

const styles = StyleSheet.create({
    content: { gap: 10 }, search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
    input: { flex: 1, minHeight: 44, fontSize: 13, fontFamily: FontFamily.regular },
    groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    group: { minHeight: 36, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10 },
    groupText: { fontSize: 12, fontFamily: FontFamily.medium },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    unit: { width: '31%', minHeight: 44, borderRadius: 11, borderWidth: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    empty: { fontSize: 13, fontFamily: FontFamily.regular, paddingVertical: 6 },
});

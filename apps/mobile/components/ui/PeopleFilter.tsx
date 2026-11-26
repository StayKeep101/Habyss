import React from 'react';
import { Pressable, Text as RNText, ScrollView, StyleSheet } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';
import { Avatar } from './Avatar';
import { AppIcon } from './AppIcon';

export interface FilterPerson { id: string; name: string; color: string; avatarUrl?: string }

/**
 * Whose progress to show on something shared: everyone together, or one
 * person. Each person is a plain matte chip with their face and name, the way
 * every chip is drawn; the chosen one is a solid fill of their colour (the
 * colour their line and squares are drawn in). Scrolls sideways when there are many.
 */
export function PeopleFilter({ people, value, onChange, allColor }: {
    people: FilterPerson[];
    /** 'all', or a person's id. */
    value: string;
    onChange: (id: string) => void;
    /** The colour of "All". */
    allColor: string;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const chip = (id: string, name: string, color: string, lead: React.ReactNode) => {
        const on = value === id;
        return (
            <Pressable key={id} onPress={() => { if (!on) { selectionFeedback(); onChange(id); } }} hitSlop={Spacing.xs}
                accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={id === 'all' ? 'Everyone together' : name}>
                <MatteSurface radius={Radius.pill} level="control" tint={on ? color : undefined} style={styles.chip}>
                    {lead}
                    <RNText numberOfLines={1} style={[t.type.bodySmall, { color: on ? textOn(color) : t.color.textPrimary }]}>{name}</RNText>
                </MatteSurface>
            </Pressable>
        );
    };
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
            {chip('all', 'All', allColor, <AppIcon name="people" filled size={Spacing.lg} color={value === 'all' ? textOn(allColor) : allColor} />)}
            {people.map(person => chip(person.id, person.name, person.color, (
                <Avatar name={person.name} uri={person.avatarUrl} size={Spacing.xxl} />
            )))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { gap: Spacing.sm, paddingVertical: Spacing.xs },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: Control.hitTarget - Spacing.sm, paddingLeft: Spacing.xs, paddingRight: Spacing.md },
});

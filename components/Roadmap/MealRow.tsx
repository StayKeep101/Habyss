import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { IconTile } from '@/components/ui/IconTile';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { TimeWheels } from '@/components/ui/TimeWheels';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { MEAL_LENGTHS, MEAL_NAMES, type Meal } from '@/lib/meals';
import { clockLabel } from '@/lib/dayFlow';
import { toMinutes } from '@/lib/dayPlan';
import { FontFamily } from '@/theme/designSystem';

const ICONS = { breakfast: 'cafe', lunch: 'restaurant', supper: 'fast-food' } as const;
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * One meal on one line: its name, when and how long ("12:30 PM · 45 min"),
 * and a switch. Tap the line to change the time and length in place.
 */
export function MealRow({ meal, onChange }: { meal: Meal; onChange: (patch: Partial<Omit<Meal, 'id'>>) => void }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [open, setOpen] = useState(false);
    const name = MEAL_NAMES[meal.id];
    const summary = `${clockLabel(toMinutes(meal.time) ?? 0)} · ${meal.minutes} min`;
    return (
        <Animated.View layout={MORPH}>
            <Pressable disabled={!meal.on} onPress={() => { selectionFeedback(); setOpen(!open); }} style={[styles.row, { gap: t.space.md }]}
                accessibilityRole="button" accessibilityState={{ expanded: open, disabled: !meal.on }} accessibilityLabel={meal.on ? `${name}, ${summary}` : `${name}, off`}>
                <IconTile icon={ICONS[meal.id]} color={meal.on ? t.color.warning : t.color.textSubtle} size={30} shape="square" />
                <Text numberOfLines={1} style={[t.type.body, styles.name, { color: t.color.textPrimary }]}>{name}</Text>
                {meal.on ? <Text style={[t.type.bodySmall, styles.summary, { color: open ? t.color.accentText : t.color.textMuted }]}>{summary}</Text> : null}
                <AppSwitch value={meal.on} accessibilityLabel={`${name} in my timeline`}
                    onValueChange={on => { selectionFeedback(); if (!on) setOpen(false); onChange({ on }); }} />
            </Pressable>
            {open && meal.on ? (
                <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[styles.edit, { gap: t.space.sm, paddingBottom: t.space.md }]}>
                    <TimeWheels value={meal.time} onChange={time => onChange({ time })} />
                    <View style={[styles.lengths, { gap: t.space.xs }]}>
                        {MEAL_LENGTHS.map(minutes => (
                            <ChoicePill key={minutes} label={`${minutes}m`} on={meal.minutes === minutes} color={t.color.accent}
                                accessibilityLabel={`Takes ${minutes} minutes`} onPress={() => onChange({ minutes })} />
                        ))}
                    </View>
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
    name: { flex: 1, fontFamily: FontFamily.medium },
    summary: { fontVariant: ['tabular-nums'] },
    edit: { paddingLeft: 42 },
    lengths: { flexDirection: 'row', flexWrap: 'wrap' },
});

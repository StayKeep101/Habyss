import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { daysBetween, dateAt } from '@/lib/goalInsights';
import type { FinishedGoal } from '@/hooks/useGoalInsights';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { ms, s } from '@/theme/scale';

const isPhoto = (icon?: string) => !!icon && (icon.includes('/') || icon.startsWith('file:'));

/**
 * Every goal reached, the latest first: its icon, its name, the day it was
 * reached and how long it took. Tapping one opens its page.
 */
export function GoalsDoneSheet({ visible, finished, onClose, onOpen }: {
    visible: boolean;
    finished: FinishedGoal[];
    onClose: () => void;
    onOpen: (goalId: string) => void;
}) {
    const t = useTokens();
    const { primary } = useAccentGradient();
    // Kept while the sheet slides away.
    const [shown, setShown] = useState(finished);
    if (visible && shown !== finished) setShown(finished);
    const caption = shown.length ? `${shown.length} ${shown.length === 1 ? 'goal' : 'goals'} reached` : undefined;
    return (
        <VoidSheet visible={visible} onClose={onClose} title="Goals done" caption={caption} maxShare={0.8} scrollable>
            {shown.length === 0 ? (
                <View style={styles.empty}>
                    <AppIcon name="trophy" size={s(32)} color={t.color.textSubtle} />
                    <Text style={[styles.emptyText, { color: t.color.textMuted }]}>Reach a goal and it lands here.</Text>
                </View>
            ) : (
                <View style={styles.list}>
                    {shown.map(({ goal, insights, on }) => {
                        const color = goal.color || primary;
                        const took = Math.max(1, daysBetween(insights.startDate, on) + 1);
                        const when = dateAt(on).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                        return (
                            <ListItem key={goal.id}>
                                <Pressable onPress={() => onOpen(goal.id)} accessibilityRole="button"
                                    accessibilityLabel={`${goal.name}, reached ${when}, in ${took} ${took === 1 ? 'day' : 'days'}. Open it`}>
                                    <VoidCard style={styles.row}>
                                        {isPhoto(goal.icon)
                                            ? <Image source={{ uri: goal.icon }} style={styles.photo} />
                                            : <IconTile icon={goal.icon || 'flag'} color={color} size={s(40)} />}
                                        <View style={styles.text}>
                                            <Text numberOfLines={2} style={[styles.name, { color: t.color.textPrimary }]}>{goal.name}</Text>
                                            <Text style={[styles.meta, { color: t.color.textMuted }]}>{`${when} · ${took} ${took === 1 ? 'day' : 'days'}`}</Text>
                                        </View>
                                        <AppIcon name="trophy" filled size={s(18)} color={color} />
                                    </VoidCard>
                                </Pressable>
                            </ListItem>
                        );
                    })}
                </View>
            )}
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    list: { gap: Spacing.sm, paddingBottom: Spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
    photo: { width: s(40), height: s(40), borderRadius: s(20) },
    text: { flex: 1, gap: 2 },
    name: { fontSize: ms(16), fontFamily: FontFamily.semibold },
    meta: { fontSize: ms(13), fontFamily: FontFamily.regular },
    empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    emptyText: { fontSize: ms(15), fontFamily: FontFamily.medium, textAlign: 'center' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { openFocus } from '@/lib/openFocus';
import { useTasks } from '@/hooks/useTasks';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { clockOf, type NowItem } from '@/lib/nowItem';
import { clockText } from '@/lib/focusClock';

/**
 * Pinned at the top of the day: what is on right now, with one tap into
 * focus mode, wherever it is filed (a habit inside a goal included). When
 * nothing is on, what comes next and when; when a session is running, that
 * session, to open again.
 */
export function NowCard({ item, accent, now }: { item: NowItem | null; accent: string; now: Date }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { mediumFeedback, lightFeedback } = useHaptics();
    const focus = useFocusTime();
    const tasks = useTasks();
    const live = !!focus.activeHabitId && (focus.isRunning || focus.isPaused);

    if (!item && !live) return null;
    // The same Focus as every other way in (lib/openFocus.ts).
    const open = (target: { kind: string; id: string; title: string }) => { void openFocus(target); };

    if (live) {
        return (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                <Pressable accessibilityRole="button" onPress={() => { lightFeedback(); open({ kind: tasks.some(task => task.id === focus.activeHabitId) ? 'task' : 'habit', id: focus.activeHabitId!, title: focus.activeHabitName ?? 'Focus' }); }}>
                    <VoidCard style={styles.card}>
                        <IconTile icon="timer" color={accent} size={36} />
                        <View style={styles.text}>
                            <Text style={[styles.kicker, { color: accent }]}>{focus.isPaused ? 'Paused' : 'Focusing'}</Text>
                            <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{focus.activeHabitName}</Text>
                        </View>
                        <Text style={[styles.time, { color: colors.textSecondary }]}>{clockText(focus.timeLeft)}</Text>
                        <AppIcon name="chevron-forward" size={16} color={colors.textTertiary} />
                    </VoidCard>
                </Pressable>
            </Animated.View>
        );
    }

    const it = item!;
    const color = it.kind === 'task' ? TASK_COLOR : (it.color || accent);
    const minute = now.getHours() * 60 + now.getMinutes();
    const isNow = it.state === 'now';
    const left = Math.max(1, it.end - Math.max(minute, it.start));
    const inMinutes = it.start - minute;
    const when = isNow ? `Now · ${clockOf(it.start)}–${clockOf(it.end)}`
        : `Next · ${clockOf(it.start)} · in ${inMinutes >= 60 ? `${Math.floor(inMinutes / 60)} h ${inMinutes % 60 ? `${inMinutes % 60} min` : ''}`.trim() : `${inMinutes} min`}`;

    return (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <VoidCard style={styles.card}>
                <IconTile icon={it.kind === 'task' ? 'flash' : (it.icon || 'ellipse')} color={color} size={36} />
                <View style={styles.text}>
                    <Text style={[styles.kicker, { color: isNow ? accent : colors.textTertiary }]}>{when}</Text>
                    <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{it.title}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${isNow ? 'Start focus' : 'Start early'}: ${it.title}`}
                    onPress={() => { mediumFeedback(); open({ kind: it.kind, id: it.id, title: it.title }); }}>
                    <MatteSurface radius={Radius.pill} level="control" tint={isNow ? accent : undefined} style={styles.start}>
                        <AppIcon name="play" size={12} color={isNow ? textOn(accent) : colors.textPrimary} />
                        <Text style={[styles.startText, { color: isNow ? textOn(accent) : colors.textPrimary }]}>{isNow ? 'Focus' : 'Early'}</Text>
                    </MatteSurface>
                </Pressable>
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, marginBottom: Spacing.md },
    text: { flex: 1, gap: 2 },
    kicker: { fontFamily: FontFamily.semibold, fontSize: 12, fontVariant: ['tabular-nums'] },
    title: { fontFamily: FontFamily.semibold, fontSize: 16 },
    time: { fontFamily: FontFamily.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
    start: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    startText: { fontFamily: FontFamily.semibold, fontSize: 13 },
});

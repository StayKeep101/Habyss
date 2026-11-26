import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { AnimatedCircle, CountUp, useProgress } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { IconTile } from '@/components/ui/IconTile';
import type { DayState, HabitRecord } from '@/lib/habitRecord';

/** The flame's size: a header button's. */
const FLAME = 40;
const WEEKDAY = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * The habit's face: its icon inside a ring of how much of this week is kept,
 * on the left under the back arrow, and beside it its name and how it
 * repeats, with the whole width for the words. The ring is the
 * only thing in its colour.
 */
/** The habit's mark at header size: its photo, or its icon on a tile of its colour. */
export function HabitMark({ icon, color, size = 36 }: { icon?: string; color: string; size?: number }) {
    const photo = !!icon && (icon.includes('/') || icon.startsWith('file:'));
    return photo
        ? <Image source={{ uri: icon }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
        : <IconTile icon={icon || 'repeat'} color={color} size={size} />;
}

export function HabitHero({ icon, name, schedule, color, weekShare }: {
    icon?: string; name: string; schedule: string; color: string; weekShare: number;
}) {
    const t = useTokens();
    const size = 84;
    const stroke = 5;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const shown = useProgress(Math.max(0, Math.min(1, weekShare)));
    const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - shown.get()) }));
    const photo = !!icon && (icon.includes('/') || icon.startsWith('file:'));
    return (
        <View style={styles.hero}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
                accessible accessibilityLabel={`${Math.round(weekShare * 100)}% of this week kept`}>
                <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                    <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.color.border} strokeWidth={stroke} fill="none" />
                    <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
                        strokeDasharray={`${c} ${c}`} animatedProps={arc} rotation={-90} origin={`${size / 2}, ${size / 2}`} opacity={weekShare > 0 ? 1 : 0} />
                </Svg>
                {photo ? <Image source={{ uri: icon }} style={styles.photo} />
                    : <AppIcon name={icon || 'repeat'} filled size={30} color={color} />}
            </View>
            <View style={styles.heroText}>
            <Text style={[styles.name, { color: t.color.textPrimary }]} numberOfLines={3} accessibilityRole="header">{name}</Text>
            <Text style={[styles.schedule, { color: t.color.textMuted }]}>{schedule}</Text>
            </View>
        </View>
    );
}

/** Today, one big button: done, or not yet; skip and focus beside it. */
export function HabitToday({ done, skipped, scheduled, color, onDone, onSkip, onFocus, waiting }: {
    done: boolean; skipped: boolean; scheduled: boolean; color: string;
    /** Shared and done by you, not yet by everyone: what it is waiting on (lib/shared.ts). */
    waiting?: string | null;
    onDone: () => void; onSkip: () => void; onFocus: () => void;
}) {
    const t = useTokens();
    return (
        <View style={styles.today}>
            <Pressable onPress={onDone} accessibilityRole="button" accessibilityState={{ checked: done }}
                accessibilityLabel={done ? `${waiting ? `Your part is done, ${waiting}` : 'Done today'}. Tap to undo` : 'Mark done for today'} style={styles.flex}>
                <MatteSurface radius={Radius.pill} level="control" tint={done ? undefined : color} style={styles.doneButton}>
                    <AppIcon name={done ? (waiting ? 'remove-circle' : 'checkmark-circle') : 'checkmark'} filled size={20} color={done ? color : textOn(color)} />
                    <Text style={[styles.doneText, { color: done ? t.color.textPrimary : textOn(color) }]}>
                        {done ? (waiting ? 'Your part is done' : 'Done today') : skipped ? 'Skipped · mark done' : scheduled ? 'Mark done' : 'Do it anyway'}
                    </Text>
                </MatteSurface>
            </Pressable>
            {!done && scheduled ? (
                <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel={skipped ? 'Undo skip' : 'Skip today'}>
                    <MatteSurface radius={Radius.pill} level="control" style={styles.round}>
                        <AppIcon name={skipped ? 'arrow-undo' : 'play-skip-forward'} size={18} color={t.color.textPrimary} />
                    </MatteSurface>
                </Pressable>
            ) : null}
            <Pressable onPress={onFocus} accessibilityRole="button" accessibilityLabel="Focus on it">
                <MatteSurface radius={Radius.pill} level="control" style={styles.round}>
                    <AppIcon name="timer" filled size={18} color={t.color.textPrimary} />
                </MatteSurface>
            </Pressable>
        </View>
    );
}

/**
 * The streak, in the header's corner: a flame with the run inside it, lit
 * while the run is going and grey once it has stopped.
 */
export function StreakFlame({ streak, best }: { streak: number; best: number }) {
    const t = useTokens();
    const lit = streak > 0;
    const fill = lit ? t.color.warning : t.color.textSubtle;
    return (
        <View style={styles.flame} accessible accessibilityRole="text"
            accessibilityLabel={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}. Best: ${best}`}>
            <AppIcon name="flame" filled size={FLAME} color={fill} />
            <View style={styles.flameFigure} pointerEvents="none">
                <CountUp value={String(streak)} style={[styles.flameText, { color: textOn(fill) }]} />
            </View>
        </View>
    );
}

/** This week, day by day: done is solid, missed an outline, skipped dashed, a day off faint. */
export function HabitWeek({ week, color }: { week: { date: string; state: DayState }[]; color: string }) {
    const t = useTokens();
    return (
        <View style={styles.week}>
            {week.map(({ date, state }) => {
                const when = new Date(`${date}T12:00:00`);
                const label = when.toLocaleDateString(undefined, { weekday: 'narrow' });
                const name = when.toLocaleDateString(undefined, { weekday: 'long' });
                const solid = state === 'done';
                return (
                    <View key={date} style={styles.weekDay} accessible accessibilityLabel={`${name}: ${state === 'today' ? 'today, not done yet' : state === 'future' ? 'to come' : state}`}>
                        <Text style={[styles.weekLetter, { color: state === 'today' ? color : t.color.textSubtle }]}>{label}</Text>
                        <View style={[styles.weekDot, {
                            backgroundColor: solid ? color : 'transparent',
                            borderColor: state === 'today' ? color : state === 'missed' ? t.color.textMuted : t.color.border,
                            borderStyle: state === 'skipped' ? 'dashed' : 'solid',
                            borderWidth: solid ? 0 : state === 'today' ? 2 : 1.5,
                            opacity: state === 'off' || state === 'future' ? 0.45 : 1,
                        }]}>
                            {solid ? <AppIcon name="checkmark" size={14} color={textOn(color)} /> : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/** One or two plain lines of what the record says, once it can say something. */
export function HabitInsight({ record }: { record: HabitRecord }) {
    const t = useTokens();
    const lines: { icon: string; text: string }[] = [];
    if (record.rate30 !== null && record.ratePrev30 !== null && record.rate30 !== record.ratePrev30) {
        const change = record.rate30 - record.ratePrev30;
        lines.push({ icon: change > 0 ? 'trending-up' : 'trending-down', text: `${record.rate30}% the last 30 days, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)} on the 30 before` });
    }
    if (record.bestWeekday !== null) lines.push({ icon: 'sparkles', text: `Kept best on ${WEEKDAY[record.bestWeekday]}` });
    if (record.best > record.streak && record.best >= 3) lines.push({ icon: 'flame', text: `${record.best - record.streak} more ${record.best - record.streak === 1 ? 'day' : 'days'} to match your best run` });
    if (!lines.length) lines.push({ icon: 'leaf', text: 'Keep going: what it says about you shows here after a week or two.' });
    return (
        <View style={styles.insights}>
            {lines.slice(0, 3).map(line => (
                <View key={line.text} style={styles.insight}>
                    <AppIcon name={line.icon} size={16} color={t.color.textMuted} />
                    <Text style={[styles.insightText, { color: t.color.textPrimary }]}>{line.text}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingTop: Spacing.sm },
    heroText: { flex: 1, alignItems: 'flex-start', gap: Spacing.xs },
    photo: { width: 62, height: 62, borderRadius: 31 },
    name: { fontSize: 26, lineHeight: 31, fontFamily: FontFamily.bold, letterSpacing: -0.5 },
    schedule: { fontSize: 15, fontFamily: FontFamily.medium },
    today: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    doneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 52 },
    doneText: { fontSize: 17, fontFamily: FontFamily.semibold },
    round: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    flame: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    /** The number sits in the flame's round lower half. */
    flameFigure: { position: 'absolute', left: 0, right: 0, bottom: Spacing.sm, alignItems: 'center' },
    flameText: { fontSize: 13, lineHeight: 16, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    week: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
    weekLetter: { fontSize: 12, fontFamily: FontFamily.semibold },
    weekDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    insights: { gap: Spacing.sm },
    insight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    insightText: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: FontFamily.medium },
});

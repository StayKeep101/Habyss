import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { CheckPop } from '@/components/ui/CheckPop';
import { ListItem } from '@/components/ui/Motion';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useTokens } from '@/hooks/useTokens';
import { lengthLabel, rangeLabel, type DayFlow, type FlowInput, type FlowItem } from '@/lib/dayFlow';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

const PILL = s(56);
const PILL_MIN = vs(60);
const PILL_MAX = vs(150);
const RING = s(28);
/** Taller for longer things, within reason, so the day reads at a glance. */
const pillHeight = (minutes: number) => Math.max(PILL_MIN, Math.min(PILL_MAX, PILL_MIN + (minutes - 30) * 0.9));

/**
 * The day as one continuous routine: each habit and task in time order, a
 * pill of its own colour (taller the longer it takes) joined to the next by a
 * line. The one you are on glows and offers Focus; finish it and the next is
 * yours straight away, with the rest of the chain moved up (lib/dayFlow.ts).
 * Things with no time are under it, as Anytime.
 */
export function DayTimeline({ flow, onToggle, onOpen, onFocus, now }: {
    flow: DayFlow;
    onToggle: (item: FlowInput) => void;
    onOpen: (item: FlowInput) => void;
    onFocus: (item: FlowInput) => void;
    /** Minutes from midnight, for "12 min left"; null on another day. */
    now: number | null;
}) {
    const t = useTokens();
    const colorOf = (item: FlowInput) => item.color || (item.kind === 'task' ? t.color.warning : t.color.accent);
    return (
        <View>
            {flow.timeline.length ? flow.timeline.map((item, index) => (
                <ListItem key={`${item.kind}-${item.id}`} index={index}>
                    <Row item={item} color={colorOf(item)} last={index === flow.timeline.length - 1}
                        nextColor={flow.timeline[index + 1] ? colorOf(flow.timeline[index + 1]) : undefined}
                        now={now} onToggle={onToggle} onOpen={onOpen} onFocus={onFocus} />
                </ListItem>
            )) : (
                <Text style={[t.type.bodySmall, styles.empty, { color: t.color.textSubtle }]}>
                    Nothing has a time today. Give a habit or a task a time and it joins the flow.
                </Text>
            )}

            {flow.anytime.length ? (
                <>
                    <SectionTitle>Anytime</SectionTitle>
                    {flow.anytime.map((item, index) => (
                        <ListItem key={`${item.kind}-${item.id}`} index={index}>
                            <Pressable onPress={() => onOpen(item)} style={[styles.anyRow, { gap: t.space.md }]} accessibilityRole="button" accessibilityLabel={item.title}>
                                <View style={[styles.anyDot, { backgroundColor: colorOf(item) }]}>
                                    <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={s(14)} color={t.color.onAccent} />
                                </View>
                                <View style={styles.text}>
                                    <Text numberOfLines={1} style={[t.type.heading, { color: item.done ? t.color.textSubtle : t.color.textPrimary }, item.done && styles.struck]}>{item.title}</Text>
                                    {item.minutes ? <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{lengthLabel(item.minutes)}</Text> : null}
                                </View>
                                <Check done={item.done} color={colorOf(item)} onPress={() => onToggle(item)} label={item.title} />
                            </Pressable>
                        </ListItem>
                    ))}
                </>
            ) : null}
        </View>
    );
}

function Row({ item, color, nextColor, last, now, onToggle, onOpen, onFocus }: {
    item: FlowItem; color: string; nextColor?: string; last: boolean; now: number | null;
    onToggle: (item: FlowInput) => void; onOpen: (item: FlowInput) => void; onFocus: (item: FlowInput) => void;
}) {
    const t = useTokens();
    const height = pillHeight(item.end - item.start);
    const live = item.state === 'now';
    const done = item.state === 'done';
    const left = live && now !== null ? Math.max(0, item.end - now) : null;
    const moved = item.shift !== 0 && !done
        ? `${Math.abs(item.shift)} min ${item.shift < 0 ? 'earlier' : 'later'} than planned`
        : null;
    return (
        <View style={styles.row}>
            <View style={[styles.rail, { width: PILL }]}>
                <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
                    {live ? <Glow color={color} height={height} /> : null}
                    <View style={[styles.pill, { height, backgroundColor: color, opacity: done ? 0.45 : 1 }]}>
                        <AppIcon name={item.icon || (item.kind === 'task' ? 'checkbox' : 'repeat')} filled size={s(22)} color={t.color.onAccent} />
                    </View>
                </Pressable>
                {!last ? <View style={[styles.link, { backgroundColor: nextColor ?? color }]} /> : null}
            </View>

            <Pressable onPress={() => onOpen(item)} style={[styles.body, { minHeight: height }]} accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${rangeLabel(item.start, item.end)}${live ? ', now' : ''}`}>
                <View style={styles.text}>
                    <View style={[styles.meta, { gap: t.space.xs }]}>
                        {live ? <Text style={[t.type.caption, styles.nowTag, { color: t.color.accentText }]}>Now</Text> : item.state === 'next' ? (
                            <Text style={[t.type.caption, styles.nowTag, { color: t.color.textMuted }]}>Up next</Text>
                        ) : null}
                        <Text style={[t.type.caption, { color: t.color.textSubtle }]}>
                            {rangeLabel(item.start, item.end)} ({lengthLabel(item.end - item.start)})
                        </Text>
                        {item.repeats ? <AppIcon name="repeat" size={s(12)} color={t.color.textSubtle} /> : null}
                    </View>
                    <Text numberOfLines={2} style={[t.type.title, { color: done ? t.color.textSubtle : t.color.textPrimary }, done && styles.struck]}>{item.title}</Text>
                    {moved ? <Text style={[t.type.caption, { color: t.color.textSubtle }]}>{moved}</Text> : null}
                    {live ? (
                        <View style={[styles.liveRow, { gap: t.space.sm }]}>
                            <Pressable onPress={() => onFocus(item)} accessibilityRole="button" accessibilityLabel={`Focus on ${item.title}`}>
                                <MatteSurface radius={t.radius.full} level="control" tint={color} style={styles.focus}>
                                    <AppIcon name="timer" filled size={s(14)} color={t.color.onAccent} />
                                    <Text style={[t.type.caption, styles.focusText, { color: t.color.onAccent }]}>Focus</Text>
                                </MatteSurface>
                            </Pressable>
                            {left !== null ? <Text style={[t.type.caption, { color: t.color.textMuted }]}>{left ? `${lengthLabel(left)} left` : 'Over time'}</Text> : null}
                        </View>
                    ) : null}
                </View>
                <Check done={done} color={color} onPress={() => onToggle(item)} label={item.title} />
            </Pressable>
        </View>
    );
}

/** The ring you tap to finish it; it pops when it fills. */
function Check({ done, color, onPress, label }: { done: boolean; color: string; onPress: () => void; label: string }) {
    const t = useTokens();
    return (
        <Pressable onPress={onPress} hitSlop={t.space.md} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `${label}, done` : `Finish ${label}`}>
            <CheckPop active={done} color={color} size={RING}>
                <View style={[styles.check, { borderColor: color, backgroundColor: done ? color : undefined }]}>
                    {done ? <AppIcon name="checkmark" size={s(16)} color={t.color.onAccent} /> : null}
                </View>
            </CheckPop>
        </Pressable>
    );
}

/** A soft breathing glow behind the pill you are on. */
function Glow({ color, height }: { color: string; height: number }) {
    const breath = useSharedValue(0);
    useEffect(() => {
        breath.value = withRepeat(withSequence(
            withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
            withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System })), -1, false);
    }, [breath]);
    const style = useAnimatedStyle(() => ({ opacity: 0.2 + breath.value * 0.25, transform: [{ scale: 1.06 + breath.value * 0.06 }] }));
    return <Animated.View pointerEvents="none" style={[styles.glow, { height, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'stretch' },
    rail: { alignItems: 'center' },
    pill: { width: PILL, borderRadius: PILL / 2, alignItems: 'center', justifyContent: 'center' },
    glow: { position: 'absolute', width: PILL, borderRadius: PILL / 2 },
    link: { width: s(3), flex: 1, minHeight: vs(10), opacity: 0.6 },
    body: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: s(14), paddingBottom: vs(10) },
    text: { flex: 1, gap: vs(2) },
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    nowTag: { fontFamily: FontFamily.semibold },
    struck: { textDecorationLine: 'line-through' },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(6) },
    focus: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(12), paddingVertical: vs(6) },
    focusText: { fontFamily: FontFamily.semibold },
    check: { width: RING, height: RING, borderRadius: RING / 2, borderWidth: s(2), alignItems: 'center', justifyContent: 'center' },
    empty: { textAlign: 'center', paddingVertical: vs(24) },
    anyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(10) },
    anyDot: { width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' },
});

import React, { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { FocusClock, FocusDigits } from '@/components/Focus/FocusClock';
import { useAccentGradient } from '@/context/AccentContext';
import { useClockStyle } from '@/hooks/useClockStyle';
import { showFocusStep, useFocusDay } from '@/hooks/useFocusDay';
import { useHaptics } from '@/hooks/useHaptics';
import { clockLabel } from '@/lib/dayFlow';
import { on } from '@/lib/appEvents';
import { pushFocusToWatch } from '@/lib/watchSync';
import { styles } from '@/styles/screens/focus.styles';
import { Spacing } from '@/theme/designSystem';

const minuteNow = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60; };

/**
 * A step of a day spent in focus that is not a habit or a task: a meal, a
 * calendar event, or the free time before something at an exact time. The
 * clock counts down to when it ends (or starts, if it has not yet), then the
 * day moves on by itself. "Next" moves on early.
 */
export function FocusBlock({ kind, id, title, from, until, nextKind }: { kind: string; id: string; title: string; from: number; until: number; nextKind?: string }) {
    const insets = useSafeAreaInsets();
    const { primary } = useAccentGradient();
    const clock = useClockStyle();
    const screen = useWindowDimensions();
    const proceed = useFocusDay();
    const { mediumFeedback } = useHaptics();
    const [now, setNow] = useState(minuteNow);
    const moved = useRef(false);
    useEffect(() => { const timer = setInterval(() => setNow(minuteNow()), 1000); return () => clearInterval(timer); }, []);
    // On the wrist too: the same step and its clock, and Next from there moves on here.
    useEffect(() => {
        const ends = new Date(); ends.setHours(0, 0, 0, 0);
        const target = kind !== 'wait' && minuteNow() < from ? from : until;
        pushFocusToWatch({ id, title: kind === 'wait' ? `Free time · then ${title}` : title, endsAt: ends.getTime() + target * 60000, startedAt: Date.now(), left: 0, paused: false, stopwatch: false });
        const sub = on('focus_next', () => nextRef.current());
        return () => sub.remove();
    }, [id, title, kind, from, until]);
    const waitingFor = kind === 'wait';
    const before = !waitingFor && now < from;
    const target = before ? from : until;
    const left = Math.max(0, Math.round((target - now) * 60));
    const span = Math.max(1, (target - (before ? now : from)) * 60);
    // Its time is up: the next thing, on its own (the one waited for, opened and started).
    useEffect(() => {
        if (moved.current || before || left > 0) return;
        moved.current = true;
        if (waitingFor) showFocusStep({ day: '1', kind: nextKind ?? 'habit', id, title, start: '1' });
        else void proceed(id);
    }, [left, before, waitingFor, id, title, proceed, nextKind]);
    const nextRef = useRef(() => {});
    const next = () => {
        mediumFeedback();
        moved.current = true;
        if (waitingFor) showFocusStep({ day: '1', kind: nextKind ?? 'habit', id, title, start: '1' });
        else void proceed(id);
    };
    nextRef.current = next;
    const line = waitingFor ? `Until ${clockLabel(Math.round(until))}, then ${title}`
        : before ? `${title} at ${clockLabel(Math.round(from))}` : `${title} until ${clockLabel(Math.round(until))}`;
    return (
        <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
            <View style={styles.top}>
                <IconButton icon="close" label="Stop focusing the day" onPress={() => { pushFocusToWatch(null); router.back(); }} diameter={40} size={18} color="#FFFFFF" />
                {/* Free time says so in big in the middle; nothing to repeat up here. */}
                <Text numberOfLines={1} style={styles.title}>{waitingFor ? '' : title}</Text>
                <View style={{ width: 40 }} />
            </View>
            <View style={styles.center}>
                {waitingFor ? (
                    // Free time: just the words and how long it lasts. No ring, no mark.
                    <>
                        <Text style={styles.freeTitle} accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1}>Free time</Text>
                        <FocusDigits seconds={left} size={Math.min(screen.width * 0.16, screen.height * 0.08)} label={line} />
                    </>
                ) : (
                    <FocusClock seconds={left} progress={before ? null : 1 - left / span} style={clock} accent={primary} label={line} />
                )}
            </View>
            <View style={[styles.next, { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxl }]}>
                <AppButton label={waitingFor ? `Start ${title} now` : kind === 'event' ? 'Back early: next' : 'Done: next'} icon="arrow-forward" onPress={next} />
            </View>
        </View>
    );
}

/** The end of a day spent in focus. */
export function FocusDayDone() {
    const insets = useSafeAreaInsets();
    useEffect(() => { pushFocusToWatch(null); }, []);
    return (
        <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
            <View style={styles.center}>
                <Text style={styles.doneTitle}>That was the day</Text>
                <Text style={styles.doneSub}>Everything on your timeline is done.</Text>
                <View style={styles.next}>
                    <AppButton label="Close" onPress={() => router.back()} />
                </View>
            </View>
        </View>
    );
}

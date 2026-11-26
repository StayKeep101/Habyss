import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MatteSurface, Text } from '@/components/ui';
import { PopupCard } from '@/components/ui/PopupCard';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { answer as answerCheckIn, QUESTIONS, type CheckIn } from '@/lib/checkIns';
import { localDateKey } from '@/lib/habitSchedule';
import { PHONE_IN_BED, markNightAsked, savePhoneInBed, shouldAskNight, type PhoneInBed } from '@/lib/nightCheck';
import { currentSleep, formatSleep, refreshSleep } from '@/lib/sleepLog';
import { Radius, Spacing } from '@/theme/designSystem';

/**
 * The morning: the first time the app opens (4 am to noon), the same card as
 * Echo's quick questions, about last night. Your sleep from Health when there
 * is some (how long, from when to when, against your goal); then two taps:
 * was the phone in bed with you, and how rested you feel (which counts as the
 * day's energy check-in, so Echo does not ask it again). Once a morning.
 */
export function MorningPopup() {
    const t = useTokens();
    const { primary } = useAccentGradient();
    const { selectionFeedback, successFeedback, lightFeedback } = useHaptics();
    const [day, setDay] = useState<string | null>(null);
    const [step, setStep] = useState<0 | 1>(0);

    const check = useCallback(() => {
        void (async () => {
            const now = new Date();
            const today = localDateKey(now);
            if (!(await shouldAskNight(now, today))) return;
            await refreshSleep().catch(() => undefined);
            void markNightAsked(today);
            setStep(0);
            setDay(today);
        })();
    }, []);
    useFocusEffect(useCallback(() => { check(); }, [check]));
    useEffect(() => {
        const subscription = AppState.addEventListener('change', next => { if (next === 'active') check(); });
        return () => subscription.remove();
    }, [check]);

    const sleep = currentSleep();
    const minutes = day ? sleep.nights[day] : undefined;
    const night = day ? sleep.details?.[day] : undefined;
    const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const slept = minutes
        ? `${formatSleep(minutes)} asleep${night ? `, ${clock(night.bed)} – ${clock(night.wake)}` : ''}. ${minutes >= sleep.target ? 'At your goal.' : `${formatSleep(sleep.target - minutes)} short of your goal.`}`
        : 'Good morning. Two taps about the night.';

    const options = step === 0 ? [...PHONE_IN_BED] : QUESTIONS.energy.options;
    const pick = (index: number) => {
        if (!day) return;
        if (step === 0) {
            selectionFeedback();
            void savePhoneInBed(day, index as PhoneInBed);
            setStep(1);
            return;
        }
        successFeedback();
        void answerCheckIn('energy', (index + 1) as CheckIn['value']);
        setDay(null);
    };

    return (
        <PopupCard visible={!!day} onClose={() => { lightFeedback(); setDay(null); }} icon="moon" iconColor={primary}
            title="Last night" body={slept}>
            <Text variant="heading" align="center">{step === 0 ? 'Was your phone in bed with you?' : 'How rested do you feel?'}</Text>
            <View style={styles.row}>
                {options.map((label, index) => (
                    <Pressable key={label} style={styles.flex} accessibilityRole="button" accessibilityLabel={label} onPress={() => pick(index)}>
                        <MatteSurface radius={Radius.small} level="control" style={styles.option}>
                            <View style={[styles.level, { backgroundColor: primary, opacity: step === 0 ? 0.3 + (2 - index) * 0.3 : 0.25 + index * 0.18 }]} />
                            <Text variant="caption" align="center" numberOfLines={1}>{label}</Text>
                        </MatteSurface>
                    </Pressable>
                ))}
            </View>
            <Pressable onPress={() => { lightFeedback(); setDay(null); }} accessibilityRole="button" style={styles.skip} hitSlop={Spacing.sm}>
                <Text variant="bodySmall" tone="muted">Not now</Text>
            </Pressable>
            <View style={styles.dots} importantForAccessibility="no-hide-descendants">
                {[0, 1].map(dot => <View key={dot} style={[styles.dot, { backgroundColor: dot === step ? t.color.accent : t.color.border }]} />)}
            </View>
        </PopupCard>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', gap: Spacing.xs + Spacing.xs / 2, marginTop: Spacing.sm },
    option: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs / 2 },
    level: { width: Spacing.lg + 2, height: Spacing.lg + 2, borderRadius: Radius.pill },
    skip: { alignSelf: 'center', paddingVertical: Spacing.sm },
    dots: { flexDirection: 'row', gap: Spacing.xs, alignSelf: 'center', paddingBottom: Spacing.xs },
    dot: { width: Spacing.sm - 2, height: Spacing.sm - 2, borderRadius: Radius.pill },
});

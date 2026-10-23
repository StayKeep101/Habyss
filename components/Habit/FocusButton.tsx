import React from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AppButton } from '@/components/ui/AppButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useFocusTime } from '@/context/FocusTimeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { useFocusPlan } from '@/hooks/useFocusPlan';
import type { Habit } from '@/lib/habitsSQLite';

const clock = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};

/**
 * Focus on a habit for its planned time, with the apps you chose blocked.
 *
 * Only for a habit that has a time — its own length, or the slot it is planned
 * in. Timer habits already start from their progress card, so they are left out.
 */
export function FocusButton({ habit, isTimer }: { habit: Habit; isTimer: boolean }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { mediumFeedback, selectionFeedback } = useHaptics();
    const focus = useFocusTime();
    // The same length the focus page would use (lib/focusLength.ts), cut short if today's timeline cut it.
    const plan = useFocusPlan(habit.id, { habit });
    const minutes = plan.seconds ? Math.round(plan.seconds / 60) : null;
    if (isTimer || !minutes) return null;

    const mine = focus.activeHabitId === habit.id && (focus.isRunning || focus.isPaused);

    const start = () => {
        if (focus.activeHabitId && !mine && (focus.isRunning || focus.isPaused)) {
            Alert.alert('Another session is running', `End “${focus.activeHabitName || 'the other habit'}” first.`);
            return;
        }
        mediumFeedback();
        focus.startTimer(habit.id, habit.name, minutes * 60, 'deep_focus');
    };

    const chooseApps = async () => {
        selectionFeedback();
        if (Platform.OS !== 'ios') return;
        const allowed = (await ScreenTimeService.isAuthorized()) || (await ScreenTimeService.requestAuthorization());
        if (!allowed) {
            Alert.alert('Apps are not blocked', 'Habyss needs Screen Time access to block apps while you focus.');
            return;
        }
        ScreenTimeService.presentPicker();
    };

    return (
        <View style={styles.wrap}>
            {mine ? (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                    <MatteSurface radius={Radius.card} style={styles.live}>
                        <View style={styles.liveBody}>
                            <Text style={[styles.clock, { color: colors.textPrimary }]}>{clock(focus.timeLeft)}</Text>
                            <Text style={[styles.caption, { color: colors.textTertiary }]}>{focus.isPaused ? 'Paused' : 'Focusing'}</Text>
                        </View>
                        <IconButton icon={focus.isPaused ? 'play' : 'pause'} label={focus.isPaused ? 'Resume' : 'Pause'}
                            onPress={() => { selectionFeedback(); focus.isPaused ? focus.resumeTimer() : focus.pauseTimer(); }}
                            diameter={46} size={18} color={primary} />
                        <IconButton icon="stop" label="End focus" onPress={() => { selectionFeedback(); focus.stopTimer(); }}
                            diameter={46} size={16} color={colors.textSecondary} />
                    </MatteSurface>
                </Animated.View>
            ) : (
                <View style={styles.row}>
                    <AppButton label={`Focus · ${minutes} min`} icon="hourglass-outline" onPress={start} style={styles.flex} />
                    {Platform.OS === 'ios' ? (
                        <IconButton icon="apps-outline" label="Apps to block" onPress={() => void chooseApps()} diameter={54} size={20} />
                    ) : null}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginTop: Spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    flex: { flex: 1 },
    live: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    liveBody: { flex: 1 },
    clock: { fontFamily: FontFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    caption: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable,
    ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { HabyssBootScreen } from '@/components/Loading/HabyssBootScreen';
import { SpinningLogo } from '@/components/SpinningLogo';
import { APP_NAME, APP_SLOGAN } from '@/constants/brand';
import { addHabit, updateHabit } from '@/lib/habitsSQLite';
import { NotificationService } from '@/lib/notificationService';
import { LocationService } from '@/lib/LocationService';
import { setOnboardingComplete } from '@/lib/localUser';
import { isHabitScheduledForDate, localDateKey } from '@/lib/habitSchedule';
import { coachPlanIntro, coachPreview } from '@/lib/coachMessages';
import { describeParsed, parseHabitText } from '@/lib/habitParser';
import {
    clearDraft, describeRecurrence, draftToHabit, loadDraft, saveDraft,
    type OnboardingDraft,
} from '@/lib/onboarding';
import {
    ATTEMPTS, KILLERS, TIME_BUDGETS, TONES, dailyTargetMinutes,
    payoffHeadline, planFor, saveStakes, shouldOfferReminder, shouldSuggestSharing,
    wantsExplicitCue, type KillerId,
} from '@/lib/onboardingAnswers';
import { parseGoalText } from '@/lib/goalParser';
import { buildRoadmap, tidy } from '@/lib/roadmapPlan';
import { planFromDraft } from '@/lib/onboardingPlan';
import { createTask } from '@/lib/tasks';

/** Just long enough for the selected state to paint before the step changes. */
const SELECT_ADVANCE_MS = 180;

const STEPS = [
    'welcome', 'goal', 'attempts', 'killers', 'stakes',
    'tone', 'time', 'measurable', 'roadmap', 'payoff', 'reminder', 'friends',
] as const;
/** The payoff is the last step of setup; everything after follows the saved plan. */
const LAST_SETUP_STEP = 9;

const STEP = {
    welcome: 0, goal: 1, attempts: 2, killers: 3, stakes: 4,
    tone: 5, time: 6, measurable: 7, roadmap: 8, payoff: 9, reminder: 10, friends: 11,
} as const;

export default function OnboardingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const { setAIPersonality } = useAppSettings();

    // null while hydrating: persisted data decides what the user sees, not a guess.
    const [draft, setDraftState] = useState<OnboardingDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reminderNote, setReminderNote] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);
    const locationLockRef = useRef(false);
    const savingRef = useRef(false);
    // Auto-advance after a single choice; held so a second tap can cancel it.
    const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seededRoadmapRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        loadDraft().then(stored => {
            if (cancelled) return;
            setDraftState(stored ?? { step: 0, startDate: localDateKey(new Date()), recurrence: 'daily' });
        });
        return () => { cancelled = true; };
    }, []);

    const update = useCallback((patch: Partial<OnboardingDraft>) => {
        setDraftState(current => {
            if (!current) return current;
            const next = { ...current, ...patch };
            // Persist every change so closing the app mid-flow loses nothing.
            saveDraft(next);
            return next;
        });
    }, []);

    const cancelAdvance = useCallback(() => {
        if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
    }, []);

    const goTo = useCallback((step: number) => {
        // Tapping Continue, or going back, beats any pending auto-advance.
        cancelAdvance();
        setError(null);
        update({ step });
    }, [cancelAdvance, update]);

    /**
     * Applies a single-choice answer and moves straight on.
     *
     * The delay is only long enough for the selected state to paint, so the tap
     * feels acknowledged rather than ignored; anything longer reads as lag.
     * Single-choice steps have no Continue button, so every tap advances,
     * including a tap on the option that is already selected.
     */
    const chooseAndAdvance = useCallback((patch: Partial<OnboardingDraft>, nextStep: number, delay = SELECT_ADVANCE_MS) => {
        cancelAdvance();
        update(patch);
        advanceRef.current = setTimeout(() => {
            advanceRef.current = null;
            setError(null);
            update({ step: nextStep });
        }, delay);
    }, [cancelAdvance, update]);

    useEffect(() => cancelAdvance, [cancelAdvance]);

    /**
     * Seeds the roadmap once, from the goal the user confirmed.
     *
     * Guarded by a ref as well as the draft, because the draft updates
     * asynchronously and a second pass would overwrite an edit made in between.
     * An empty array is a real answer — the user removed every checkpoint — so
     * only undefined counts as "not built yet".
     */
    useEffect(() => {
        if (!draft || draft.step !== STEP.roadmap) return;
        if (draft.roadmapSteps !== undefined || seededRoadmapRef.current) return;

        const goalText = (draft.measurableText ?? draft.identityGoal ?? '').trim();
        if (!goalText) return;

        seededRoadmapRef.current = true;
        const built = buildRoadmap(
            parseGoalText(goalText, { today: new Date(), habits: [] }).goal,
            { today: new Date(), minutesPerDay: dailyTargetMinutes(draft.timeBudget, draft.killers) },
        );
        update({
            roadmapSteps: built.steps.map(step => ({ id: step.id, title: step.title, dueDate: step.dueDate })),
            habitName: draft.habitName ?? built.habit.name,
            targetValue: draft.targetValue ?? built.habit.targetValue,
            targetUnit: draft.targetUnit ?? built.habit.targetUnit,
            trackingMethod: draft.trackingMethod ?? built.habit.trackingMethod,
        });
    }, [draft, update]);

    if (!draft) return <HabyssBootScreen subtitle="Getting things ready" />;

    const stepIndex = Math.min(draft.step, STEPS.length - 1);

    /* ---------------------------------------------------------------- saving */

    const startPlan = async () => {
        // Guard the ref and the stored ids: a double tap or a retry after a
        // partial failure must never create a second goal or habit.
        if (savingRef.current) return;
        if (draft.createdHabitId) { goTo(STEP.reminder); return; }
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            // Worked out in full first, by the same function the tests check, so
            // the plan shown on the payoff is the plan that gets stored.
            const plan = planFromDraft(draft);

            // The goal carries the measurable target; the habit is the daily
            // action that feeds it. The reminder is deliberately not part of
            // either write, so a notification failure cannot lose the plan.
            let goalId = draft.createdGoalId;
            if (!goalId) {
                const goal = await addHabit(plan.goal);
                if (!goal?.id) throw new Error('Goal was not saved');
                goalId = goal.id;
                update({ createdGoalId: goalId });
            }

            const created = await addHabit({ ...plan.habit, goalId });
            if (!created?.id) throw new Error('Habit was not saved');

            // Checkpoints become tasks under the goal. Each carries a stable
            // external id, so a retry after a partial failure updates the same
            // rows instead of creating a second set.
            for (const task of plan.tasks) {
                await createTask({
                    title: task.title,
                    dueDate: task.dueDate,
                    goalId,
                    priority: 2,
                    externalId: `onboarding:${goalId}:${task.stepId}`,
                });
            }

            // Answer 5 sets the coach; answer 4 is kept for the coach to quote.
            setAIPersonality(plan.coach);
            if (plan.stakes) await saveStakes(plan.stakes);

            update({ createdHabitId: created.id, step: STEP.reminder });
            successFeedback();
        } catch {
            setError('Could not save your plan. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const inviteFriend = async () => {
        lightFeedback();
        try {
            // The system sheet is the whole action. Habyss has no server, so it
            // cannot know whether anyone accepted, and nothing is recorded here.
            await Share.share({
                message: `I'm building a habit in Habyss — ${APP_SLOGAN.toLowerCase()}. Come do it with me.`,
            });
        } catch {
            // Dismissing the sheet is not an error worth interrupting setup for.
        }
    };

    const addArrivalReminder = async (label: 'Home' | 'Work' | 'Gym') => {
        if (!draft.createdHabitId || locationLockRef.current) return;
        locationLockRef.current = true;
        setLocating(true);
        setReminderNote(null);
        try {
            if (!(await NotificationService.requestPermissions())) {
                setReminderNote('Notifications are off, so an arrival reminder cannot be delivered. Your habit is saved.');
                return;
            }
            // Geofencing needs background location, which is a separate grant.
            if (!(await NotificationService.requestLocationPermissions())) {
                setReminderNote('Arrival reminders need background location access. Your habit is saved; you can allow it later in Settings.');
                return;
            }

            let timeout: ReturnType<typeof setTimeout> | undefined;
            const position = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<never>((_, reject) => {
                    timeout = setTimeout(() => reject(new Error('Location timed out')), 20000);
                }),
            ]).finally(() => { if (timeout) clearTimeout(timeout); });

            const place = {
                name: label,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                radius: 150,
            };
            await updateHabit({ id: draft.createdHabitId, locationReminders: [place] });
            await LocationService.refreshGeofences();
            update({ arrivalPlace: label });
            setReminderNote(`Saved this spot as ${label}. Habyss will nudge you when you arrive back here.`);
            successFeedback();
        } catch {
            setReminderNote('Could not save this place. Your habit is saved.');
        } finally {
            locationLockRef.current = false;
            setLocating(false);
        }
    };

    const finish = async () => {
        // Only mark onboarding done once the habit actually exists.
        if (draft.createdHabitId) await setOnboardingComplete();
        await clearDraft();
        router.replace('/(root)/(tabs)/home');
    };

    const enableReminder = async (time: string) => {
        if (!draft.createdHabitId) return;
        setReminderNote(null);
        const granted = await NotificationService.requestPermissions();
        if (!granted) {
            // The true result, not the toggle state.
            setReminderNote('Notifications are turned off for Habyss, so no reminder was scheduled. Your habit is saved and you can turn reminders on later in Settings.');
            return;
        }
        try {
            const habit = { ...draftToHabit(draft), id: draft.createdHabitId, reminders: [time] };
            await updateHabit({ id: draft.createdHabitId, reminders: [time] });
            // scheduleHabitReminder cancels this habit's existing reminders first,
            // so changing the time cannot leave a duplicate behind.
            await NotificationService.scheduleHabitReminder(habit);
            update({ reminderTime: time });
            setReminderNote(`Reminder set for ${time}, ${describeRecurrence(draft).toLowerCase()}.`);
            successFeedback();
        } catch {
            setReminderNote('The reminder could not be scheduled. Your habit is saved.');
        }
    };

    /* ------------------------------------------------------------ shared bits */

    const Header = ({ onBack, title }: { onBack?: () => void; title?: string }) => (
        <View style={styles.header}>
            <View style={styles.headerSide}>
                {onBack ? (
                    <TouchableOpacity onPress={() => { lightFeedback(); onBack(); }} accessibilityLabel="Back" style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
                    </TouchableOpacity>
                ) : null}
            </View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title ?? ''}</Text>
            <View style={styles.headerSide} />
        </View>
    );

    const Progress = () => (
        <View style={styles.progressRow} accessibilityLabel={`Step ${stepIndex} of ${LAST_SETUP_STEP}`}>
            {STEPS.slice(1, LAST_SETUP_STEP + 1).map((_, index) => (
                <View
                    key={index}
                    style={[styles.progressDot, {
                        backgroundColor: index < stepIndex ? accent : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)'),
                        width: index === stepIndex - 1 ? 22 : 8,
                    }]}
                />
            ))}
        </View>
    );

    const PrimaryButton = ({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) => (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled || busy}
            onPress={() => { lightFeedback(); onPress(); }}
            style={[styles.primaryBtn, { backgroundColor: disabled ? (isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)') : accent }]}
        >
            {busy ? <ActivityIndicator color="#000" /> : (
                <Text style={[styles.primaryBtnText, { color: disabled ? colors.textTertiary : '#000' }]}>{label}</Text>
            )}
        </TouchableOpacity>
    );

    const SectionTitle = ({ children, description }: { children: string; description?: string }) => (
        <View style={{ marginBottom: 14 }}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{children.toUpperCase()}</Text>
            {description ? <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>{description}</Text> : null}
        </View>
    );

    const Choice = ({ selected, title, subtitle, icon, onPress, trailing }: {
        selected: boolean; title: string; subtitle?: string; icon?: string; onPress: () => void; trailing?: React.ReactNode;
    }) => (
        <TouchableOpacity
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            activeOpacity={0.85}
            onPress={() => { lightFeedback(); onPress(); }}
            style={[styles.choice, {
                backgroundColor: selected ? accent + '14' : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                borderColor: selected ? accent : 'transparent',
            }]}
        >
            {icon ? (
                <View style={[styles.choiceIcon, { backgroundColor: selected ? accent + '22' : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)') }]}>
                    <Ionicons name={icon as any} size={20} color={selected ? accent : colors.textSecondary} />
                </View>
            ) : null}
            <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>{title}</Text>
                {subtitle ? <Text style={[styles.choiceSub, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
            </View>
            {trailing ?? <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? accent : colors.textTertiary} />}
        </TouchableOpacity>
    );

    const ErrorNote = () => error ? (
        <View style={[styles.note, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={[styles.noteText, { color: colors.error }]}>{error}</Text>
        </View>
    ) : null;

    /* ----------------------------------------------------------------- steps */

    const renderWelcome = () => (
        // Just the mark and the line. Anywhere on the screen moves on, and it
        // moves on by itself so nobody is left looking at a dead end.
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${APP_NAME}. ${APP_SLOGAN}. Tap to begin.`}
            onPress={() => goTo(STEP.goal)}
            style={styles.splash}
        >
            <View style={styles.splashInner}>
                <SpinningLogo size={124} glow />
                <Text style={[styles.brandName, { color: colors.textPrimary }]}
                >
                    {APP_NAME}
                </Text>
                <Text style={[styles.brandSlogan, { color: colors.textSecondary }]}
                >
                    {APP_SLOGAN}
                </Text>
            </View>
            <TouchableOpacity
                accessibilityRole="button"
                onPress={() => { lightFeedback(); router.push('/(root)/account?restore=1'); }}
                style={styles.returning}
            >
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>I already have an account</Text>
            </TouchableOpacity>
        </Pressable>
    );

    /* ------------------------------------------------------- the seven answers */

    const renderGoal = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionTitle>What’s the one goal that would change how you see yourself if you hit it in the next 90 days?</SectionTitle>

            <TextInput
                value={draft.identityGoal ?? ''}
                onChangeText={text => update({ identityGoal: text })}
                autoFocus
                multiline
                placeholder="Run a 10K without stopping"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Your goal"
                style={[styles.input, styles.habitInput, {
                    color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                }]}
            />

            <View style={{ height: 18 }} />
            <PrimaryButton label="Continue" onPress={() => goTo(STEP.attempts)} disabled={!draft.identityGoal?.trim()} />
        </ScrollView>
    );

    const renderAttempts = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>How many times have you tried to start this before?</SectionTitle>
            <View style={{ gap: 8 }}>
                {ATTEMPTS.map(option => (
                    <Choice
                        key={option.id}
                        selected={draft.attempts === option.id}
                        title={option.label}
                        onPress={() => chooseAndAdvance({ attempts: option.id }, STEP.killers)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    const renderKillers = () => {
        const chosen = draft.killers ?? [];
        const toggle = (id: KillerId) => {
            cancelAdvance();
            update({ killers: chosen.includes(id) ? chosen.filter(k => k !== id) : [...chosen, id] });
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>What usually kills your momentum?</SectionTitle>
                <View style={{ gap: 8 }}>
                    {KILLERS.map(killer => (
                        <Choice
                            key={killer.id}
                            selected={chosen.includes(killer.id)}
                            title={killer.label}
                            onPress={() => toggle(killer.id)}
                        />
                    ))}
                </View>
                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.stakes)} disabled={chosen.length === 0} />
            </ScrollView>
        );
    };

    const renderStakes = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionTitle>If a year from now you’ve given up again, what did it cost you?</SectionTitle>

            <TextInput
                value={draft.stakesText ?? ''}
                onChangeText={text => update({ stakesText: text })}
                autoFocus
                multiline
                placeholder="Another year of feeling the same way"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="What giving up would cost"
                style={[styles.input, styles.habitInput, {
                    color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                }]}
            />
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
                Your coach will quote this back when it matters.
            </Text>

            <View style={{ height: 14 }} />
            <PrimaryButton label="Continue" onPress={() => goTo(STEP.tone)} disabled={!draft.stakesText?.trim()} />
            <TouchableOpacity
                accessibilityRole="button"
                onPress={() => { lightFeedback(); update({ stakesText: '', step: STEP.tone }); }}
                style={styles.secondaryBtn}
            >
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderTone = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>How do you want to be coached?</SectionTitle>
            <View style={{ gap: 8 }}>
                {TONES.map(option => (
                    <Choice
                        key={option.id}
                        selected={draft.tone === option.id}
                        title={option.label}
                        subtitle={option.blurb}
                        onPress={() => chooseAndAdvance({ tone: option.id }, STEP.time)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    const renderTime = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>Honestly, how much time can you give this every day?</SectionTitle>
            <View style={{ gap: 8 }}>
                {TIME_BUDGETS.map(option => (
                    <Choice
                        key={option.id}
                        selected={draft.timeBudget === option.id}
                        title={option.label}
                        onPress={() => chooseAndAdvance({ timeBudget: option.id }, STEP.measurable)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    const renderMeasurable = () => {
        const text = draft.measurableText ?? draft.identityGoal ?? '';
        const parsed = text.trim() ? parseGoalText(text, { today: new Date(), habits: [] }) : null;
        const spec = parsed?.goal;

        // A goal like "lose 5 kg" is measurable, it just needs a starting point,
        // so the step asks for that here instead of refusing to continue.
        const needsBaseline = parsed?.missing_fields.includes('baseline') ?? false;
        const baselineValue = Number(draft.baselineText);
        const baselineReady = !needsBaseline
            || ((draft.baselineText ?? '').trim() !== '' && Number.isFinite(baselineValue));
        const otherMissing = (parsed?.missing_fields ?? []).filter(field => field !== 'baseline');
        const ready = !!parsed && otherMissing.length === 0 && baselineReady;

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <SectionTitle>How will you know you’ve made it?</SectionTitle>

                <TextInput
                    value={text}
                    onChangeText={value => update({ measurableText: value })}
                    multiline
                    placeholder="Run 50 km this month"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Your measurable goal"
                    style={[styles.input, styles.habitInput, {
                        color: colors.textPrimary, borderColor: ready ? accent + '55' : colors.border,
                        backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                    }]}
                />

                {spec ? (
                    <VoidCard style={styles.parsedCard}>
                        <Text style={[styles.parsedName, { color: colors.textPrimary }]}>{spec.title}</Text>
                        <Text style={[styles.parsedLine, { color: ready ? accent : colors.textTertiary }]}>
                            {spec.delta_from_baseline !== null
                                ? `${spec.delta_from_baseline} ${spec.metric_unit} to lose`
                                : ready && spec.target !== null
                                ? `${spec.direction === 'at_most' ? 'At most ' : ''}${spec.metric_unit === 'percent'
                                    ? `${Math.round(spec.target * 100)}% of days`
                                    : `${spec.target} ${spec.metric_unit}`}`
                                    : 'Not measurable yet'}
                        </Text>
                        {parsed?.clarifying_question ? (
                            <Text style={[styles.hint, { color: colors.textTertiary }]}>{parsed.clarifying_question}</Text>
                        ) : null}
                        {needsBaseline ? (
                            <TextInput
                                value={draft.baselineText ?? ''}
                                onChangeText={value => update({ baselineText: value })}
                                keyboardType="decimal-pad"
                                placeholder={`Current ${spec?.metric_unit ?? 'value'}`}
                                placeholderTextColor={colors.textTertiary}
                                accessibilityLabel="Current value"
                                style={[styles.input, {
                                    marginTop: 4,
                                    color: colors.textPrimary, borderColor: colors.border,
                                    backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                                }]}
                            />
                        ) : null}
                    </VoidCard>
                ) : null}

                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.roadmap)} disabled={!ready} />
            </ScrollView>
        );
    };

    /* -------------------------------------------------------------- the roadmap */

    const renderRoadmap = () => {
        const goalText = (draft.measurableText ?? draft.identityGoal ?? '').trim();
        const parsed = goalText ? parseGoalText(goalText, { today: new Date(), habits: [] }) : null;
        const spec = parsed?.goal;
        const minutes = dailyTargetMinutes(draft.timeBudget, draft.killers);

        const steps = draft.roadmapSteps ?? [];
        const habitLabel = `${draft.targetValue ?? minutes} ${draft.targetUnit ?? 'min'}`;
        // Minutes move in fives; anything counted moves by about a tenth, so the
        // buttons are useful whether the target is 3 km or 300 pages.
        const current = draft.targetValue ?? minutes;
        const stepSize = (draft.targetUnit ?? 'min') === 'min'
            ? 5
            : Math.max(current >= 10 ? 1 : 0.5, tidy(current * 0.1));

        const removeStep = (id: string) => {
            lightFeedback();
            update({ roadmapSteps: steps.filter(step => step.id !== id) });
        };

        const addStep = () => {
            lightFeedback();
            // A new step lands halfway to the deadline, which is the most likely
            // place to want one, and is editable afterwards.
            const end = spec?.window?.kind === 'fixed' ? new Date(`${spec.window.end}T12:00:00`) : new Date();
            const half = new Date((Date.now() + end.getTime()) / 2);
            update({
                roadmapSteps: [...steps, {
                    id: `step_${Date.now()}`,
                    title: '',
                    dueDate: localDateKey(half),
                }],
            });
        };

        const editStep = (id: string, title: string) => {
            update({ roadmapSteps: steps.map(step => (step.id === id ? { ...step, title } : step)) });
        };

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <SectionTitle>What gets you there?</SectionTitle>

                <VoidCard style={styles.introCard}>
                    <View style={styles.coachHead}>
                        <Ionicons name="flag-outline" size={18} color={accent} />
                        <Text style={[styles.choiceTitle, { color: colors.textPrimary, flex: 1 }]} numberOfLines={2}>
                            {spec?.title ?? goalText}
                        </Text>
                    </View>
                </VoidCard>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>EVERY DAY</Text>
                <View style={[styles.roadRow, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}>
                    <Ionicons name="repeat" size={18} color="#10B981" />
                    <TextInput
                        value={draft.habitName ?? ''}
                        onChangeText={text => update({ habitName: text })}
                        placeholder="Your daily habit"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Daily habit"
                        style={[styles.roadText, { color: colors.textPrimary, paddingVertical: 0 }]}
                    />
                    {/* The amount is adjusted here, in place. Sending the user back
                        to the time question bounced them two steps and never
                        applied the change, because this was already seeded. */}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Less each day"
                        onPress={() => { lightFeedback(); update({ targetValue: Math.max(1, tidy((draft.targetValue ?? minutes) - stepSize)) }); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                    >
                        <Ionicons name="remove-circle-outline" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.roadMeta, { color: colors.textPrimary, minWidth: 54, textAlign: 'center' }]}>{habitLabel}</Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="More each day"
                        onPress={() => { lightFeedback(); update({ targetValue: tidy((draft.targetValue ?? minutes) + stepSize) }); }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    >
                        <Ionicons name="add-circle-outline" size={22} color={accent} />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>CHECKPOINTS</Text>
                <View style={{ gap: 8 }}>
                    {steps.map(step => (
                        <View
                            key={step.id}
                            style={[styles.roadRow, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}
                        >
                            <Ionicons name="square-outline" size={18} color="#F59E0B" />
                            <TextInput
                                value={step.title}
                                onChangeText={text => editStep(step.id, text)}
                                placeholder="What has to be true by then"
                                placeholderTextColor={colors.textTertiary}
                                accessibilityLabel="Checkpoint"
                                style={[styles.roadText, { color: colors.textPrimary, paddingVertical: 0 }]}
                            />
                            <Text style={[styles.roadMeta, { color: colors.textTertiary }]}>
                                {new Date(`${step.dueDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${step.title || 'checkpoint'}`}
                                onPress={() => removeStep(step.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    ))}

                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={addStep}
                        style={[styles.roadRow, { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' }]}
                    >
                        <Ionicons name="add" size={18} color={accent} />
                        <Text style={[styles.roadText, { color: accent }]}>Add a checkpoint</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    Checkpoints become tasks under this goal. The habit is what you do about it daily.
                </Text>

                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.payoff)} disabled={!draft.habitName?.trim()} />
            </ScrollView>
        );
    };

    /* --------------------------------------------------------------- the payoff */

    const renderPayoff = () => {
        const plan = planFor(draft.killers);
        const minutes = dailyTargetMinutes(draft.timeBudget, draft.killers);
        const goalText = (draft.measurableText ?? draft.identityGoal ?? '').trim();
        const parsed = goalText ? parseGoalText(goalText, { today: new Date(), habits: [] }) : null;
        // Only checkpoints the user actually named; a blank row is not a step.
        const namedSteps = (draft.roadmapSteps ?? []).filter(step => step.title.trim());

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.payoffHead, { color: colors.textPrimary }]}>
                    {payoffHeadline(draft.attempts, draft.killers)}
                </Text>
                <Text style={[styles.payoffSub, { color: colors.textSecondary }]}>So here’s how we handle it.</Text>

                <View style={{ gap: 8, marginTop: 16 }}>
                    {plan.map(line => (
                        <View key={line} style={[styles.planRowItem, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)' }]}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={accent} />
                            <Text style={[styles.planText, { color: colors.textPrimary }]}>{line}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ marginTop: 18 }}>
                    <Row2 label="Goal" value={parsed?.goal.title ?? goalText} />
                    <Row2
                        label="Every day"
                        value={draft.habitName?.trim()
                            ? `${draft.habitName.trim()} · ${draft.targetValue ?? minutes} ${draft.targetUnit ?? 'min'}`
                            : `${minutes} min`}
                    />
                    <Row2 label="Coach" value={TONES.find(t => t.id === draft.tone)?.label ?? 'Straight up'} />
                </View>

                {namedSteps.length > 0 ? (
                    <View style={{ marginTop: 18, gap: 8 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>THE PATH</Text>
                        {namedSteps.map(step => (
                            <View key={step.id} style={[styles.roadRow, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}>
                                <Ionicons name="square-outline" size={16} color="#F59E0B" />
                                <Text style={[styles.roadText, { color: colors.textPrimary }]} numberOfLines={1}>{step.title}</Text>
                                <Text style={[styles.roadMeta, { color: colors.textTertiary }]}>
                                    {new Date(`${step.dueDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <ErrorNote />

                <View style={{ height: 18 }} />
                <PrimaryButton label="Start my plan" onPress={startPlan} busy={saving} disabled={!goalText} />
            </ScrollView>
        );
    };

    const Row2 = ({ label, value }: { label: string; value: string }) => (
        <View style={[styles.planRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.planLabel, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
            <Text style={[styles.planValue, { color: colors.textPrimary, flex: 1, textAlign: 'right' }]} numberOfLines={2}>{value}</Text>
        </View>
    );


    const renderReminder = () => {
        // If they wrote "at 6", that is already the time they meant.
        const time = draft.reminderTime ?? draft.startTime ?? '08:00';
        const [hour, minute] = time.split(':').map(Number);
        const pickerValue = new Date();
        pickerValue.setHours(hour || 8, minute || 0, 0, 0);
        const recommended = shouldOfferReminder(draft.killers);

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.savedBanner, { borderColor: accent + '44', backgroundColor: accent + '10' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={accent} />
                    <Text style={[styles.nextText, { color: colors.textPrimary }]}>
                        {draft.habitName?.trim()} is saved.
                    </Text>
                </View>

                <View style={{ height: 18 }} />
                <SectionTitle>{recommended ? 'A reminder might help' : 'Want a reminder?'}</SectionTitle>

                <View style={{ alignItems: 'center' }}>
                    <DateTimePicker
                        value={pickerValue}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        themeVariant={isLight ? 'light' : 'dark'}
                        onChange={(_event, selected) => {
                            if (!selected) return;
                            const next = `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
                            setDraftState(current => current ? { ...current, reminderTime: next } : current);
                        }}
                    />
                </View>

                {reminderNote ? (
                    <View style={[styles.note, { backgroundColor: (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)'), borderColor: colors.border }]}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{reminderNote}</Text>
                    </View>
                ) : null}

                <View style={{ height: 18 }} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>OR WHEN YOU ARRIVE SOMEWHERE</Text>
                <View style={styles.chipRow}>
                    {(['Home', 'Work', 'Gym'] as const).map(label => (
                        <TouchableOpacity
                            key={label}
                            accessibilityRole="button"
                            accessibilityLabel={`Remind me when I arrive at ${label}`}
                            disabled={locating}
                            onPress={() => addArrivalReminder(label)}
                            style={[styles.chip, {
                                backgroundColor: draft.arrivalPlace === label ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                borderColor: draft.arrivalPlace === label ? accent : 'transparent',
                            }]}
                        >
                            {locating ? <ActivityIndicator size="small" color={accent} /> : (
                                <Text style={{ color: draft.arrivalPlace === label ? accent : colors.textSecondary, fontFamily: 'Lexend_500Medium', fontSize: 13 }}>
                                    {label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    Uses where you are right now as that place.
                </Text>

                <View style={{ height: 14 }} />
                <View style={{ gap: 10 }}>
                    <PrimaryButton label={`Remind me at ${time}`} onPress={() => enableReminder(time)} />
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                            lightFeedback();
                            // Inviting someone answers "nobody holds me accountable" and
                            // nothing else; showing it to everyone made that answer decorative.
                            if (shouldSuggestSharing(draft.killers)) goTo(STEP.friends);
                            else finish();
                        }}
                        style={styles.secondaryBtn}
                    >
                        <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                            {reminderNote ? 'Done' : 'Not now'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderFriends = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>Do it with someone</SectionTitle>

            <View>
                <VoidCard style={styles.introCard}>
                    <Ionicons name="people-outline" size={22} color={accent} />
                    <Text style={[styles.introText, { color: colors.textPrimary }]}>
                        People who start with someone else keep going for longer. Invite one person and you will both see
                        each other in Habyss.
                    </Text>
                </VoidCard>
            </View>

            <View style={{ height: 18 }} />
            <PrimaryButton label="Invite a friend" onPress={inviteFriend} />
            <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); finish(); }} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Maybe later</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const screens: Record<number, () => React.ReactNode> = {
        [STEP.welcome]: renderWelcome,
        [STEP.goal]: renderGoal,
        [STEP.attempts]: renderAttempts,
        [STEP.killers]: renderKillers,
        [STEP.stakes]: renderStakes,
        [STEP.tone]: renderTone,
        [STEP.time]: renderTime,
        [STEP.measurable]: renderMeasurable,
        [STEP.roadmap]: renderRoadmap,
        [STEP.payoff]: renderPayoff,
        [STEP.reminder]: renderReminder,
        [STEP.friends]: renderFriends,
    };

    const backFor = (step: number): (() => void) | undefined => {
        // Nothing behind welcome, and the habit is already saved from the reminder
        // step onwards, so going back there would offer to create it twice.
        if (step === STEP.welcome || step === STEP.reminder || step === STEP.friends) return undefined;
        return () => goTo(step - 1);
    };

    const titles: Record<number, string> = {
        [STEP.goal]: 'Your goal',
        [STEP.attempts]: 'History',
        [STEP.killers]: 'What gets in the way',
        [STEP.stakes]: 'The cost',
        [STEP.tone]: 'Your coach',
        [STEP.time]: 'Your time',
        [STEP.measurable]: 'Make it measurable',
        [STEP.roadmap]: 'Your roadmap',
        [STEP.payoff]: 'Your plan',
        [STEP.reminder]: 'Reminder',
        [STEP.friends]: 'Friends',
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <Header onBack={backFor(draft.step)} title={titles[draft.step]} />
                    {draft.step > 0 && draft.step <= LAST_SETUP_STEP ? <Progress /> : null}
                    <View key={draft.step} style={{ flex: 1 }}>
                        {(screens[draft.step] ?? renderWelcome)()}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
    headerSide: { width: 44, height: 44, justifyContent: 'center' },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', fontFamily: 'Lexend' },
    progressRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 10 },
    progressDot: { height: 8, borderRadius: 4 },
    content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 6 },
    weekStrip: { flexDirection: 'row', gap: 6, justifyContent: 'space-between', marginTop: 6 },
    weekDay: { flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    splash: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    returning: { position: 'absolute', bottom: 48, paddingVertical: 12, paddingHorizontal: 24 },
    splashInner: { alignItems: 'center' },
    brand: { alignItems: 'center', marginTop: 18, gap: 2 },
    brandName: { marginTop: 18, fontSize: 32, letterSpacing: 8, fontFamily: 'SpaceGrotesk_700Bold' },
    brandSlogan: { marginTop: 10, fontSize: 15, lineHeight: 22, fontFamily: 'Lexend_400Regular', textAlign: 'center' },
    heroSub: { fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular', marginTop: 22, textAlign: 'center' },
    previewBadgeRow: { flexDirection: 'row', marginTop: 26, marginBottom: 8 },
    previewBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
    previewBadgeText: { fontSize: 9, letterSpacing: 1.2, fontFamily: 'Lexend_600SemiBold' },
    previewCard: { padding: 16 },
    previewHabitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewCoach: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
    previewCoachText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular' },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'Lexend', marginBottom: 4 },
    sectionDesc: { fontSize: 13, lineHeight: 18, fontFamily: 'Lexend_400Regular' },
    choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
    choiceIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    choiceTitle: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    choiceSub: { fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    fieldLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: 'Lexend_400Regular' },
    habitInput: { minHeight: 88, paddingTop: 14, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
    parsedCard: { padding: 16, gap: 6 },
    roadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14 },
    roadText: { flex: 1, fontSize: 14, fontFamily: 'Lexend_500Medium' },
    roadMeta: { fontSize: 12, fontFamily: 'Lexend_400Regular' },
    payoffHead: { fontSize: 24, lineHeight: 32, fontFamily: 'Lexend_600SemiBold', marginTop: 4 },
    payoffSub: { fontSize: 14, lineHeight: 20, fontFamily: 'Lexend_400Regular', marginTop: 8 },
    planRowItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 14 },
    planText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular' },
    parsedName: { fontSize: 18, fontFamily: 'Lexend_600SemiBold' },
    parsedLine: { fontSize: 14, fontFamily: 'Lexend_500Medium' },
    targetRow: { flexDirection: 'row', gap: 10 },
    targetValue: { width: 96, textAlign: 'center' },
    trackChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
    dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    hint: { fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular', marginTop: 8 },
    nextCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 20 },
    nextText: { flex: 1, fontSize: 14, fontFamily: 'Lexend_500Medium' },
    savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },
    coachCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
    coachHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    coachQuote: { fontSize: 13, lineHeight: 20, fontFamily: 'Lexend_400Regular', fontStyle: 'italic' },
    coachWarning: { fontSize: 11, lineHeight: 16, fontFamily: 'Lexend_400Regular' },
    defaultTag: { fontSize: 9, letterSpacing: 1, fontFamily: 'Lexend_600SemiBold' },
    introCard: { padding: 16, gap: 10 },
    introText: { fontSize: 15, lineHeight: 22, fontFamily: 'Lexend_400Regular' },
    planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    planLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium' },
    planValue: { fontSize: 15, fontFamily: 'Lexend_500Medium', marginTop: 3 },
    editText: { fontSize: 13, fontFamily: 'Lexend_600SemiBold' },
    primaryBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center' },
    primaryBtnText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
    secondaryBtnText: { fontSize: 14, fontFamily: 'Lexend_500Medium' },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 14 },
    noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular' },
});

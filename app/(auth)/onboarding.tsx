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
import Animated, { FadeIn, FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';

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
import { setLocalProfileName, setOnboardingComplete } from '@/lib/localUser';
import { isHabitScheduledForDate, localDateKey } from '@/lib/habitSchedule';
import { coachPlanIntro, coachPreview } from '@/lib/coachMessages';
import { describeParsed, parseHabitText } from '@/lib/habitParser';
import {
    AREAS, MAX_AREAS, OBSTACLES, SUPPORTS, clearDraft, coachForSupport,
    describeRecurrence, draftToHabit, hasValidSchedule, loadDraft, nextOccurrence,
    obstacleResponse, prefersNumericTracking, rankSuggestions,
    draftFromParsedHabit, saveDraft, shouldOfferReminder, shouldSuggestCue, suggestionToSentence,
    type AreaId, type OnboardingDraft, type RecurrenceId, type SupportId,
} from '@/lib/onboarding';

/** Just long enough for the selected state to paint before the step changes. */
const SELECT_ADVANCE_MS = 180;

const STEPS = [
    'welcome', 'name', 'direction', 'obstacle', 'support',
    'habit', 'coach', 'confirm', 'reminder', 'friends',
] as const;
/** Confirm is the last step of setup; everything after it follows the saved habit. */
const LAST_SETUP_STEP = 7;

const STEP = {
    welcome: 0, name: 1, direction: 2, obstacle: 3, support: 4,
    habit: 5, coach: 6, confirm: 7, reminder: 8, friends: 9,
} as const;

export default function OnboardingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const { setAIPersonality } = useAppSettings();
    const reduceMotion = useReducedMotion();

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

    if (!draft) return <HabyssBootScreen subtitle="Getting things ready" />;

    const enter = reduceMotion ? undefined : FadeIn.duration(220);
    /** Options fall in one after another, so a list reads as arriving. */
    const stagger = (index: number) =>
        reduceMotion ? undefined : FadeInDown.delay(60 + index * 55).duration(360).springify().damping(17);
    const stepIndex = Math.min(draft.step, STEPS.length - 1);
    const suggestions = rankSuggestions(draft.areaIds, draft.obstacleId);
    // The support answer chooses the coach unless the user picks another one.
    const defaultCoach = coachForSupport(draft.supportId);
    const firstName = draft.name?.trim() ?? '';

    /* ---------------------------------------------------------------- saving */

    const startPlan = async () => {
        // Guard both the ref and the stored id: a double tap or a retry after a
        // partial failure must never create a second habit.
        if (savingRef.current) return;
        if (draft.createdHabitId) { goTo(STEP.reminder); return; }
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            // The reminder is deliberately not part of this write. Notification
            // failure is handled separately so it cannot lose the saved habit.
            const created = await addHabit(draftToHabit(draft));
            if (!created?.id) throw new Error('Habit was not saved');
            // The name is only stored once there is a plan to attach it to.
            if (firstName) await setLocalProfileName(firstName);
            setAIPersonality(draft.coachId ?? defaultCoach);
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
            onPress={() => goTo(STEP.name)}
            style={styles.splash}
        >
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(700)} style={styles.splashInner}>
                <SpinningLogo size={124} glow />
                <Animated.Text
                    entering={reduceMotion ? undefined : FadeInDown.delay(320).duration(650)}
                    style={[styles.brandName, { color: colors.textPrimary }]}
                >
                    {APP_NAME}
                </Animated.Text>
                <Animated.Text
                    entering={reduceMotion ? undefined : FadeInDown.delay(620).duration(700)}
                    style={[styles.brandSlogan, { color: colors.textSecondary }]}
                >
                    {APP_SLOGAN}
                </Animated.Text>
            </Animated.View>
        </Pressable>
    );

    const renderName = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionTitle>What should we call you?</SectionTitle>

            <TextInput
                value={draft.name ?? ''}
                onChangeText={text => update({ name: text })}
                autoFocus
                autoCapitalize="words"
                autoComplete="given-name"
                returnKeyType="next"
                blurOnSubmit
                // The keyboard's Next is the only way forward here, plus Skip.
                onSubmitEditing={() => { if (firstName) goTo(STEP.direction); }}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Your name"
                style={[styles.input, {
                    color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                }]}
            />

            <View style={{ height: 10 }} />
            <TouchableOpacity
                accessibilityRole="button"
                onPress={() => { lightFeedback(); update({ name: '', step: STEP.direction }); }}
                style={styles.secondaryBtn}
            >
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Skip for now</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderDirection = () => {
        const chosen = draft.areaIds ?? [];
        const toggleArea = (id: AreaId) => {
            if (chosen.includes(id)) {
                cancelAdvance();
                update({ areaIds: chosen.filter(area => area !== id) });
                return;
            }
            // Oldest choice drops out once two are picked, so a third tap still works.
            const next = chosen.length >= MAX_AREAS ? [...chosen.slice(1), id] : [...chosen, id];

            // This step allows two answers, so it only moves on by itself once
            // both are chosen. One area plus Continue is still the quick path.
            if (next.length >= MAX_AREAS) {
                chooseAndAdvance({ areaIds: next }, STEP.obstacle);
                return;
            }
            update({ areaIds: next });
        };

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>
                    {firstName ? `What would you like to make more time for, ${firstName}?` : 'What would you like to make more time for?'}
                </SectionTitle>

                <View style={{ gap: 8 }}>
                    {AREAS.map((area, index) => (
                        <Animated.View key={area.id} entering={stagger(index)}>
                            <Choice
                                selected={chosen.includes(area.id)}
                                title={area.label}
                                icon={area.icon}
                                onPress={() => toggleArea(area.id)}
                            />
                        </Animated.View>
                    ))}
                </View>

                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    {chosen.length}/{MAX_AREAS} selected
                </Text>

                <View style={{ height: 14 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.obstacle)} disabled={chosen.length === 0} />
            </ScrollView>
        );
    };

    const renderObstacle = () => {
        const response = obstacleResponse(draft.obstacleId);
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>What usually gets in the way?</SectionTitle>

                <View style={{ gap: 8 }}>
                    {OBSTACLES.map((obstacle, index) => (
                        <Animated.View key={obstacle.id} entering={stagger(index)}>
                            <Choice
                                selected={draft.obstacleId === obstacle.id}
                                title={obstacle.label}
                                onPress={() => chooseAndAdvance({ obstacleId: obstacle.id }, STEP.support)}
                            />
                        </Animated.View>
                    ))}
                </View>

            </ScrollView>
        );
    };

    const renderSupport = () => {
        // The response to the previous answer lands here, where it can be read,
        // rather than flashing past on the step that produced it.
        const response = obstacleResponse(draft.obstacleId);
        return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {response ? (
                <View style={[styles.nextCard, { marginTop: 0, marginBottom: 20, borderColor: accent + '44', backgroundColor: accent + '10' }]}>
                    <Ionicons name="sparkles-outline" size={18} color={accent} />
                    <Text style={[styles.nextText, { color: colors.textPrimary }]}>{response}</Text>
                </View>
            ) : null}

            <SectionTitle>What would help you most?</SectionTitle>

            <View style={{ gap: 8 }}>
                {SUPPORTS.map((support, index) => (
                    <Animated.View key={support.id} entering={stagger(index)}>
                        <Choice
                            selected={draft.supportId === support.id}
                            title={support.label}
                            // The coach follows this answer until the user picks one themselves.
                            onPress={() => chooseAndAdvance({ supportId: support.id }, STEP.habit)}
                        />
                    </Animated.View>
                ))}
            </View>

        </ScrollView>
        );
    };

    const renderHabit = () => {
        const text = draft.habitText ?? '';
        const parsed = text.trim() ? parseHabitText(text) : null;
        const canContinue = !!parsed?.name.trim();

        // Typing is the whole input. Days, times and targets are read out of the
        // sentence and carried into the schedule and confirm steps.
        const onChangeText = (value: string) => {
            const next = value.trim() ? parseHabitText(value) : null;
            update(next
                ? { habitText: value, ...draftFromParsedHabit(next) }
                : { habitText: value, habitName: undefined, targetValue: undefined, targetUnit: undefined });
        };

        // Tapping a suggestion writes the sentence, so the syntax is learned by
        // seeing it rather than being explained.
        const useSuggestion = (suggestion: typeof suggestions[number]) => {
            lightFeedback();
            const sentence = suggestionToSentence(suggestion, draft.obstacleId);
            update({
                habitText: sentence,
                ...draftFromParsedHabit(parseHabitText(sentence)),
                icon: suggestion.icon,
                category: suggestion.category,
                suggestionId: suggestion.id,
                cue: shouldSuggestCue(draft.obstacleId) ? (draft.cue ?? suggestion.suggestedCue) : draft.cue,
            });
        };

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <SectionTitle>Your first habit</SectionTitle>

                <TextInput
                    value={text}
                    onChangeText={onChangeText}
                    autoFocus
                    multiline
                    placeholder="Gym Monday, Wednesday, Friday at 6, 45 minutes"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Describe your habit"
                    style={[styles.input, styles.habitInput, {
                        color: colors.textPrimary, borderColor: parsed ? accent + '55' : colors.border,
                        backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                    }]}
                />

                {parsed ? (
                    <VoidCard style={styles.parsedCard}>
                        <Text style={[styles.parsedName, { color: colors.textPrimary }]}>{parsed.name || 'Name it'}</Text>
                        <Text style={[styles.parsedLine, { color: accent }]}>{describeParsed(parsed)}</Text>
                        {parsed.assumptions.map(note => (
                            <Text key={note} style={[styles.hint, { color: colors.textTertiary }]}>{note}</Text>
                        ))}
                    </VoidCard>
                ) : (
                    <View style={{ gap: 8 }}>
                        {suggestions.slice(0, 3).map((suggestion, index) => (
                            <Animated.View key={suggestion.id} entering={stagger(index)}>
                            <Choice
                                selected={false}
                                title={suggestionToSentence(suggestion, draft.obstacleId)}
                                icon={suggestion.icon}
                                onPress={() => useSuggestion(suggestion)}
                                trailing={<Ionicons name="arrow-forward" size={18} color={colors.textTertiary} />}
                            />
                            </Animated.View>
                        ))}
                    </View>
                )}

                {shouldSuggestCue(draft.obstacleId) ? (
                    <View style={{ marginTop: 4 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ANCHOR IT TO SOMETHING</Text>
                        <TextInput
                            value={draft.cue ?? ''}
                            onChangeText={value => update({ cue: value })}
                            placeholder="After breakfast"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Routine cue"
                            style={[styles.input, {
                                color: colors.textPrimary, borderColor: colors.border,
                                backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                            }]}
                        />
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                            A note on your card, not a detected trigger.
                        </Text>
                    </View>
                ) : null}

                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.coach)} disabled={!canContinue} />
            </ScrollView>
        );
    };

    const renderCoach = () => {
        const selected = draft.coachId ?? defaultCoach;
        const habitName = draft.habitName?.trim() || 'this habit';
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>Choose your coach</SectionTitle>

                <View style={{ gap: 10 }}>
                    {PERSONALITY_MODES.map((mode, index) => {
                        const on = selected === mode.id;
                        return (
                            <Animated.View key={mode.id} entering={stagger(index)}>
                            <TouchableOpacity
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                activeOpacity={0.85}
                                onPress={() => {
                                    lightFeedback();
                                    chooseAndAdvance({ coachId: mode.id }, STEP.confirm);
                                }}
                                style={[styles.coachCard, {
                                    backgroundColor: on ? accent + '14' : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                                    borderColor: on ? accent : 'transparent',
                                }]}
                            >
                                <View style={styles.coachHead}>
                                    <Text style={{ fontSize: 20 }}>{mode.icon}</Text>
                                    <Text style={[styles.choiceTitle, { color: colors.textPrimary, flex: 1 }]}>{mode.name}</Text>
                                    {mode.id === defaultCoach ? (
                                        <Text style={[styles.defaultTag, { color: colors.textTertiary }]}>DEFAULT</Text>
                                    ) : null}
                                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? accent : colors.textTertiary} />
                                </View>
                                <Text style={[styles.coachQuote, { color: colors.textSecondary }]}>“{coachPreview(mode.id, habitName)}”</Text>
                                {mode.warning ? (
                                    <Text style={[styles.coachWarning, { color: '#F59E0B' }]}>{mode.warning}</Text>
                                ) : null}
                            </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </View>

                <Text style={[styles.hint, { color: colors.textTertiary, marginTop: 14 }]}>
                    Written examples. Changeable later.
                </Text>

            </ScrollView>
        );
    };

    const renderConfirm = () => {
        const coach = draft.coachId ?? defaultCoach;
        const mode = PERSONALITY_MODES.find(item => item.id === coach)!;
        const next = nextOccurrence(draft);
        // Built from the same scheduler the rest of the app uses, so the strip
        // cannot promise a day Home would disagree with. It shows the schedule,
        // never progress: nothing here is a completion.
        const nextSevenDays = Array.from({ length: 7 }, (_, offset) => {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            date.setHours(12, 0, 0, 0);
            return {
                key: date.toISOString(),
                label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()],
                scheduled: isHabitScheduledForDate(draftToHabit(draft) as any, date),
            };
        });

        const targetText = draft.trackingMethod === 'boolean'
            ? 'Done or not done'
            : `${draft.targetValue ?? 1} ${draft.targetUnit ?? 'time'}`;

        const Row = ({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) => (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={() => { lightFeedback(); onEdit(); }} style={[styles.planRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.planLabel, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
                    <Text style={[styles.planValue, { color: colors.textPrimary }]}>{value}</Text>
                </View>
                <Text style={[styles.editText, { color: accent }]}>Edit</Text>
            </TouchableOpacity>
        );

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>Your plan</SectionTitle>

                <VoidCard style={styles.introCard}>
                    <View style={styles.coachHead}>
                        <Text style={{ fontSize: 18 }}>{mode.icon}</Text>
                        <Text style={[styles.choiceSub, { color: colors.textTertiary }]}>{mode.name}</Text>
                    </View>
                    <Text style={[styles.introText, { color: colors.textPrimary }]}>
                        {coachPlanIntro(coach, {
                            habitName: draft.habitName?.trim() || 'your habit',
                            target: targetText,
                            recurrence: describeRecurrence(draft),
                            cue: draft.cue?.trim() || undefined,
                        })}
                    </Text>
                </VoidCard>

                <Animated.View entering={reduceMotion ? undefined : FadeInUp.delay(120).duration(420)}>
                    <View style={styles.weekStrip}>
                        {nextSevenDays.map((day, index) => (
                            <Animated.View
                                key={day.key}
                                entering={reduceMotion ? undefined : FadeInDown.delay(200 + index * 60).duration(360).springify().damping(15)}
                                style={[styles.weekDay, {
                                    backgroundColor: day.scheduled ? accent : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.07)'),
                                }]}
                            >
                                <Text style={{
                                    fontSize: 11,
                                    fontFamily: 'Lexend_600SemiBold',
                                    color: day.scheduled ? '#000' : colors.textTertiary,
                                }}>{day.label}</Text>
                            </Animated.View>
                        ))}
                    </View>
                    <Text style={[styles.hint, { color: colors.textTertiary, textAlign: 'center' }]}>
                        Your next seven days
                    </Text>
                </Animated.View>

                <View style={{ marginTop: 14 }}>
                    <Row label="Habit" value={draft.habitName?.trim() || '—'} onEdit={() => goTo(STEP.habit)} />
                    <Row label="Target" value={targetText} onEdit={() => goTo(STEP.habit)} />
                    <Row label="Repeats" value={describeRecurrence(draft)} onEdit={() => goTo(STEP.habit)} />
                    <Row
                        label="Starts"
                        value={next ? next.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : 'No day chosen'}
                        onEdit={() => goTo(STEP.habit)}
                    />
                    <Row label="Routine cue" value={draft.cue?.trim() || 'None'} onEdit={() => goTo(STEP.habit)} />
                    <Row label="Coach" value={mode.name} onEdit={() => goTo(STEP.coach)} />
                </View>

                <ErrorNote />

                <View style={{ height: 18 }} />
                <PrimaryButton label="Start my plan" onPress={startPlan} busy={saving} disabled={!draft.habitName?.trim() || !hasValidSchedule(draft)} />
            </ScrollView>
        );
    };

    const renderReminder = () => {
        // If they wrote "at 6", that is already the time they meant.
        const time = draft.reminderTime ?? draft.startTime ?? '08:00';
        const [hour, minute] = time.split(':').map(Number);
        const pickerValue = new Date();
        pickerValue.setHours(hour || 8, minute || 0, 0, 0);
        const recommended = shouldOfferReminder(draft.obstacleId, draft.supportId);

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
                    <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); goTo(STEP.friends); }} style={styles.secondaryBtn}>
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

            <Animated.View entering={enter}>
                <VoidCard style={styles.introCard}>
                    <Ionicons name="people-outline" size={22} color={accent} />
                    <Text style={[styles.introText, { color: colors.textPrimary }]}>
                        People who start with someone else keep going for longer. Invite one person and you will both see
                        each other in Habyss.
                    </Text>
                </VoidCard>
            </Animated.View>

            <View style={{ height: 18 }} />
            <PrimaryButton label="Invite a friend" onPress={inviteFriend} />
            <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); finish(); }} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Maybe later</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const screens: Record<number, () => React.ReactNode> = {
        [STEP.welcome]: renderWelcome,
        [STEP.name]: renderName,
        [STEP.direction]: renderDirection,
        [STEP.obstacle]: renderObstacle,
        [STEP.support]: renderSupport,
        [STEP.habit]: renderHabit,
        [STEP.coach]: renderCoach,
        [STEP.confirm]: renderConfirm,
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
        [STEP.name]: 'About you',
        [STEP.direction]: 'Direction',
        [STEP.obstacle]: 'What gets in the way',
        [STEP.support]: 'Support',
        [STEP.habit]: 'First habit',
        [STEP.coach]: 'Coach',
        [STEP.confirm]: 'Confirm',
        [STEP.reminder]: 'Reminder',
        [STEP.friends]: 'Friends',
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <Header onBack={backFor(draft.step)} title={titles[draft.step]} />
                    {draft.step > 0 && draft.step <= LAST_SETUP_STEP ? <Progress /> : null}
                    <Animated.View key={draft.step} entering={enter} style={{ flex: 1 }}>
                        {(screens[draft.step] ?? renderWelcome)()}
                    </Animated.View>
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

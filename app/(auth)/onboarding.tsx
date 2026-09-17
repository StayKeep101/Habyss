import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

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
import { HabitGesturesTour } from '@/components/Onboarding/HabitGesturesTour';
import { addHabit, updateHabit } from '@/lib/habitsSQLite';
import { NotificationService } from '@/lib/notificationService';
import { setLocalProfileName, setOnboardingComplete } from '@/lib/localUser';
import { localDateKey } from '@/lib/habitSchedule';
import { coachPlanIntro, coachPreview } from '@/lib/coachMessages';
import { describeParsed, parseHabitText } from '@/lib/habitParser';
import {
    AREAS, MAX_AREAS, OBSTACLES, SUPPORTS, WEEKDAY_KEYS, clearDraft, coachForSupport,
    describeRecurrence, draftToHabit, hasValidSchedule, loadDraft, nextOccurrence,
    obstacleResponse, prefersNumericTracking, rankSuggestions,
    draftFromParsedHabit, saveDraft, shouldOfferReminder, shouldSuggestCue, suggestionToSentence,
    type AreaId, type OnboardingDraft, type RecurrenceId, type SupportId,
} from '@/lib/onboarding';

/** Just long enough for the selected state to paint before the step changes. */
const SELECT_ADVANCE_MS = 180;

const STEPS = [
    'welcome', 'name', 'direction', 'obstacle', 'support',
    'habit', 'schedule', 'coach', 'confirm', 'reminder', 'tour',
] as const;
/** Confirm is the last step of setup; the reminder comes after the habit is saved. */
const LAST_SETUP_STEP = 8;

const STEP = {
    welcome: 0, name: 1, direction: 2, obstacle: 3, support: 4,
    habit: 5, schedule: 6, coach: 7, confirm: 8, reminder: 9, tour: 10,
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.brand}>
                <SpinningLogo size={92} glow />
                <Text style={[styles.brandName, { color: colors.textPrimary }]}>{APP_NAME}</Text>
                <Text style={[styles.brandSlogan, { color: colors.textSecondary }]}>{APP_SLOGAN}</Text>
            </View>


            <View style={styles.previewBadgeRow}>
                <View style={[styles.previewBadge, { borderColor: accent + '55', backgroundColor: accent + '12' }]}>
                    <Text style={[styles.previewBadgeText, { color: accent }]}>EXAMPLE — NOT YOUR DATA</Text>
                </View>
            </View>

            <VoidCard style={styles.previewCard}>
                <View style={styles.previewHabitRow}>
                    <View style={[styles.choiceIcon, { backgroundColor: accent + '22' }]}>
                        <Ionicons name="walk-outline" size={20} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>Walk</Text>
                        <Text style={[styles.choiceSub, { color: colors.textTertiary }]}>15 min · Weekdays · After lunch</Text>
                    </View>
                    <Ionicons name="ellipse-outline" size={22} color={colors.textTertiary} />
                </View>
                <View style={[styles.previewCoach, { borderTopColor: colors.border }]}>
                    <Text style={{ fontSize: 18 }}>🙂</Text>
                    <Text style={[styles.previewCoachText, { color: colors.textSecondary }]}>
                        {coachPreview('normal', 'Walk')}
                    </Text>
                </View>
            </VoidCard>

            <View style={{ gap: 10, marginTop: 8 }}>
                <PrimaryButton label="Get started" onPress={() => goTo(STEP.name)} />
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => { lightFeedback(); update({ step: STEP.habit, suggestionId: 'custom', habitName: draft.habitName ?? '' }); }}
                    style={styles.secondaryBtn}
                >
                    <Text style={[styles.secondaryBtnText, { color: accent }]}>I already know my habit</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
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
                returnKeyType="done"
                onSubmitEditing={() => goTo(STEP.direction)}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Your name"
                style={[styles.input, {
                    color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                }]}
            />

            <View style={{ height: 20 }} />
            <PrimaryButton label="Continue" onPress={() => goTo(STEP.direction)} disabled={!firstName} />
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
                    {AREAS.map(area => (
                        <Choice
                            key={area.id}
                            selected={chosen.includes(area.id)}
                            title={area.label}
                            icon={area.icon}
                            onPress={() => toggleArea(area.id)}
                        />
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
                    {OBSTACLES.map(obstacle => (
                        <Choice
                            key={obstacle.id}
                            selected={draft.obstacleId === obstacle.id}
                            title={obstacle.label}
                            onPress={() => chooseAndAdvance({ obstacleId: obstacle.id }, STEP.support)}
                        />
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
                {SUPPORTS.map(support => (
                    <Choice
                        key={support.id}
                        selected={draft.supportId === support.id}
                        title={support.label}
                        // The coach follows this answer until the user picks one themselves.
                        onPress={() => chooseAndAdvance({ supportId: support.id }, STEP.habit)}
                    />
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
                        {suggestions.slice(0, 3).map(suggestion => (
                            <Choice
                                key={suggestion.id}
                                selected={false}
                                title={suggestionToSentence(suggestion, draft.obstacleId)}
                                icon={suggestion.icon}
                                onPress={() => useSuggestion(suggestion)}
                                trailing={<Ionicons name="arrow-forward" size={18} color={colors.textTertiary} />}
                            />
                        ))}
                    </View>
                )}

                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.schedule)} disabled={!canContinue} />
            </ScrollView>
        );
    };

    const renderSchedule = () => {
        const next = nextOccurrence(draft);
        const recurrences: { id: RecurrenceId; label: string }[] = [
            { id: 'daily', label: 'Every day' },
            { id: 'weekdays', label: 'Weekdays' },
            { id: 'custom', label: 'Pick days' },
        ];
        const days = draft.taskDays ?? [];

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <SectionTitle>When will you do it?</SectionTitle>

                <View style={styles.chipRow}>
                    {recurrences.map(option => (
                        <TouchableOpacity
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: draft.recurrence === option.id }}
                            onPress={() => { lightFeedback(); update({ recurrence: option.id }); }}
                            style={[styles.chip, {
                                backgroundColor: draft.recurrence === option.id ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                borderColor: draft.recurrence === option.id ? accent : 'transparent',
                            }]}
                        >
                            <Text style={{ color: draft.recurrence === option.id ? accent : colors.textSecondary, fontFamily: 'Lexend_500Medium', fontSize: 13 }}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {draft.recurrence === 'custom' ? (
                    <View style={[styles.chipRow, { marginTop: 12 }]}>
                        {WEEKDAY_KEYS.map(day => {
                            const on = days.includes(day);
                            return (
                                <TouchableOpacity
                                    key={day}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={day}
                                    onPress={() => {
                                        lightFeedback();
                                        update({ taskDays: on ? days.filter(d => d !== day) : [...days, day] });
                                    }}
                                    style={[styles.dayChip, {
                                        backgroundColor: on ? accent : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                    }]}
                                >
                                    <Text style={{ color: on ? '#000' : colors.textSecondary, fontFamily: 'Lexend_600SemiBold', fontSize: 12 }}>
                                        {day.charAt(0).toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : null}

                <View style={{ height: 22 }} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>START DATE</Text>
                <View style={styles.chipRow}>
                    {[
                        { label: 'Today', value: localDateKey(new Date()) },
                        { label: 'Tomorrow', value: localDateKey(new Date(Date.now() + 86400000)) },
                    ].map(option => (
                        <TouchableOpacity
                            key={option.label}
                            onPress={() => { lightFeedback(); update({ startDate: option.value }); }}
                            style={[styles.chip, {
                                backgroundColor: draft.startDate === option.value ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                borderColor: draft.startDate === option.value ? accent : 'transparent',
                            }]}
                        >
                            <Text style={{ color: draft.startDate === option.value ? accent : colors.textSecondary, fontFamily: 'Lexend_500Medium', fontSize: 13 }}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ height: 22 }} />
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ROUTINE CUE (OPTIONAL)</Text>
                <TextInput
                    value={draft.cue ?? ''}
                    onChangeText={text => update({ cue: text })}
                    placeholder="After breakfast"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}
                />
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                    A note on your card, not a detected trigger.
                </Text>

                <View style={[styles.nextCard, { borderColor: accent + '44', backgroundColor: accent + '10' }]}>
                    <Ionicons name="calendar-outline" size={18} color={accent} />
                    <Text style={[styles.nextText, { color: colors.textPrimary }]}>
                        {next
                            ? `Next: ${next.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`
                            : 'Pick at least one day to see the next occurrence'}
                    </Text>
                </View>

                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.coach)} disabled={!hasValidSchedule(draft)} />
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
                    {PERSONALITY_MODES.map(mode => {
                        const on = selected === mode.id;
                        return (
                            <TouchableOpacity
                                key={mode.id}
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

                <View style={{ marginTop: 14 }}>
                    <Row label="Habit" value={draft.habitName?.trim() || '—'} onEdit={() => goTo(STEP.habit)} />
                    <Row label="Target" value={targetText} onEdit={() => goTo(STEP.habit)} />
                    <Row label="Repeats" value={describeRecurrence(draft)} onEdit={() => goTo(STEP.schedule)} />
                    <Row
                        label="Starts"
                        value={next ? next.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : 'No day chosen'}
                        onEdit={() => goTo(STEP.schedule)}
                    />
                    <Row label="Routine cue" value={draft.cue?.trim() || 'None'} onEdit={() => goTo(STEP.schedule)} />
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

                <View style={{ height: 14, gap: 10 }} />
                <View style={{ gap: 10 }}>
                    <PrimaryButton label={`Remind me at ${time}`} onPress={() => enableReminder(time)} />
                    <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); goTo(STEP.tour); }} style={styles.secondaryBtn}>
                        <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                            {reminderNote ? 'Done' : 'Not now'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderTour = () => (
        <HabitGesturesTour
            habitName={draft.habitName?.trim() || 'Your habit'}
            targetLabel={[
                draft.trackingMethod === 'boolean'
                    ? 'Done or not done'
                    : `${draft.targetValue ?? 1} ${draft.targetUnit ?? 'time'}`,
                describeRecurrence(draft),
                draft.cue?.trim(),
            ].filter(Boolean).join(' · ')}
            icon={draft.icon}
            onDone={finish}
            doneLabel="Go to my habits"
        />
    );

    const screens: Record<number, () => React.ReactNode> = {
        [STEP.welcome]: renderWelcome,
        [STEP.name]: renderName,
        [STEP.direction]: renderDirection,
        [STEP.obstacle]: renderObstacle,
        [STEP.support]: renderSupport,
        [STEP.habit]: renderHabit,
        [STEP.schedule]: renderSchedule,
        [STEP.coach]: renderCoach,
        [STEP.confirm]: renderConfirm,
        [STEP.reminder]: renderReminder,
        [STEP.tour]: renderTour,
    };

    const backFor = (step: number): (() => void) | undefined => {
        // Nothing behind welcome, and the habit is already saved from the reminder
        // step onwards, so going back there would offer to create it twice.
        if (step === STEP.welcome || step === STEP.reminder || step === STEP.tour) return undefined;
        return () => goTo(step - 1);
    };

    const titles: Record<number, string> = {
        [STEP.name]: 'About you',
        [STEP.direction]: 'Direction',
        [STEP.obstacle]: 'What gets in the way',
        [STEP.support]: 'Support',
        [STEP.habit]: 'First habit',
        [STEP.schedule]: 'Schedule',
        [STEP.coach]: 'Coach',
        [STEP.confirm]: 'Confirm',
        [STEP.reminder]: 'Reminder',
        [STEP.tour]: 'Your habit cards',
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

import { FontFamily } from '@/theme/designSystem';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { textOn } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useFocusEffect, useRouter } from 'expo-router';
import { TimeRow } from '@/components/ui/TimeRow';

import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/context/AppSettingsContext';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { QuietLoading } from '@/components/Loading/QuietLoading';
import { APP_SLOGAN } from '@/constants/brand';
import { setOnboardingComplete } from '@/lib/localUser';
import { localDateKey } from '@/lib/habitSchedule';
import { FLOW_VERSION, clearDraft, loadDraft, saveDraft, type OnboardingDraft } from '@/lib/onboarding';
import {
    BLOCKERS, CHRONOTYPES, HOPES, SLEEP_AMOUNTS, SOURCES, TIMINGS,
    dayWindowFor, shouldOfferFriends, suggestEcho,
    type BlockerId, type HopeId,
} from '@/lib/onboardingProfile';
import { contrastRatio } from '@/lib/colorContrast';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { coachHello } from '@/lib/coachMessages';
import { ECHO_NAME, hoursAwake, saveDayWindow, saveName } from '@/lib/echo';
import { currentAccount, onAccountChange } from '@/lib/account';
import { getName } from '@/lib/echo';
import { SignInOptions } from '@/components/Auth/SignInOptions';
import { ClimbIntro } from '@/components/Onboarding/ClimbIntro';
import type { SyncReport } from '@/lib/cloudSync';
import { styles } from '@/styles/screens/auth/onboarding.styles';

/** Just long enough for the selected state to paint before the step changes. */
const SELECT_ADVANCE_MS = 180;

/**
 * Who you are, not what you have failed at.
 *
 * The old flow asked about the goal, the history of giving up on it and what
 * that would cost, before it knew the person's name. These questions are
 * gentler and more useful: they are answerable honestly on a bad day, and each
 * one changes something the app actually does.
 */
const STEPS = [
    'welcome', 'name', 'source', 'hope', 'sleep', 'timing', 'blockers',
    'meetEcho', 'echo', 'friends', 'account',
] as const;
/** Choosing Echo's voice ends setup; the rest is backup and friends. */
const LAST_SETUP_STEP = 8;

const STEP = {
    welcome: 0, name: 1, source: 2, hope: 3, sleep: 4, timing: 5, blockers: 6,
    meetEcho: 7, echo: 8, friends: 9, account: 10,
} as const;

/**
 * The bar across the top of every question.
 *
 * Declared here rather than inside the screen: a component made during render
 * is a new type on every render, which threw the header away and rebuilt it
 * each time an answer changed.
 */
const Header = ({ onBack, title, onSkip }: { onBack?: () => void; title?: string; onSkip?: () => void }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();
    return (
        <View style={styles.header}>
            <View style={styles.headerSide}>
                {onBack ? (
                    <IconButton icon="chevron-back" label="Back" onPress={() => { lightFeedback(); onBack(); }} diameter={40} size={26} color={colors.textPrimary} />
                ) : null}
            </View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title ?? ''}</Text>
            <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
                {/* Every question can be passed over; nothing here is required. */}
                {onSkip ? (
                    <TouchableOpacity onPress={() => { lightFeedback(); onSkip(); }} accessibilityLabel="Skip this question" style={styles.skipBtn}>
                        <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
};

/** How far through setup this is, as a row of dots. */
const Progress = ({ index, total }: { index: number; total: number }) => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    return (
        <View style={styles.progressRow} accessibilityLabel={`Step ${index} of ${total}`}>
            {Array.from({ length: total }, (_, dot) => (
                <View
                    key={dot}
                    style={[styles.progressDot, {
                        backgroundColor: dot < index ? accent : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)'),
                        width: dot === index - 1 ? 22 : 8,
                    }]}
                />
            ))}
        </View>
    );
};

export default function OnboardingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const { setAIPersonality } = useAppSettings();

    // null while hydrating: persisted data decides what the user sees, not a guess.
    const [draft, setDraftState] = useState<OnboardingDraft | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Auto-advance after a single choice; held so a second tap can cancel it.
    const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [signedIn, setSignedIn] = useState(false);

    // Whether this phone already has an account decides if the backup step shows.
    useEffect(() => {
        currentAccount().then(account => setSignedIn(!!account));
        return onAccountChange(account => setSignedIn(!!account));
    }, []);

    // Signed in on the backup step, by any route, moves on, but only while this
    // screen is in front. Otherwise an email sign-in on the account screen
    // would navigate away underneath it.
    const [focused, setFocused] = useState(true);
    useFocusEffect(useCallback(() => {
        setFocused(true);
        return () => setFocused(false);
    }, []));
    /** Done is done: someone who skipped setup lands in the app, not back at
     *  the first question on the next launch. */
    const finish = useCallback(async () => {
        await setOnboardingComplete();
        await clearDraft();
        router.replace('/(root)/(tabs)/home');
    }, [router]);

    /** Inviting someone answers "nobody notices either way", and nothing else. */
    const afterAccount = useCallback(() => {
        if (draft && shouldOfferFriends(draft)) setDraftState(current => {
            const next = { ...current!, step: STEP.friends };
            saveDraft(next);
            return next;
        });
        else void finish();
    }, [draft, finish]);

    const advancedRef = useRef(false);
    useEffect(() => {
        if (draft?.step !== STEP.account || !signedIn || !focused || advancedRef.current) return;
        advancedRef.current = true;
        afterAccount();
    }, [draft?.step, signedIn, focused, afterAccount]);

    useEffect(() => {
        let cancelled = false;
        loadDraft().then(stored => {
            if (cancelled) return;
            setDraftState(stored ?? { step: 0, flow: FLOW_VERSION, startDate: localDateKey(new Date()), recurrence: 'daily' });
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

    if (!draft) return <QuietLoading />;

    const stepIndex = Math.min(draft.step, STEPS.length - 1);

    /* ---------------------------------------------------------------- saving */

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

    /** After choosing a voice: back this phone up, unless it already is. */
    const afterEcho = () => {
        if (signedIn) afterAccount();
        else goTo(STEP.account);
    };

    /**
     * Signing in from the welcome screen: an account with a backup goes
     * straight to it, a new one carries on with setup, already linked.
     */
    const afterWelcomeSignIn = async (report: SyncReport) => {
        if (report.downloaded > 0) {
            await setOnboardingComplete();
            await clearDraft();
            router.replace('/(root)/(tabs)/home');
            return;
        }
        const known = await getName();
        update({ name: draft.name ?? known ?? undefined, step: STEP.name });
    };

    /* ------------------------------------------------------------ shared bits */

    // Black or white, whichever reads better on the user's accent colour.

    const PrimaryButton = ({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) => (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled || busy}
            onPress={() => { lightFeedback(); onPress(); }}
            style={{ opacity: disabled ? 0.5 : 1 }}
        >
            {/* Matte, like every button in the app. */}
            <MatteSurface radius={999} level="control" style={styles.primaryBtn}>
                {busy ? <ActivityIndicator color={colors.textPrimary} /> : (
                    <Text style={[styles.primaryBtnText, { color: colors.textPrimary }]}>{label}</Text>
                )}
            </MatteSurface>
        </TouchableOpacity>
    );

    const SectionTitle = ({ children, description }: { children: string; description?: string }) => (
        <View style={{ marginBottom: 14 }}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{children}</Text>
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
                backgroundColor: selected ? colors.surfaceTertiary : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                borderColor: 'transparent',
            }]}
        >
            {icon ? (
                <View style={[styles.choiceIcon, { backgroundColor: selected ? accent : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)') }]}>
                    <Ionicons filled={selected} name={icon as any} size={20} color={selected ? textOn(accent) : colors.textSecondary} />
                </View>
            ) : null}
            <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>{title}</Text>
                {subtitle ? <Text style={[styles.choiceSub, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
            </View>
            {trailing ?? <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.textPrimary : colors.textTertiary} />}
        </TouchableOpacity>
    );

    /* ----------------------------------------------------------------- steps */

    const renderWelcome = () => (
        // The mark, the line, and the two-second way in. Signing in here brings
        // a previous phone's data back, and a new account carries on with setup.
        <View style={styles.splash}>
            <View style={styles.splashInner}>
                {/* The story's first frame: the bottom of the abyss, and Echo. */}
                <ClimbIntro />
            </View>

            <View style={styles.welcomeActions}>
                <PrimaryButton label="Start climbing" onPress={() => goTo(STEP.name)} />

                <View style={styles.welcomeOr}>
                    <View style={[styles.welcomeRule, { backgroundColor: colors.border }]} />
                    <Text style={[styles.welcomeOrText, { color: colors.textTertiary }]}>or</Text>
                    <View style={[styles.welcomeRule, { backgroundColor: colors.border }]} />
                </View>

                <SignInOptions onSignedIn={afterWelcomeSignIn} />

                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => { lightFeedback(); router.push('/(root)/account?restore=1'); }}
                    style={styles.secondaryBtn}
                >
                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Sign in with email</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    /* --------------------------------------------------- who you are, not what
       you have failed at. Every one of these can be skipped. */

    const renderSource = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>How did you find us?</SectionTitle>
            <View style={{ gap: 8 }}>
                {SOURCES.map(option => (
                    <Choice
                        key={option.id}
                        selected={draft.source === option.id}
                        title={option.label}
                        icon={option.icon}
                        onPress={() => chooseAndAdvance({ source: option.id }, STEP.hope)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    const renderHope = () => {
        const chosen = draft.hope ?? [];
        const toggle = (id: HopeId) => {
            lightFeedback();
            update({ hope: chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id] });
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle description="Pick as many as are true.">What do you hope to get from this?</SectionTitle>
                <View style={{ gap: 8 }}>
                    {HOPES.map(option => (
                        <Choice
                            key={option.id}
                            selected={chosen.includes(option.id)}
                            title={option.label}
                            icon={option.icon}
                            onPress={() => toggle(option.id)}
                        />
                    ))}
                </View>
                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.sleep)} disabled={chosen.length === 0} />
            </ScrollView>
        );
    };

    const renderSleep = () => {
        const window = { wake: draft.wake, sleep: draft.sleep, ...(draft.wake && draft.sleep ? {} : dayWindowFor(draft.chronotype)) };
        const wake = draft.wake ?? window.wake!;
        const sleep = draft.sleep ?? window.sleep!;

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle>When are you at your best?</SectionTitle>
                <View style={{ gap: 8 }}>
                    {CHRONOTYPES.map(option => (
                        <Choice
                            key={option.id}
                            selected={draft.chronotype === option.id}
                            title={option.label}
                            subtitle={option.detail}
                            icon={option.icon}
                            // Choosing a kind of person sets the hours it implies,
                            // which the user can then correct below.
                            onPress={() => update({ chronotype: option.id, ...dayWindowFor(option.id) })}
                        />
                    ))}
                </View>

                <View style={{ height: 22 }} />
                <SectionTitle>And your hours?</SectionTitle>
                <View style={{ gap: 10 }}>
                    {([['I wake up', 'sunny-outline', wake, 'wake'], ['I go to sleep', 'moon-outline', sleep, 'sleep']] as const).map(([label, icon, value, key]) => (
                        <View key={key} style={[styles.dayRowWrap, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)' }]}>
                            {/* The app's own wheel, opened under the row. */}
                            <TimeRow icon={icon as any} label={label} value={value} accent={accent} onChange={time => update({ [key]: time })} />
                        </View>
                    ))}
                </View>
                <Text style={[styles.hint, { color: colors.textTertiary, marginTop: 10 }]}>
                    {hoursAwake({ wake, sleep })} hours awake. Echo keeps its voice inside them.
                </Text>

                <View style={{ height: 22 }} />
                <SectionTitle>How much sleep do you actually get?</SectionTitle>
                <View style={{ gap: 8 }}>
                    {SLEEP_AMOUNTS.map(option => (
                        <Choice
                            key={option.id}
                            selected={draft.sleepAmount === option.id}
                            title={option.label}
                            onPress={() => update({ sleepAmount: option.id })}
                        />
                    ))}
                </View>

                <View style={{ height: 18 }} />
                <PrimaryButton
                    label="Continue"
                    onPress={() => {
                        saveDayWindow({ wake, sleep }).catch(() => undefined);
                        update({ wake, sleep });
                        goTo(STEP.timing);
                    }}
                />
            </ScrollView>
        );
    };

    const renderTiming = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle description="However you answer, Echo adapts to it.">When do things actually get done?</SectionTitle>
            <View style={{ gap: 8 }}>
                {TIMINGS.map(option => (
                    <Choice
                        key={option.id}
                        selected={draft.timing === option.id}
                        title={option.label}
                        subtitle={option.detail}
                        icon={option.icon}
                        onPress={() => chooseAndAdvance({ timing: option.id }, STEP.blockers)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    const renderBlockers = () => {
        const chosen = draft.blockers ?? [];
        const toggle = (id: BlockerId) => {
            lightFeedback();
            update({ blockers: chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id] });
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle description="Be honest. Nothing here is judged, and it is only used to help.">
                    What stops you?
                </SectionTitle>
                <View style={{ gap: 8 }}>
                    {BLOCKERS.map(option => (
                        <Choice
                            key={option.id}
                            selected={chosen.includes(option.id)}
                            title={option.label}
                            icon={option.icon}
                            onPress={() => toggle(option.id)}
                        />
                    ))}
                </View>
                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.meetEcho)} disabled={chosen.length === 0} />
            </ScrollView>
        );
    };

    /**
     * What the name means, and who Echo is.
     *
     * The one page in the flow that asks nothing. It is here because a voice
     * that turns up in your notifications for the next year should be
     * introduced properly, and because the name of the app is a promise worth
     * explaining: the abyss is the long dark stretch between who you are and
     * who you said you would be, and an echo is the only thing that comes back
     * out of one.
     */
    const renderMeetEcho = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.meetMark}>
                <View style={[styles.meetGlow, { backgroundColor: accent + '1a', shadowColor: accent }]}> {/* ui-allow: decorative */}
                    <Ionicons name="sparkles" size={26} color={accent} />
                </View>
            </View>

            <Text style={[styles.meetTitle, { color: colors.textPrimary }]}>
                Every habit has an abyss.
            </Text>

            <Text style={[styles.meetBody, { color: colors.textSecondary }]}>
                It is the stretch between the person you are and the person you said you would be. The first week is
                loud. After that it goes quiet, and the quiet is where most of it is lost.
            </Text>
            <Text style={[styles.meetBody, { color: colors.textSecondary }]}>
                {ECHO_NAME} is what comes back.
            </Text>
            <Text style={[styles.meetBody, { color: colors.textSecondary }]}>
                A voice in the morning when starting would be easy to skip. A word in the evening when one small thing
                is still undone. Something on the days nobody is watching and nobody claps — which, in the end, is most
                of them.
            </Text>
            <Text style={[styles.meetBody, styles.meetLast, { color: colors.textPrimary }]}>
                It knows your name{draft.name?.trim() ? `, ${draft.name.trim()}` : ''}. Now choose how it should sound.
            </Text>

            <View style={{ height: 22 }} />
            <PrimaryButton label={`Meet ${ECHO_NAME}`} onPress={() => goTo(STEP.echo)} />
        </ScrollView>
    );

    const renderName = () => {
        const name = draft.name ?? '';
        const next = () => {
            if (!name.trim()) return;
            saveName(name).catch(() => undefined);
            goTo(STEP.source);
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <SectionTitle>What’s your name?</SectionTitle>
                <MatteInput
                    value={name}
                    onChangeText={text => update({ name: text })}
                    autoFocus
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                    maxLength={40}
                    onSubmitEditing={next}
                    placeholder="Your first name"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Your name"
                    style={[styles.input, {
                        color: colors.textPrimary, borderColor: colors.border,
                        backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                    }]}
                />
                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={next} disabled={!name.trim()} />
            </ScrollView>
        );
    };

    const renderEcho = () => {
        // What they told us, turned into a starting voice and a sentence
        // saying why. The suggestion is only a default; every voice is here.
        const suggestion = suggestEcho(draft);
        const chosen = draft.echo ?? suggestion.id;

        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.echoTitle, { color: colors.textPrimary }]}>How should {ECHO_NAME} sound?</Text>
                <Text style={[styles.echoIntro, { color: colors.textSecondary }]}>{suggestion.reason}</Text>

                <View style={{ gap: 10 }}>
                    {PERSONALITY_MODES.map(mode => {
                        const selected = chosen === mode.id;
                        const suggested = mode.id === suggestion.id;
                        return (
                            <TouchableOpacity
                                key={mode.id}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${mode.name}${suggested ? ', suggested for you' : ''}. ${coachHello(mode.id, draft.name)}`}
                                activeOpacity={0.85}
                                onPress={() => { lightFeedback(); update({ echo: mode.id }); }}
                                style={[styles.echoCard, {
                                    backgroundColor: selected ? colors.surfaceTertiary : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                                    borderColor: 'transparent',
                                }]}
                            >
                                <View style={styles.echoHead}>
                                    <Ionicons name={mode.icon as any} size={18} color={selected ? colors.textPrimary : colors.textSecondary} />
                                    <Text style={[styles.choiceTitle, { color: colors.textPrimary, flex: 1 }]}>{mode.name}</Text>
                                    {suggested ? (
                                        <View style={[styles.suggestedTag, { backgroundColor: colors.surfaceTertiary, borderColor: 'transparent' }]}>
                                            <Text style={[styles.suggestedText, { color: colors.textSecondary }]}>For you</Text>
                                        </View>
                                    ) : null}
                                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? colors.textPrimary : colors.textTertiary} />
                                </View>
                                {/* What Echo would actually say, so the choice is felt, not described. */}
                                <Text style={[styles.echoQuote, { color: colors.textSecondary }]}>“{coachHello(mode.id, draft.name)}”</Text>
                                {mode.warning ? (
                                    <Text style={[styles.echoWarning, { color: colors.textTertiary }]}>Harsh language.</Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={[styles.hint, { color: colors.textTertiary, textAlign: 'center', marginTop: 14 }]}>
                    You can change this any time in Settings.
                </Text>

                <View style={{ height: 16 }} />
                <PrimaryButton
                    label="This one"
                    onPress={() => {
                        setAIPersonality(chosen);
                        update({ echo: chosen });
                        afterEcho();
                    }}
                />
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


    const renderAccount = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle>Keep your plan safe</SectionTitle>
            <VoidCard style={styles.introCard}>
                <Ionicons name="cloud-upload-outline" size={22} color={accent} />
                <Text style={[styles.introText, { color: colors.textPrimary }]}>
                    Back it up, and a new phone brings everything back. It is also how friends find you.
                </Text>
            </VoidCard>

            <View style={{ height: 18 }} />
            <SignInOptions
                onSignedIn={() => afterAccount()}
                onEmail={() => router.push('/(root)/account')}
            />

            <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); afterAccount(); }} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Not now</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const screens: Record<number, () => React.ReactNode> = {
        [STEP.welcome]: renderWelcome,
        [STEP.name]: renderName,
        [STEP.source]: renderSource,
        [STEP.hope]: renderHope,
        [STEP.sleep]: renderSleep,
        [STEP.timing]: renderTiming,
        [STEP.blockers]: renderBlockers,
        [STEP.meetEcho]: renderMeetEcho,
        [STEP.echo]: renderEcho,
        [STEP.friends]: renderFriends,
        [STEP.account]: renderAccount,
    };

    /**
     * Any question can be passed over. Skipping never costs anything: the app
     * works without a single answer, and every one of them can be given later
     * in Settings.
     */
    const skipFor = (step: number): (() => void) | undefined => {
        if (step === STEP.welcome || step > STEP.echo) return undefined;
        if (step === STEP.echo) return () => afterEcho();
        return () => goTo(step + 1);
    };

    const backFor = (step: number): (() => void) | undefined => {
        // Nothing behind welcome; backup and friends come after setup is done.
        if (step === STEP.welcome || step === STEP.friends || step === STEP.account) return undefined;
        return () => goTo(step - 1);
    };

    const titles: Record<number, string> = {
        [STEP.name]: 'You',
        [STEP.source]: 'Hello',
        [STEP.hope]: 'What you want',
        [STEP.sleep]: 'Your day',
        [STEP.timing]: 'How you work',
        [STEP.blockers]: 'What gets in the way',
        [STEP.meetEcho]: '',
        [STEP.echo]: '',
        [STEP.friends]: 'Friends',
        [STEP.account]: 'Backup',
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <Header onBack={backFor(draft.step)} title={titles[draft.step]} onSkip={skipFor(draft.step)} />
                    {draft.step > 0 && draft.step <= LAST_SETUP_STEP ? <Progress index={stepIndex} total={LAST_SETUP_STEP} /> : null}
                    <View key={draft.step} style={{ flex: 1 }}>
                        {(screens[draft.step] ?? renderWelcome)()}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </VoidShell>
    );
}

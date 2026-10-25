import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { space, textOn } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { markTutorialDue } from '@/lib/tutorial';
import { localDateKey } from '@/lib/habitSchedule';
import { FLOW_VERSION, clearDraft, loadDraft, saveDraft, type OnboardingDraft } from '@/lib/onboarding';
import {
    BLOCKERS, CHRONOTYPES, HOPES, JUGGLES, SLEEP_AMOUNTS, SOURCES, TIMINGS,
    dayWindowFor, shouldOfferFriends, suggestEcho,
    type BlockerId, type HopeId, type JuggleId,
} from '@/lib/onboardingProfile';
import { getName, hoursAwake, saveDayWindow, saveName } from '@/lib/echo';
import { currentAccount, onAccountChange } from '@/lib/account';
import { SignInOptions } from '@/components/Auth/SignInOptions';
import { ClimbIntro } from '@/components/Onboarding/ClimbIntro';
import { ClimbRail, RAIL_WIDTH } from '@/components/Onboarding/ClimbRail';
import { EchoArrival } from '@/components/Onboarding/EchoArrival';
import { EchoVoicePicker } from '@/components/Onboarding/EchoVoicePicker';
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
 *
 * It is one climb, not a stack of pages: the light is you, and each page is
 * a dot up the rail on the left (components/Onboarding/ClimbRail).
 * Choosing Echo's voice ends setup; the rest is backup and friends.
 */
const LAST_SETUP_STEP = 8;

/** One dot on the rail per page after welcome: setup, then one for backup and friends. */
const RAIL_PAGES = LAST_SETUP_STEP + 1;
/** How long the name tag shows before the next question. */
const NAME_TAG_MS = 900;

const STEP = {
    welcome: 0, name: 1, source: 2, juggle: 3, hope: 4, sleep: 5, timing: 6, blockers: 7,
    meetEcho: 8, echo: 9, friends: 10, account: 11,
} as const;

/**
 * The bar across the top of every question.
 *
 * Declared here rather than inside the screen: a component made during render
 * is a new type on every render, which threw the header away and rebuilt it
 * each time an answer changed.
 */
const Header = ({ onBack, onSkip }: { onBack?: () => void; onSkip?: () => void }) => {
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
            <View style={styles.flex} />
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

export default function OnboardingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const { setAIPersonality: saveVoice } = useAppSettings();
    // Developer → "Test onboarding": the whole flow from the start, saving
    // nothing (no name, hours, voice, draft or "done"), back to Settings at the end.
    const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
    const setAIPersonality = useCallback((id: Parameters<typeof saveVoice>[0]) => { if (!preview) return saveVoice(id); }, [preview, saveVoice]);
    const persistDraft = useCallback((next: OnboardingDraft) => { if (!preview) saveDraft(next); }, [preview]);

    // null while hydrating: persisted data decides what the user sees, not a
    // guess. Test mode starts fresh straight away and never reads the saved one.
    const [draft, setDraftState] = useState<OnboardingDraft | null>(() => preview
        ? { step: 0, flow: FLOW_VERSION, startDate: localDateKey(new Date()), recurrence: 'daily' } : null);
    const [startingSignIn, setStartingSignIn] = useState(false);
    const [signInError, setSignInError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Auto-advance after a single choice; held so a second tap can cancel it.
    const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [signedIn, setSignedIn] = useState(false);
    // The name on its tag above the light, the moment it is given.
    const [nameTag, setNameTag] = useState<string | null>(null);

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
        if (preview) { router.replace('/(root)/(tabs)/settings'); return; }
        await setOnboardingComplete();
        await clearDraft();
        // How Habyss works, once, as the app opens for the first time.
        await markTutorialDue();
        router.replace('/(root)/(tabs)/home');
    }, [router, preview]);

    /** Inviting someone answers "nobody notices either way", and nothing else. */
    const afterAccount = useCallback(() => {
        if (draft && shouldOfferFriends(draft)) setDraftState(current => {
            const next = { ...current!, step: STEP.friends };
            persistDraft(next);
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
        const fresh: OnboardingDraft = { step: 0, flow: FLOW_VERSION, startDate: localDateKey(new Date()), recurrence: 'daily' };
        if (preview) return;
        loadDraft().then(stored => {
            if (cancelled) return;
            setDraftState(stored ?? fresh);
        });
        return () => { cancelled = true; };
    }, [preview]);

    const update = useCallback((patch: Partial<OnboardingDraft>) => {
        setDraftState(current => {
            if (!current) return current;
            const next = { ...current, ...patch };
            // Persist every change so closing the app mid-flow loses nothing.
            persistDraft(next);
            return next;
        });
    }, [persistDraft]);

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
     * "Start climbing": sign in at once with the phone's own account (Apple on
     * an Apple device, Google elsewhere), then carry on. Closing the sign-in
     * sheet, or a build without either, just carries on into setup: the
     * account step later offers it again. Test mode never signs in.
     */
    const startClimbing = async () => {
        lightFeedback();
        if (preview || signedIn) { goTo(STEP.name); return; }
        setStartingSignIn(true);
        setSignInError(null);
        try {
            const social = require('@/lib/socialSignIn') as typeof import('@/lib/socialSignIn');
            const useApple = Platform.OS === 'ios' && await social.isAppleSignInAvailable();
            const useGoogle = !useApple && social.isGoogleSignInAvailable();
            if (!useApple && !useGoogle) { goTo(STEP.name); return; }
            const result = useApple ? await social.signInWithApple() : await social.signInWithGoogle();
            if (result.ok) { await afterWelcomeSignIn(result.value); return; }
            if (!('cancelled' in result)) setSignInError('Couldn’t sign in just now. You can add an account at the end.');
            goTo(STEP.name);
        } catch {
            goTo(STEP.name);
        } finally {
            setStartingSignIn(false);
        }
    };

    /**
     * Signing in from the welcome screen: an account with a backup goes
     * straight to it, a new one carries on with setup, already linked.
     */
    const afterWelcomeSignIn = async (report: SyncReport) => {
        if (report.downloaded > 0) {
            if (!preview) { await setOnboardingComplete(); await clearDraft(); }
            router.replace(preview ? '/(root)/(tabs)/settings' : '/(root)/(tabs)/home');
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
                {/* One button. It signs you in straight away (Apple on an Apple
                    device, Google otherwise), then carries on into setup. */}
                <PrimaryButton label="Start climbing" busy={startingSignIn} onPress={() => void startClimbing()} />
                {signInError ? <Text style={[styles.welcomeOrText, { color: colors.textTertiary, textAlign: 'center' }]}>{signInError}</Text> : null}

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
                        onPress={() => chooseAndAdvance({ source: option.id }, STEP.juggle)}
                    />
                ))}
            </View>
        </ScrollView>
    );

    // Everything they carry at once: the reason Habyss exists.
    const renderJuggle = () => {
        const chosen = draft.juggling ?? [];
        const toggle = (id: JuggleId) => {
            lightFeedback();
            update({ juggling: chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id] });
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle description="The people who win run all of it at once. Most people drop one and never notice when.">What are you juggling right now?</SectionTitle>
                <View style={{ gap: 8 }}>
                    {JUGGLES.map(option => (
                        <Choice
                            key={option.id}
                            selected={chosen.includes(option.id)}
                            title={option.label}
                            icon={option.icon}
                            onPress={() => toggle(option.id)}
                        />
                    ))}
                </View>
                {chosen.length >= 2 ? (
                    <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 12 }]}>
                        {chosen.length} things, one day. Habyss plans every hour of it so none of them falls behind.
                    </Text>
                ) : null}
                <View style={{ height: 18 }} />
                <PrimaryButton label="Continue" onPress={() => goTo(STEP.hope)} disabled={chosen.length === 0} />
            </ScrollView>
        );
    };

    const renderHope = () => {
        const chosen = draft.hope ?? [];
        const toggle = (id: HopeId) => {
            lightFeedback();
            update({ hope: chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id] });
        };
        return (
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionTitle description="Pick everything you want. Every one of them is what Habyss is built for.">What would change if you never wasted a day again?</SectionTitle>
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
                <SectionTitle description="Your hardest work goes in these hours. Waste them and nothing else makes up for it.">When are you at your sharpest?</SectionTitle>
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
                    {hoursAwake({ wake, sleep })} hours awake, every day. Most people lose three or more of them without noticing. You will not.
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
                        if (!preview) saveDayWindow({ wake, sleep }).catch(() => undefined);
                        update({ wake, sleep });
                        goTo(STEP.timing);
                    }}
                />
            </ScrollView>
        );
    };

    const renderTiming = () => (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SectionTitle description="The top 1% decide their day before it starts. Everyone else reacts to it.">Be honest: when does the work actually get done?</SectionTitle>
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
                <SectionTitle description="Every one of these has a fix inside Habyss. Pick yours and Echo goes after it.">
                    What has been stealing your days?
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
     * Who Echo is, shown rather than told: its light comes down to meet
     * yours, its rings go out, and a few words. Then you choose its voice.
     */
    const renderMeetEcho = () => (
        <EchoArrival name={draft.name?.trim() || undefined}>
            <PrimaryButton label="Choose its voice" onPress={() => goTo(STEP.echo)} />
        </EchoArrival>
    );

    const renderName = () => {
        const name = draft.name ?? '';
        // The name goes up on its tag above the light first; then the climb.
        const next = () => {
            if (!name.trim() || nameTag) return;
            if (!preview) saveName(name).catch(() => undefined);
            lightFeedback();
            setNameTag(name.trim());
            cancelAdvance();
            advanceRef.current = setTimeout(() => { advanceRef.current = null; goTo(STEP.source); }, NAME_TAG_MS);
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
                <PrimaryButton label="Continue" onPress={next} disabled={!name.trim() || !!nameTag} />
            </ScrollView>
        );
    };

    const renderEcho = () => {
        // What they told us, turned into a starting voice. The suggestion is
        // only a default; every voice is there, and each one speaks for itself.
        const suggestion = suggestEcho(draft);
        const chosen = draft.echo ?? suggestion.id;
        return (
            <EchoVoicePicker chosen={chosen} suggested={suggestion.id} name={draft.name?.trim() || undefined}
                onChoose={id => { lightFeedback(); update({ echo: id }); }}>
                <PrimaryButton
                    label="This one"
                    onPress={() => {
                        setAIPersonality(chosen);
                        update({ echo: chosen });
                        afterEcho();
                    }}
                />
            </EchoVoicePicker>
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
        [STEP.juggle]: renderJuggle,
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
        // Back to the name: its tag comes down until it is given again.
        return () => { if (step - 1 === STEP.name) setNameTag(null); goTo(step - 1); };
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {/* Always there (empty on welcome), so nothing below shifts when the climb starts. */}
                    <Header onBack={backFor(draft.step)} onSkip={skipFor(draft.step)} />
                    <View style={styles.flex}>
                        {/* Each question arrives from above as the light climbs to it, beside the rail. */}
                        <Animated.View key={draft.step} entering={FadeInUp.delay(draft.step === STEP.name ? 700 : 220).duration(450)}
                            style={[styles.flex, draft.step > STEP.welcome && { paddingLeft: RAIL_WIDTH - space.md }]}>
                            {(screens[draft.step] ?? renderWelcome)()}
                        </Animated.View>
                        {/* The light is you. It never leaves the screen: every page is a dot up the rail. */}
                        <ClimbRail step={Math.min(draft.step, RAIL_PAGES)} pages={RAIL_PAGES}
                            name={draft.step > STEP.name ? draft.name?.trim() || null : nameTag} />
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </VoidShell>
    );
}

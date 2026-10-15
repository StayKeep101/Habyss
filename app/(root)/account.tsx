import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/ui/VoidCard';
import {
    currentAccount, isEmail, onAccountChange, requestCode, signInWithPassword,
    signOut, signUpWithPassword, verifyCode,
    type Account,
} from '@/lib/account';
import { lastSyncedAt, syncNow } from '@/lib/cloudSync';
import { isCloudConfigured } from '@/lib/supabase';
import { SignInOptions } from '@/components/Auth/SignInOptions';
import type { SyncReport } from '@/lib/cloudSync';
import { setOnboardingComplete } from '@/lib/localUser';
import { restartAfterDeletion } from '@/lib/accountDeletion';
import { styles } from '@/styles/screens/account.styles';

const RESEND_SECONDS = 60;

const since = (iso: string | null): string => {
    if (!iso) return 'Not backed up yet';
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'Backed up just now';
    if (minutes < 60) return `Backed up ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Backed up ${hours} hr ago`;
    return `Backed up ${new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

/**
 * Account: sign in to back up, restore onto a new phone, and add friends.
 *
 * Opened with ?restore=1 from the first onboarding screen, for someone who
 * already has an account: after signing in they go straight to their restored
 * habits instead of building a new plan.
 */
export default function AccountScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const { restore } = useLocalSearchParams<{ restore?: string }>();
    const restoring = restore === '1';
    const closeAccount = () => {
        if (router.canGoBack()) router.back();
        else router.replace(restoring ? '/(auth)/onboarding' : '/(root)/(tabs)/home');
    };

    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    // A password needs no email to arrive, so it is the way in that cannot be
    // broken by a mail server.
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const [busy, setBusy] = useState<null | 'send' | 'verify' | 'sync' | 'signout' | 'delete'>(null);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        setAccount(await currentAccount());
        setLastSync(await lastSyncedAt());
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
        const unsubscribe = onAccountChange(() => { refresh(); });
        return () => { unsubscribe(); if (timer.current) clearInterval(timer.current); };
    }, [refresh]);

    const startResendTimer = () => {
        setResendIn(RESEND_SECONDS);
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
            setResendIn(value => {
                if (value <= 1 && timer.current) { clearInterval(timer.current); timer.current = null; }
                return Math.max(0, value - 1);
            });
        }, 1000);
    };

    const sendCode = async () => {
        if (busy) return;
        lightFeedback();
        setBusy('send');
        setMessage(null);
        const result = await requestCode(email);
        setBusy(null);
        if (!result.ok) { setMessage({ tone: 'error', text: result.error }); return; }
        setCodeSent(true);
        startResendTimer();
        setMessage({ tone: 'ok', text: `We sent a code to ${email.trim()}.` });
    };

    const withPassword = async (creating: boolean) => {
        if (busy) return;
        lightFeedback();
        setBusy('verify');
        setMessage(null);
        const result = creating
            ? await signUpWithPassword(email, password)
            : await signInWithPassword(email, password);
        setBusy(null);
        if (!result.ok) { setMessage({ tone: 'error', text: result.error }); return; }
        if (!result.value) {
            setMessage({ tone: 'ok', text: `Account made. Confirm ${email.trim()} from the email, then sign in.` });
            return;
        }
        await afterSignIn(result.value);
    };

    const confirmCode = async () => {
        if (busy) return;
        lightFeedback();
        setBusy('verify');
        setMessage(null);
        const result = await verifyCode(email, code);
        setBusy(null);
        if (!result.ok) { setMessage({ tone: 'error', text: result.error }); return; }
        await afterSignIn(result.value);
    };

    /** The same ending for every way of signing in. */
    const afterSignIn = async (report: SyncReport) => {
        successFeedback();
        await refresh();

        if (restoring) {
            // An existing account with data goes straight to it; a brand new one
            // goes back to build a plan, since there is nothing to restore.
            if (report.downloaded > 0) {
                await setOnboardingComplete();
                router.replace('/(root)/(tabs)/home');
            } else {
                Alert.alert('Nothing to restore yet', 'This account has no backup. Build your plan and it will be backed up from now on.', [
                    { text: 'Build my plan', onPress: () => router.replace('/(auth)/onboarding') },
                ]);
            }
            return;
        }

        setMessage(report.ok
            ? { tone: 'ok', text: report.downloaded > 0 ? `Signed in. Restored ${report.downloaded} item${report.downloaded === 1 ? '' : 's'}.` : 'Signed in and backed up.' }
            : { tone: 'error', text: report.error ?? 'Signed in, but the first backup did not finish. It will try again.' });
    };

    const backUpNow = async () => {
        if (busy) return;
        lightFeedback();
        setBusy('sync');
        setMessage(null);
        const report = await syncNow();
        setBusy(null);
        setLastSync(await lastSyncedAt());
        if (report.ok) {
            successFeedback();
            // Saying "everything" while a table is still missing on the server
            // would be a lie the user only finds out about on a new phone.
            setMessage(report.waiting?.length
                ? { tone: 'ok', text: `Backed up, except ${report.waiting.join(' and ')} — the server needs its database update first.` }
                : { tone: 'ok', text: 'Everything is backed up.' });
        } else {
            setMessage({ tone: 'error', text: report.error ?? `${report.failed} change${report.failed === 1 ? '' : 's'} could not be backed up.` });
        }
    };

    const doSignOut = async (discardUnsaved = false) => {
        setBusy('signout');
        const result = await signOut({ discardUnsaved });
        setBusy(null);

        if (result.ok) {
            if (!(await restartAfterDeletion())) router.replace('/(auth)/onboarding');
            return;
        }
        if (result.unsaved) {
            // Nothing has been cleared yet; the user decides whether to lose it.
            Alert.alert(
                'Not everything is backed up',
                `${result.error}\n\nSigning out now removes this data from this phone and it cannot be recovered.`,
                [
                    { text: 'Stay signed in', style: 'cancel' },
                    { text: 'Sign out anyway', style: 'destructive', onPress: () => doSignOut(true) },
                ],
            );
            return;
        }
        setMessage({ tone: 'error', text: result.error });
    };

    const confirmSignOut = () => {
        lightFeedback();
        Alert.alert(
            'Sign out?',
            'Your habits are backed up first, then removed from this phone. Sign back in on any phone to get them back.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => doSignOut(false) },
            ],
        );
    };


    const renderSignedOut = () => (
        <>
            <VoidCard style={styles.card}>
                <Ionicons name="cloud-upload-outline" size={24} color={accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {restoring ? 'Welcome back' : 'Sign in to back up'}
                </Text>
            </VoidCard>

            {/* The same two buttons as onboarding and the Friends tab. */}
            <SignInOptions onSignedIn={afterSignIn} />

            <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or with email</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <AppTextField label="Email"
                value={email}
                onChangeText={text => { setEmail(text); if (codeSent) { setCodeSent(false); setCode(''); } }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => { if (isEmail(email) && !codeSent) sendCode(); }}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Email address"
            />

            {usePassword ? (
                <>
                    <AppTextField label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="current-password"
                        textContentType="password"
                        returnKeyType="go"
                        onSubmitEditing={() => { if (isEmail(email) && password) void withPassword(false); }}
                        placeholder="Your password"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Password"
                    />
                    <AppButton
                        label="Sign in"
                        onPress={() => void withPassword(false)}
                        disabled={!isEmail(email) || !password}
                        loading={busy === 'verify'}
                    />
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={!!busy}
                        onPress={() => void withPassword(true)}
                        style={styles.secondary}
                    >
                        <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Create an account with this password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => { lightFeedback(); setUsePassword(false); setMessage(null); }}
                        style={styles.secondary}
                    >
                        <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Email me a code instead</Text>
                    </TouchableOpacity>
                </>
            ) : codeSent ? (
                <>
                    <AppTextField label="Code"
                        value={code}
                        onChangeText={setCode}
                        autoFocus
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="one-time-code"
                        maxLength={12}
                        placeholder="123456"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Code from the email"
                        style={styles.codeInput}
                    />
                    <AppButton label="Sign in" onPress={confirmCode} disabled={code.replace(/\s/g, '').length < 6} loading={busy === 'verify'} />
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={resendIn > 0 || !!busy}
                        onPress={sendCode}
                        style={styles.secondary}
                    >
                        <Text style={[styles.secondaryText, { color: resendIn > 0 ? colors.textTertiary : colors.textSecondary }]}>
                            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                        </Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <AppButton label="Send code" onPress={sendCode} disabled={!isEmail(email)} loading={busy === 'send'} />
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => { lightFeedback(); setUsePassword(true); setMessage(null); }}
                        style={styles.secondary}
                    >
                        <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Use a password instead</Text>
                    </TouchableOpacity>
                </>
            )}
        </>
    );

    const renderSignedIn = () => (
        <>
            <SettingsGroup>
                <SettingsRow icon="person-circle" color="#5B8CFF" label={account?.email ?? 'Signed in'} />
                <SettingsRow icon="cloud-upload" color="#30D158" label={busy === 'sync' ? 'Backing up…' : 'Back up now'}
                    value={since(lastSync)} disabled={!!busy} onPress={backUpNow} />
            </SettingsGroup>
            {/* Deleting lives in Privacy, once, for signed-in and signed-out alike. */}
            <SettingsGroup>
                <SettingsRow icon="log-out" color="#8A8A94" label="Sign out" disabled={!!busy} onPress={confirmSignOut} />
            </SettingsGroup>
        </>
    );

    return (
        <SheetScreen title="Account" onBack={closeAccount}>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        {!isCloudConfigured() ? (
                            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>Accounts are not available in this build.</Text>
                        ) : loading ? (
                            <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
                        ) : account ? renderSignedIn() : renderSignedOut()}

                        {message ? (
                            <View style={[styles.note, {
                                backgroundColor: message.tone === 'error' ? colors.error + '18' : colors.surfaceTertiary,
                                borderColor: 'transparent',
                            }]}>
                                <Ionicons
                                    name={message.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                                    size={16}
                                    color={message.tone === 'error' ? colors.error : colors.success}
                                />
                                <Text style={[styles.noteText, { color: message.tone === 'error' ? colors.error : colors.textPrimary }]}>{message.text}</Text>
                            </View>
                        ) : null}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SheetScreen>
    );
}

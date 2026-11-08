import { SheetScreen } from '@/components/ui/SheetScreen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { currentAccount, knownAccount, onAccountChange, signOut, type Account } from '@/lib/account';
import { lastSyncedAt, syncNow } from '@/lib/cloudSync';
import { isCloudConfigured } from '@/lib/supabase';
import { SignInOptions } from '@/components/Auth/SignInOptions';
import { AccountHero } from '@/components/Auth/AccountHero';
import type { SyncReport } from '@/lib/cloudSync';
import { setOnboardingComplete } from '@/lib/localUser';
import { restartAfterDeletion } from '@/lib/accountDeletion';
import { styles } from '@/styles/screens/account.styles';

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
 * Account: sign in with Apple or Google to back up and restore, back up now,
 * and sign out. (Email sign-in was removed: Apple or Google only.)
 *
 * Opened with ?restore=1 from the first onboarding screen, for someone who
 * already has an account: after signing in they go straight to their restored
 * habits instead of building a new plan.
 */
export default function AccountScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const { restore } = useLocalSearchParams<{ restore?: string }>();
    const restoring = restore === '1';
    const closeAccount = () => {
        if (router.canGoBack()) router.back();
        else router.replace(restoring ? '/(auth)/onboarding' : '/(root)/(tabs)/home');
    };

    // Opens already knowing who is signed in (kept once read), then refreshes behind it.
    const [account, setAccount] = useState<Account | null>(() => knownAccount() ?? null);
    const [loading, setLoading] = useState(() => knownAccount() === undefined);
    const [busy, setBusy] = useState<null | 'send' | 'verify' | 'sync' | 'signout' | 'delete'>(null);
    const [leaving, setLeaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setAccount(await currentAccount());
        setLastSync(await lastSyncedAt());
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
        const unsubscribe = onAccountChange(() => { refresh(); });
        return () => { unsubscribe(); };
    }, [refresh]);

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
        // From here until the restart, only "Signing out…" shows: the moment
        // the account is gone the page would otherwise redraw itself signed
        // out (the Apple and Google buttons) for a split second first.
        setLeaving(true);
        const result = await signOut({ discardUnsaved });
        setBusy(null);

        if (result.ok) {
            if (!(await restartAfterDeletion())) router.replace('/(auth)/onboarding');
            return;
        }
        setLeaving(false);
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
            <AccountHero color={accent}
                title={restoring ? 'Welcome back' : 'Keep your habits safe'}
                line={restoring
                    ? 'Sign in with the account you used before and everything comes back.'
                    : 'Back up everything, get it back on any phone, and let friends find you.'} />

            {/* Apple or Google, the same as onboarding and the Friends tab. */}
            <SignInOptions onSignedIn={afterSignIn} />

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
                        ) : leaving ? (
                            <View style={styles.leaving}>
                                <ActivityIndicator color={accent} />
                                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>Signing out…</Text>
                            </View>
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

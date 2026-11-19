import { SheetScreen } from '@/components/ui/SheetScreen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { currentAccount, knownAccount, onAccountChange, type Account } from '@/lib/account';
import { isCloudConfigured } from '@/lib/supabase';
import { SignInOptions } from '@/components/Auth/SignInOptions';
import { AccountHero } from '@/components/Auth/AccountHero';
import type { SyncReport } from '@/lib/cloudSync';
import { setOnboardingComplete } from '@/lib/localUser';
import { AccountRows } from '@/components/Account/AccountRows';
import { styles } from '@/styles/screens/account.styles';

/**
 * Account: sign in with Apple or Google to back up and restore. Signed in, it
 * shows the same rows as Privacy & security (components/Account/AccountRows). (Email sign-in was removed: Apple or Google only.)
 *
 * Opened with ?restore=1 from the first onboarding screen, for someone who
 * already has an account: after signing in they go straight to their restored
 * habits instead of building a new plan.
 */
export default function AccountScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accent } = useAccentGradient();
    const { successFeedback } = useHaptics();
    const { restore } = useLocalSearchParams<{ restore?: string }>();
    const restoring = restore === '1';
    const closeAccount = () => {
        if (router.canGoBack()) router.back();
        else router.replace(restoring ? '/(auth)/onboarding' : '/(root)/(tabs)/home');
    };

    // Opens already knowing who is signed in (kept once read), then refreshes behind it.
    const [account, setAccount] = useState<Account | null>(() => knownAccount() ?? null);
    const [loading, setLoading] = useState(() => knownAccount() === undefined);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const refresh = useCallback(async () => {
        setAccount(await currentAccount());
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

    // Signed in: the same rows as Privacy & security (backup, sign out).
    const renderSignedIn = () => <AccountRows />;

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

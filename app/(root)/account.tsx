import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import {
    currentAccount, deleteAccount, isEmail, onAccountChange, requestCode, signOut, verifyCode,
    type Account,
} from '@/lib/account';
import { lastSyncedAt, syncNow } from '@/lib/cloudSync';
import { isCloudConfigured } from '@/lib/supabase';
import { setOnboardingComplete } from '@/lib/localUser';
import { restartAfterDeletion } from '@/lib/accountDeletion';

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

    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
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

    const confirmCode = async () => {
        if (busy) return;
        lightFeedback();
        setBusy('verify');
        setMessage(null);
        const result = await verifyCode(email, code);
        setBusy(null);
        if (!result.ok) { setMessage({ tone: 'error', text: result.error }); return; }

        successFeedback();
        const report = result.value;
        await refresh();

        if (restoring) {
            // An existing account with data goes straight to it; a brand new one
            // goes back to build a plan, since there is nothing to restore.
            if (report.downloaded > 0) {
                await setOnboardingComplete();
                router.replace('/(root)/(tabs)/home');
            } else {
                Alert.alert('Nothing to restore yet', 'This account has no backup. Build your plan and it will be backed up from now on.', [
                    { text: 'Build my plan', onPress: () => router.back() },
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
            setMessage({ tone: 'ok', text: 'Everything is backed up.' });
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

    const confirmDelete = () => {
        lightFeedback();
        Alert.alert(
            'Delete your account?',
            'This permanently deletes your account, your backup, your friends and everything on this phone. It cannot be undone.\n\nAny subscription stays with your Apple ID; cancel it in Settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete everything', style: 'destructive',
                    onPress: async () => {
                        setBusy('delete');
                        const result = await deleteAccount();
                        setBusy(null);
                        if (!result.ok) {
                            setMessage({ tone: 'error', text: `${result.error} Nothing was deleted.` });
                            return;
                        }
                        if (!(await restartAfterDeletion())) router.replace('/(auth)/onboarding');
                    },
                },
            ],
        );
    };

    const inputStyle = [styles.input, {
        color: colors.textPrimary, borderColor: colors.border,
        backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    }];

    const PrimaryButton = ({ label, onPress, disabled, working }: { label: string; onPress: () => void; disabled?: boolean; working?: boolean }) => (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled || working}
            onPress={onPress}
            style={[styles.primary, { backgroundColor: disabled ? (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') : accent }]}
        >
            {working ? <ActivityIndicator color="#000" /> : (
                <Text style={[styles.primaryText, { color: disabled ? colors.textTertiary : '#000' }]}>{label}</Text>
            )}
        </TouchableOpacity>
    );

    const renderSignedOut = () => (
        <>
            <VoidCard style={styles.card}>
                <Ionicons name="cloud-upload-outline" size={24} color={accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {restoring ? 'Welcome back' : 'Back up your habits'}
                </Text>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                    {restoring
                        ? 'Sign in with the email you used before. Your habits, goals and tasks come back with you.'
                        : 'Keep a backup, move to a new phone without losing anything, and add friends. No password; we email you a code.'}
                </Text>
            </VoidCard>

            <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL</Text>
            <TextInput
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
                style={inputStyle}
            />

            {codeSent ? (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>CODE</Text>
                    <TextInput
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
                        style={[...inputStyle, styles.codeInput]}
                    />
                    <PrimaryButton label="Sign in" onPress={confirmCode} disabled={code.replace(/\s/g, '').length < 6} working={busy === 'verify'} />
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={resendIn > 0 || !!busy}
                        onPress={sendCode}
                        style={styles.secondary}
                    >
                        <Text style={[styles.secondaryText, { color: resendIn > 0 ? colors.textTertiary : accent }]}>
                            {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                        </Text>
                    </TouchableOpacity>
                </>
            ) : (
                <PrimaryButton label="Send code" onPress={sendCode} disabled={!isEmail(email)} working={busy === 'send'} />
            )}
        </>
    );

    const renderSignedIn = () => (
        <>
            <VoidCard style={styles.card}>
                <View style={styles.row}>
                    <View style={[styles.avatar, { backgroundColor: accent + '22' }]}>
                        <Ionicons name="person" size={20} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginTop: 0 }]} numberOfLines={1}>{account?.email ?? 'Signed in'}</Text>
                        <Text style={[styles.cardBody, { color: colors.textTertiary, marginTop: 2 }]}>{since(lastSync)}</Text>
                    </View>
                </View>
            </VoidCard>

            <PrimaryButton label="Back up now" onPress={backUpNow} working={busy === 'sync'} />

            <View style={{ height: 24 }} />
            <TouchableOpacity accessibilityRole="button" disabled={!!busy} onPress={confirmSignOut} style={[styles.outline, { borderColor: colors.border }]}>
                {busy === 'signout' ? <ActivityIndicator color={colors.textPrimary} /> : (
                    <Text style={[styles.outlineText, { color: colors.textPrimary }]}>Sign out</Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={!!busy} onPress={confirmDelete} style={styles.secondary}>
                {busy === 'delete' ? <ActivityIndicator color={colors.error} /> : (
                    <Text style={[styles.secondaryText, { color: colors.error }]}>Delete account</Text>
                )}
            </TouchableOpacity>
        </>
    );

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Account</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                        {!isCloudConfigured() ? (
                            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>Accounts are not available in this build.</Text>
                        ) : loading ? (
                            <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
                        ) : account ? renderSignedIn() : renderSignedOut()}

                        {message ? (
                            <View style={[styles.note, {
                                backgroundColor: message.tone === 'error' ? colors.error + '18' : accent + '14',
                                borderColor: message.tone === 'error' ? colors.error + '44' : accent + '44',
                            }]}>
                                <Ionicons
                                    name={message.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                                    size={16}
                                    color={message.tone === 'error' ? colors.error : accent}
                                />
                                <Text style={[styles.noteText, { color: message.tone === 'error' ? colors.error : colors.textPrimary }]}>{message.text}</Text>
                            </View>
                        ) : null}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '700', fontFamily: 'Lexend' },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    card: { padding: 18, gap: 6, marginBottom: 8 },
    cardTitle: { fontSize: 17, fontFamily: 'Lexend_600SemiBold', marginTop: 6 },
    cardBody: { fontSize: 13, lineHeight: 19, fontFamily: 'Lexend_400Regular' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium', marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, fontFamily: 'Lexend_400Regular' },
    codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontFamily: 'Lexend_600SemiBold' },
    primary: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginTop: 4 },
    primaryText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    outline: { paddingVertical: 15, borderRadius: 999, alignItems: 'center', borderWidth: 1 },
    outlineText: { fontSize: 15, fontFamily: 'Lexend_500Medium' },
    secondary: { paddingVertical: 14, alignItems: 'center' },
    secondaryText: { fontSize: 14, fontFamily: 'Lexend_500Medium' },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
    noteText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Lexend_400Regular' },
});

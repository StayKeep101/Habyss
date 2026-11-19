import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { currentAccount, knownAccount, onAccountChange, signOut, type Account } from '@/lib/account';
import { lastSyncedAt, syncNow } from '@/lib/cloudSync';
import { isCloudConfigured } from '@/lib/supabase';
import { restartAfterDeletion } from '@/lib/accountDeletion';

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
 * Your account, as rows: who is signed in, Back up now and Sign out; signed
 * out, one row to sign in (the Account page, which is also where every "Sign
 * in" in the app leads). Shown at the top of Privacy & security and on Account.
 */
export function AccountRows() {
    const { lightFeedback, successFeedback } = useHaptics();
    const [account, setAccount] = useState<Account | null>(() => knownAccount() ?? null);
    const [busy, setBusy] = useState<null | 'sync' | 'signout'>(null);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
    const [lastSync, setLastSync] = useState<string | null>(null);

    const refresh = useCallback(() => {
        void currentAccount().then(setAccount);
        void lastSyncedAt().then(setLastSync);
    }, []);
    useEffect(() => {
        refresh();
        return onAccountChange(refresh);
    }, [refresh]);

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
                ? { tone: 'ok', text: `Backed up, except ${report.waiting.join(' and ')}: the server needs its database update first.` }
                : { tone: 'ok', text: 'Everything is backed up.' });
        } else {
            setMessage({ tone: 'error', text: report.error ?? `${report.failed} change${report.failed === 1 ? '' : 's'} could not be backed up.` });
        }
    };

    const doSignOut = async (discardUnsaved = false) => {
        setBusy('signout');
        const result = await signOut({ discardUnsaved });
        if (result.ok) {
            if (!(await restartAfterDeletion())) router.replace('/(auth)/onboarding');
            return;
        }
        setBusy(null);
        if (result.unsaved) {
            // Nothing has been cleared yet; the user decides whether to lose it.
            Alert.alert('Not everything is backed up',
                `${result.error}\n\nSigning out now removes this data from this phone and it cannot be recovered.`, [
                    { text: 'Stay signed in', style: 'cancel' },
                    { text: 'Sign out anyway', style: 'destructive', onPress: () => void doSignOut(true) },
                ]);
            return;
        }
        setMessage({ tone: 'error', text: result.error });
    };

    const confirmSignOut = () => {
        lightFeedback();
        Alert.alert('Sign out?',
            'Your habits are backed up first, then removed from this phone. Sign back in on any phone to get them back.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void doSignOut(false) },
            ]);
    };

    if (!isCloudConfigured()) return null;
    if (!account) {
        return (
            <SettingsGroup title="Account">
                <SettingsRow icon="person-circle" color="#5B8CFF" label="Sign in" value="Back up your plan"
                    onPress={() => { lightFeedback(); router.push('/(root)/account'); }} />
            </SettingsGroup>
        );
    }
    return (
        <>
            <SettingsGroup title="Account">
                <SettingsRow icon="person-circle" color="#5B8CFF" label={account.email ?? 'Signed in'} />
                <SettingsRow icon="cloud-upload" color="#30D158" label={busy === 'sync' ? 'Backing up…' : 'Back up now'}
                    value={since(lastSync)} disabled={!!busy} onPress={() => void backUpNow()} />
                <SettingsRow icon="log-out" color="#8A8A94" label={busy === 'signout' ? 'Signing out…' : 'Sign out'}
                    disabled={!!busy} onPress={confirmSignOut} />
            </SettingsGroup>
            {message ? <Text variant="caption" tone={message.tone === 'error' ? 'danger' : 'muted'}>{message.text}</Text> : null}
        </>
    );
}

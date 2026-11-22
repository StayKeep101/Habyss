import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppIcon, AppTextField, DateWheels, SettingsGroup, SettingsRow, SheetScreen, Text, VoidSheet } from '@/components/ui';
import { UsernameCard, UsernameInline } from '@/components/Profile/UsernameCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useTokens } from '@/hooks/useTokens';
import { ageFrom, saveProfile } from '@/lib/profile';
import { getMyUsername } from '@/lib/friendsService';
import { currentAccount, knownAccount, onAccountChange } from '@/lib/account';
import { useAccountActions } from '@/components/Account/AccountRows';
import { confirmsDeletion, deleteEverything, startOver } from '@/lib/deleteEverything';
import { localDateKey } from '@/lib/habitSchedule';
import { styles } from '@/styles/screens/account-settings.styles';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

/**
 * Your account: everything about you that others see, and the one place it is
 * changed (the profile only shows it, so nothing changes by a stray tap).
 * Picture, display name, @username, what you do, birthday (your age is worked
 * out from it); your backup. Log out floats at the foot; Delete account sits
 * at the very end of the page and asks you to type your @username first.
 */
export default function AccountSettingsScreen() {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { selectionFeedback, lightFeedback } = useHaptics();
    const profile = useMyProfile();
    const [name, setName] = useState<string | null>(null);
    const [occupation, setOccupation] = useState<string | null>(null);
    const [handle, setHandle] = useState<string | null | undefined>(undefined);
    const [editingHandle, setEditingHandle] = useState(false);
    const [birthdayOpen, setBirthdayOpen] = useState(false);
    const [birthday, setBirthday] = useState<Date>(() => new Date(2000, 0, 1));
    const [email, setEmail] = useState<string | null>(() => knownAccount()?.email ?? null);
    const [deleting, setDeleting] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const account = useAccountActions();

    useEffect(() => { void getMyUsername().then(found => setHandle(found ?? null)).catch(() => setHandle(null)); }, []);
    useEffect(() => {
        void currentAccount().then(account => setEmail(account?.email ?? null)).catch(() => undefined);
        return onAccountChange(account => setEmail(account?.email ?? null));
    }, []);

    const age = profile.birthday ? ageFrom(profile.birthday) : null;
    // What you type to delete: your @username, or DELETE without one.
    const word = handle || 'DELETE';
    const confirmed = handle ? confirmsDeletion(typed, handle) : typed.trim().toUpperCase() === 'DELETE';

    const pickPhoto = async () => {
        if (!ImagePicker) { Alert.alert('Not available', 'Photos need the full app build.'); return; }
        lightFeedback();
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
            if (!result.canceled && result.assets?.[0]?.uri) void saveProfile({ avatar: result.assets[0].uri });
        } catch { Alert.alert('Could not open your photos', 'Please try again.'); }
    };

    const remove = async () => {
        if (!confirmed || busy) return;
        setBusy(true);
        const result = await deleteEverything();
        setBusy(false);
        if (!result.ok) { Alert.alert('Account not deleted', result.error); return; }
        setDeleting(false);
        Alert.alert(result.failed.length ? 'Partly deleted' : 'Account deleted',
            result.failed.length ? `Your data was removed, except: ${result.failed.join(', ')}. Deleting the app removes anything left.` : 'Everything has been removed.',
            [{ text: 'OK', onPress: () => void startOver() }]);
    };

    return (
        <SheetScreen title="Account" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + t.space['4xl'] * 2 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
                {/* Your picture: tap to change it, hold to remove it. */}
                <Pressable accessibilityRole="button" accessibilityLabel={profile.avatar ? 'Change your picture' : 'Add a picture'} accessibilityHint={profile.avatar ? 'Hold to remove it' : undefined}
                    onPress={() => void pickPhoto()} onLongPress={profile.avatar ? () => { selectionFeedback(); void saveProfile({ avatar: null }); } : undefined} style={styles.photoWrap}>
                    <View style={[styles.photo, { backgroundColor: t.color.surfaceRaised }]}>
                        {profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.photoImage} />
                            : <AppIcon name="person" size={t.space["3xl"]} color={t.color.accent} />}
                    </View>
                    <View style={[styles.camera, { backgroundColor: t.color.accent, borderColor: t.color.background }]}>
                        <AppIcon name="camera" size={t.space.md + 2} color={t.color.background} />
                    </View>
                </Pressable>

                <View style={styles.fields}>
                    <AppTextField label="Display name" value={name ?? profile.name} onChangeText={setName} placeholder="Your name"
                        onEndEditing={() => { if (name !== null) { void saveProfile({ name: name.trim() }); setName(null); } }} accessibilityLabel="Display name" />
                    <AppTextField label="What you do" value={occupation ?? profile.occupation} onChangeText={setOccupation} placeholder="Student, designer, founder…"
                        onEndEditing={() => { if (occupation !== null) { void saveProfile({ occupation: occupation.trim() }); setOccupation(null); } }} accessibilityLabel="What you do" />
                </View>

                <SettingsGroup title="Username">
                    {handle === undefined ? null : handle && editingHandle ? (
                        <UsernameInline current={handle} onSaved={found => { setHandle(found); setEditingHandle(false); }} onCancel={() => setEditingHandle(false)} />
                    ) : handle === null ? (
                        <UsernameCard flush current={null} signedIn={!!email} onSaved={found => setHandle(found)} onSignIn={() => router.push('/(root)/account')} />
                    ) : (
                        <SettingsRow icon="at" color={t.color.accent} label={`@${handle}`} value="Change" onPress={() => { selectionFeedback(); setEditingHandle(true); }} />
                    )}
                </SettingsGroup>

                <SettingsGroup title="About you">
                    <SettingsRow icon="gift" color={t.color.warning} label="Birthday"
                        value={profile.birthday ? `${new Date(`${profile.birthday}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}${age !== null ? ` · ${age}` : ''}` : 'Add'}
                        onPress={() => { selectionFeedback(); setBirthday(profile.birthday ? new Date(`${profile.birthday}T12:00:00`) : new Date(2000, 0, 1)); setBirthdayOpen(true); }} />
                </SettingsGroup>

                {/* Your backup: when it last ran, and Back up now; signed out, how to sign in. */}
                {account.account ? (
                    <SettingsGroup title="Backup">
                        <SettingsRow icon="cloud-upload" color={t.color.success} label={account.busy === 'sync' ? 'Backing up…' : 'Back up now'}
                            value={account.lastSync} disabled={!!account.busy} onPress={() => void account.backUpNow()} />
                    </SettingsGroup>
                ) : (
                    <SettingsGroup title="Backup">
                        <SettingsRow icon="person-circle" color={t.color.accent} label="Sign in" value="Back up your plan" onPress={account.signIn} />
                    </SettingsGroup>
                )}
                {account.message ? <Text variant="caption" tone={account.message.tone === 'error' ? 'danger' : 'muted'}>{account.message.text}</Text> : null}

                {/* Delete account, at the very end of the page: kept apart, and it asks for your @username first. */}
                <View style={styles.deleteRow}>
                    <AppButton label="Delete account" icon="trash" variant="danger" onPress={() => { lightFeedback(); setTyped(''); setDeleting(true); }} />
                </View>
            </ScrollView>

            {/* Log out, floating at the foot (backed up first; it asks before losing anything). */}
            {account.account ? (
                <View pointerEvents="box-none" style={[styles.floating, { paddingBottom: insets.bottom + t.space.md }]}>
                    <AppButton label={account.busy === 'signout' ? 'Logging out…' : 'Log out'} icon="log-out"
                        disabled={!!account.busy} onPress={account.confirmSignOut} />
                </View>
            ) : null}

            <VoidSheet visible={birthdayOpen} onClose={() => setBirthdayOpen(false)} title="Birthday"
                footer={<View style={styles.sheetFoot}><AppButton label="Save" icon="checkmark" variant="primary" onPress={() => { selectionFeedback(); void saveProfile({ birthday: localDateKey(birthday) }); setBirthdayOpen(false); }} /></View>}>
                <View style={styles.sheetBody}><DateWheels value={birthday} onChange={setBirthday} /></View>
            </VoidSheet>

            <VoidSheet visible={deleting} onClose={() => setDeleting(false)} title="Delete account" caption="This cannot be undone"
                footer={<View style={styles.sheetFoot}><AppButton label={busy ? 'Deleting…' : 'Delete everything'} icon="trash" variant="danger" disabled={!confirmed || busy} loading={busy} onPress={() => void remove()} /></View>}>
                <View style={styles.sheetBody}>
                    <Text variant="body" tone="muted">Your habits, tasks, streaks, history and settings are removed, here and on the server. We keep no copy to restore. Any subscription stays with your Apple ID.</Text>
                    <AppTextField label={handle ? `Type @${word} to confirm` : 'Type DELETE to confirm'} value={typed} onChangeText={setTyped}
                        autoCapitalize="none" autoCorrect={false} placeholder={handle ? `@${word}` : 'DELETE'} accessibilityLabel="Confirm by typing your username" />
                </View>
            </VoidSheet>
        </SheetScreen>
    );
}

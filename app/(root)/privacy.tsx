import { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

import { SheetScreen } from '@/components/ui/SheetScreen';

import { useAppSettings } from '@/context/AppSettingsContext';
import { deleteAllLocalData, restartAfterDeletion } from '@/lib/accountDeletion';
import { currentAccount, deleteAccount } from '@/lib/account';
import { styles } from '@/styles/screens/privacy.styles';
import { exportMyData } from '@/lib/dataExport';
import { clearPasscode, hasPasscode } from '@/lib/appPasscode';
import { PasscodeSetup } from '@/components/Auth/PasscodeSetup';

const Privacy = () => {
  // const colorScheme = useColorScheme();
  const { lightFeedback } = useHaptics();
  const { isAppLockEnabled, setIsAppLockEnabled } = useAppSettings();

  const [deleting, setDeleting] = useState(false);
  const [changingLock, setChangingLock] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Habyss's own passcode, for when Face ID doesn't work (lib/appPasscode.ts).
  const [hasCode, setHasCode] = useState(false);
  const [settingCode, setSettingCode] = useState(false);
  useEffect(() => { void hasPasscode().then(setHasCode); }, []);

  // Everything you did, as a spreadsheet, wherever you want it.
  const exportData = async () => {
    if (exporting) return;
    lightFeedback();
    setExporting(true);
    const result = await exportMyData();
    setExporting(false);
    if (result === 'failed') Alert.alert('Export didn’t finish', 'Your data couldn’t be gathered just now. Nothing changed. Try again in a moment.');
  };

  const changeAppLock = async (enabled: boolean) => {
    if (changingLock) return;
    lightFeedback();
    setChangingLock(true);
    try {
      await setIsAppLockEnabled(enabled);
      // On: choose the passcode next. Off: it has nothing left to guard.
      if (enabled && !(await hasPasscode())) setSettingCode(true);
      if (!enabled) { await clearPasscode(); setHasCode(false); }
    }
    catch (error: any) { Alert.alert('App Lock unchanged', error?.message || 'The setting could not be saved. Please try again.'); }
    finally { setChangingLock(false); }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your habits, streaks, history, settings and the downloaded AI model from this device. It cannot be undone, and we hold no copy to restore.\n\nAny subscription stays with your Apple ID; cancel it in Settings if you no longer want it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            // Signed in: delete the account and its backup on the server too, or they
                        // would outlive what the user was told was deleted.
                        const signedIn = await currentAccount().catch(() => null);
                        if (signedIn) {
                            const serverResult = await deleteAccount();
                            if (!serverResult.ok) {
                                Alert.alert('Account not deleted', `${serverResult.error} Nothing was deleted.`);
                                return;
                            }
                        }
                        const report = signedIn ? { ok: true, failed: [] as { label: string }[] } : await deleteAllLocalData();
            setDeleting(false);

            // Onboarding state is gone with the rest, so send the user back to the start.
            const restart = async () => {
              // A reload clears contexts and cached ids; navigation is the fallback.
              if (!(await restartAfterDeletion())) router.replace('/(auth)/onboarding');
            };

            if (report.ok) {
              Alert.alert('Account deleted', 'Everything stored on this device has been removed.', [
                { text: 'OK', onPress: restart },
              ]);
            } else {
              Alert.alert(
                'Partly deleted',
                `Your data was removed, except: ${report.failed.map(step => step.label).join(', ')}. ` +
                'Deleting the app from your device removes anything left.',
                [{ text: 'OK', onPress: restart }],
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SheetScreen title="Privacy & security" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsGroup>
          <SettingsRow icon="scan" color="#30D158" label="Face ID lock" toggle={isAppLockEnabled} disabled={changingLock}
            onToggle={value => void changeAppLock(value)} />
          {isAppLockEnabled ? (
            <SettingsRow icon="keypad" color="#30D158" label="Passcode" value={hasCode ? 'Change' : 'Set'}
              onPress={() => { lightFeedback(); setSettingCode(true); }} />
          ) : null}
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow icon="download" color="#0A84FF" label={exporting ? 'Preparing…' : 'Export my data'} value="CSV" disabled={exporting}
            onPress={() => void exportData()} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow icon="trash" color="#FF453A" label={deleting ? 'Deleting…' : 'Delete account'} destructive disabled={deleting}
            onPress={handleDeleteAccount} />
        </SettingsGroup>
      </ScrollView>
      <PasscodeSetup visible={settingCode} onCancel={() => setSettingCode(false)}
        onDone={() => { setSettingCode(false); setHasCode(true); }} />
    </SheetScreen>
  );
};


export default Privacy;

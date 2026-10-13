import { useAccentGradient } from '@/context/AccentContext';
import { AppButton } from '@/components/Common/AppButton';
import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';
import { useState } from 'react';
import { ScrollView, View, Text, Switch, Alert } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/context/ThemeContext';

import { useAppSettings } from '@/context/AppSettingsContext';
import { deleteAllLocalData, restartAfterDeletion } from '@/lib/accountDeletion';
import { currentAccount, deleteAccount } from '@/lib/account';
import { styles } from '@/styles/screens/privacy.styles';

const Privacy = () => {
  // const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { primary: accent } = useAccentGradient();
  const isLight = theme === 'light';
  const isTrueDark = theme === 'trueDark';
  const { lightFeedback } = useHaptics();
  const { isAppLockEnabled, setIsAppLockEnabled } = useAppSettings();

  const [deleting, setDeleting] = useState(false);
  const [changingLock, setChangingLock] = useState(false);

  const changeAppLock = async (enabled: boolean) => {
    if (changingLock) return;
    lightFeedback();
    setChangingLock(true);
    try { await setIsAppLockEnabled(enabled); }
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

        {/* Settings */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Data Collection */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATA COLLECTION</Text>
          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                borderColor: colors.border
              }
            ]}
          >
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.textSecondary} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Everything stays on this device</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Habyss has no analytics or tracking, and your habits are never uploaded to us.
                  </Text>
                </View>
              </View>
            </View>
          </VoidCard>

          {/* Security */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>SECURITY</Text>
          <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={[
              styles.card,
              {
                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                borderColor: colors.border
              }
            ]}
          >
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
                <View style={styles.textContent}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>App Lock</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Face ID, Touch ID or device passcode</Text>
                </View>
              </View>
              <Switch
                value={isAppLockEnabled}
                disabled={changingLock}
                accessibilityLabel="App Lock"
                onValueChange={changeAppLock}
                trackColor={{ false: colors.border, true: accent }}
              />
            </View>
          </VoidCard>

          {/* Danger Zone */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>DANGER ZONE</Text>
          <AppButton label="Delete Account" variant="danger" icon="trash-outline" onPress={handleDeleteAccount} loading={deleting} />
        </ScrollView>
      </SheetScreen>
  );
};


export default Privacy;

import { router } from 'expo-router';
import { Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppButton } from '@/components/Common/AppButton';
import { AppTextField } from '@/components/Common/AppTextField';
import { SectionDivider } from '@/components/Common/SectionDivider';
import { getLocalUserId, setLocalProfileName, setOnboardingComplete } from '@/lib/localUser';
import { useAppSettings } from '@/constants/AppSettingsContext';

const SignUp = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { isAppLockEnabled, setIsAppLockEnabled } = useAppSettings();

  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    try {
      await getLocalUserId();
      await setLocalProfileName(nickname.trim() || 'Operator');
      await setOnboardingComplete();
      router.replace("/(root)/(tabs)/home");
    } finally {
      setLoading(false);
    }
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Animated.View style={{ flex: 1 }} entering={FadeInDown.duration(800).springify()}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >

              {/* Header */}
              <View style={{ marginBottom: 32, marginTop: 20 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>SET UP THIS DEVICE</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Create your local Habyss vault</Text>
              </View>

              {/* Form Container */}
              <VoidCard glass style={{ padding: 24 }}>
                <AppTextField
                  label="Codename"
                  leadingIcon="sparkles-outline"
                  placeholder="What should Habyss call you?"
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                />

                <View style={[styles.localOnlyCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.localOnlyTitle, { color: colors.textPrimary }]}>This app stays local</Text>
                  <Text style={[styles.localOnlyBody, { color: colors.textSecondary }]}>
                    No cloud account. No hosted database. Your profile, habits, routines, and personal AI stay on this device.
                  </Text>
                </View>

                <View style={[styles.lockRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.lockTitle, { color: colors.textPrimary }]}>Face ID / Touch ID lock</Text>
                    <Text style={[styles.lockBody, { color: colors.textSecondary }]}>
                      Require biometric unlock when reopening Habyss on this device.
                    </Text>
                  </View>
                  <Switch
                    value={isAppLockEnabled}
                    onValueChange={setIsAppLockEnabled}
                    trackColor={{ false: colors.surfaceTertiary, true: colors.primary + '66' }}
                    thumbColor={isAppLockEnabled ? colors.primary : colors.textSecondary}
                  />
                </View>

                <AppButton label="Enter Habyss" onPress={handleSignUp} loading={loading} style={styles.primaryButton} />

              </VoidCard>

              <SectionDivider label="already configured?" />

              <AppButton
                label="Resume On This Device"
                onPress={() => router.replace('/(auth)/sign-in')}
                variant="secondary"
              />

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend_400Regular', fontSize: 12 }}>Need to recalibrate first? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
                  <Text style={{ color: colors.primary, fontFamily: 'Lexend_400Regular', fontWeight: 'bold', fontSize: 12 }}>Resume setup</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </VoidShell>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontFamily: 'Lexend',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  primaryButton: {
    marginTop: 24,
  },
  localOnlyCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  localOnlyTitle: {
    fontSize: 15,
    fontFamily: 'Lexend',
    marginBottom: 6,
  },
  localOnlyBody: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Lexend_400Regular',
  },
  lockRow: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockTitle: {
    fontSize: 14,
    fontFamily: 'Lexend',
    marginBottom: 4,
  },
  lockBody: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Lexend_400Regular',
  },
});

export default SignUp;

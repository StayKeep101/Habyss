import { router } from 'expo-router';
import { Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AppButton } from '@/components/Common/AppButton';
import { SectionDivider } from '@/components/Common/SectionDivider';
import { getLocalProfileName, setOnboardingComplete } from '@/lib/localUser';
import { SpinningLogo } from '@/components/SpinningLogo';

const SignIn = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    getLocalProfileName().then(setNickname);
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    await setOnboardingComplete();
    router.replace("/(root)/(tabs)/home");
  };

  return (
    <VoidShell>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}
        >
          <Animated.View entering={FadeInDown.duration(800).springify()}>

            {/* Header */}
            <View style={{ marginBottom: 40 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>RETURN TO HABYSS</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Unlock your local system on this device</Text>
            </View>

            {/* Form Container */}
            <VoidCard glass style={{ padding: 24 }}>
              <View style={styles.logoWrap}>
                <SpinningLogo size={84} glow />
              </View>
              <Text style={[styles.localHeadline, { color: colors.textPrimary }]}>
                {nickname ? `Welcome back, ${nickname}` : 'This device is ready to continue offline'}
              </Text>
              <Text style={[styles.localBody, { color: colors.textSecondary }]}>
                Habyss does not use hosted accounts in this build. Your habits, routines, focus history, and AI remain local.
              </Text>

              {/* Sign In Button */}
              <AppButton label="Continue On This Device" onPress={handleSignIn} loading={loading} style={styles.primaryButton} />

            </VoidCard>

            <SectionDivider label="need local setup?" />

            <AppButton
              label="Rebuild This Device Profile"
              onPress={() => router.replace('/(auth)/sign-up')}
              variant="secondary"
            />

            {/* Footer Actions */}
            <View style={{ marginTop: 20, gap: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend_400Regular', fontSize: 12 }}>Fresh device? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
                  <Text style={{ color: colors.primary, fontFamily: 'Lexend_400Regular', fontWeight: 'bold', fontSize: 12 }}>Set it up</Text>
                </TouchableOpacity>
              </View>
            </View>

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
  logoWrap: {
    alignItems: 'center',
    marginBottom: 22,
  },
  localHeadline: {
    textAlign: 'center',
    fontSize: 22,
    fontFamily: 'Lexend',
    marginBottom: 10,
  },
  localBody: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Lexend_400Regular',
  },
});

export default SignIn;

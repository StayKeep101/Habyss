import { router } from 'expo-router';
import { Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, Alert, StyleSheet, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppleAuthButton } from '@/components/Auth/AppleAuthButton';
import { AppButton } from '@/components/Common/AppButton';
import { AppTextField } from '@/components/Common/AppTextField';
import { SectionDivider } from '@/components/Common/SectionDivider';

const SignUp = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    // In local mode, just route to home
    await AsyncStorage.setItem('habyss_onboarding_complete', 'true');
    router.replace("/(root)/(tabs)/home");
  };

  const handleGoogleSignUp = async () => {
    // Cloud auth disabled in local-only mode
    Alert.alert('Coming Soon', 'Cloud sign-up will be available with premium.');
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
                <Text style={[styles.title, { color: colors.textPrimary }]}>CREATE ACCOUNT</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join us</Text>
              </View>

              {/* Form Container */}
              <VoidCard glass style={{ padding: 24 }}>
                <AppTextField
                  label="Email"
                  leadingIcon="mail-outline"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={{ marginTop: 16 }}>
                  <AppTextField
                    label="Password"
                    leadingIcon="lock-closed-outline"
                    trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onTrailingPress={() => setShowPassword(!showPassword)}
                    placeholder="Create a password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>

                <View style={{ marginTop: 16 }}>
                  <AppTextField
                    label="Confirm Password"
                    leadingIcon="shield-checkmark-outline"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>

                <AppButton label="Create Account" onPress={handleSignUp} loading={loading} style={styles.primaryButton} />

                {/* Terms & Privacy Links */}
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 10, textAlign: 'center', fontFamily: 'Lexend_400Regular' }}>
                    By signing up, you agree to our{' '}
                    <Text
                      style={{ color: colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => Linking.openURL('https://habyss.com/terms')}
                    >
                      Terms
                    </Text>
                    {' '}and{' '}
                    <Text
                      style={{ color: colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => Linking.openURL('https://habyss.com/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </View>

              </VoidCard>

              <SectionDivider label="or" />

              {/* Social Sign Up */}
              <View style={{ gap: 12 }}>
                <AppleAuthButton type="sign-up" />

                <AppButton
                  label="Continue with Google"
                  onPress={handleGoogleSignUp}
                  disabled={loading}
                  variant="secondary"
                  icon="logo-google"
                />
              </View>

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend_400Regular', fontSize: 12 }}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
                  <Text style={{ color: colors.primary, fontFamily: 'Lexend_400Regular', fontWeight: 'bold', fontSize: 12 }}>Sign In</Text>
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
});

export default SignUp;

import { router } from 'expo-router';
import { Text, TouchableOpacity, View, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AppleAuthButton } from '@/components/Auth/AppleAuthButton';
import { AppButton } from '@/components/Common/AppButton';
import { AppTextField } from '@/components/Common/AppTextField';
import { SectionDivider } from '@/components/Common/SectionDivider';

const SignIn = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    // In local mode, just route to home
    await AsyncStorage.setItem('habyss_onboarding_complete', 'true');
    router.replace("/(root)/(tabs)/home");
  };

  const handleGoogleSignIn = async () => {
    // Cloud auth disabled in local-only mode
    Alert.alert('Coming Soon', 'Cloud sign-in will be available with premium.');
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
              <Text style={[styles.title, { color: colors.textPrimary }]}>WELCOME BACK</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Log in to continue</Text>
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

              <View style={{ marginTop: 20 }}>
                <AppTextField
                  label="Password"
                  leadingIcon="lock-closed-outline"
                  trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onTrailingPress={() => setShowPassword(!showPassword)}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity style={{ alignItems: 'flex-end', marginTop: 12 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Lexend_400Regular', letterSpacing: 0.5 }}>FORGOT PASSWORD?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <AppButton label="Sign In" onPress={handleSignIn} loading={loading} style={styles.primaryButton} />

            </VoidCard>

            <SectionDivider label="or" />

            {/* Social Sign In */}
            <View style={{ gap: 12 }}>
              <AppleAuthButton type="sign-in" />

              <AppButton
                label="Continue with Google"
                onPress={handleGoogleSignIn}
                disabled={loading}
                variant="secondary"
                icon="logo-google"
              />
            </View>

            {/* Footer Actions */}
            <View style={{ marginTop: 20, gap: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend_400Regular', fontSize: 12 }}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
                  <Text style={{ color: colors.primary, fontFamily: 'Lexend_400Regular', fontWeight: 'bold', fontSize: 12 }}>Join Us</Text>
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
});

export default SignIn;

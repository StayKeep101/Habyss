import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { supabase } from '@/lib/supabase';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppleAuthButton } from '@/components/Auth/AppleAuthButton';

const SignUp = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (error) throw error;

      // HARD PAYWALL: Redirect to paywall instead of home for new users
      router.replace("/(root)/onboarding-paywall");
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'habyss://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data.url) {
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert('Error', 'Cannot open browser for sign-up');
        }
      }
    } catch (e: any) {
      console.error('Google sign-up error:', e);
      Alert.alert('Error', e.message || 'Could not sign up with Google');
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
                <Text style={[styles.title, { color: colors.textPrimary }]}>CREATE ACCOUNT</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join us</Text>
              </View>

              {/* Form Container */}
              <VoidCard glass style={{ padding: 24 }}>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL</Text>
                  <View style={[styles.inputContainer, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                    <TextInput
                      placeholder="Enter your email"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.input, { color: colors.textPrimary }]}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
                  <View style={[styles.inputContainer, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                    <TextInput
                      placeholder="Create a password"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.input, { color: colors.textPrimary }]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
                  <View style={[styles.inputContainer, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                    <TextInput
                      placeholder="Confirm your password"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.input, { color: colors.textPrimary }]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                  </View>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity
                  onPress={handleSignUp}
                  disabled={loading}
                  style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                >
                  {loading ? (
                    <ActivityIndicator color="black" />
                  ) : (
                    <Text style={styles.buttonText}>SIGN UP</Text>
                  )}
                </TouchableOpacity>

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

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Lexend_400Regular', marginHorizontal: 12 }}>OR</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              </View>

              {/* Social Sign Up */}
              <View style={{ gap: 12 }}>
                <AppleAuthButton type="sign-up" />

                <TouchableOpacity
                  onPress={handleGoogleSignUp}
                  disabled={loading}
                  style={[styles.googleButton, { borderColor: 'rgba(255,255,255,0.2)' }]}
                >
                  <Ionicons name="logo-google" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
                  <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>Continue with Google</Text>
                </TouchableOpacity>
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
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Lexend_400Regular',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    fontFamily: 'Lexend_400Regular',
  },
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: 'black',
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  googleButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  googleButtonText: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default SignUp;

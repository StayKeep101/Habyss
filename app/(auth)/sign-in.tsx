import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { supabase } from '@/lib/supabase';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AppleAuthButton } from '@/components/Auth/AppleAuthButton';

const SignIn = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.replace("/(root)/(tabs)/home");
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
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
        // Open the OAuth URL in the browser
        const supported = await Linking.canOpenURL(data.url);
        if (supported) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert('Error', 'Cannot open browser for sign-in');
        }
      }
    } catch (e: any) {
      console.error('Google sign-in error:', e);
      Alert.alert('Error', e.message || 'Could not sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      router.replace("/(root)/(tabs)/home");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", "Could not sign in anonymously");
    } finally {
      setLoading(false);
    }
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
              <View style={[styles.inputGroup, { marginTop: 20 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>PASSWORD</Text>
                <View style={[styles.inputContainer, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                  <TextInput
                    placeholder="Enter your password"
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

              <TouchableOpacity style={{ alignItems: 'flex-end', marginTop: 12 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Lexend_400Regular', letterSpacing: 0.5 }}>FORGOT PASSWORD?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={loading}
                style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              >
                {loading ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text style={styles.buttonText}>SIGN IN</Text>
                )}
              </TouchableOpacity>

            </VoidCard>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'Lexend_400Regular', marginHorizontal: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </View>

            {/* Social Sign In */}
            <View style={{ gap: 12 }}>
              <AppleAuthButton type="sign-in" />

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading}
                style={[styles.googleButton, { borderColor: 'rgba(255,255,255,0.2)' }]}
              >
                <Ionicons name="logo-google" size={20} color={colors.textPrimary} style={{ marginRight: 12 }} />
                <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>Continue with Google</Text>
              </TouchableOpacity>
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
  // glassCard removed
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
    color: 'black', // High contrast on cyan/primary
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

export default SignIn;

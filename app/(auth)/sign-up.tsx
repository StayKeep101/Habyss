import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

const SignUp = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
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

      router.replace("/(root)/(tabs)/home");
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
     Alert.alert("Coming Soon", "Google Sign-In will be available soon!");
     // TODO: Implement Supabase Google Auth
     // await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, paddingHorizontal: 24 }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* Header */}
          <View className="mb-8">
            <Text className="text-4xl font-bold mb-2" style={{ color: colors.textPrimary }}>Create Account</Text>
            <Text className="text-lg" style={{ color: colors.textSecondary }}>Start building better habits today</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            
            {/* Email */}
            <View>
              <Text className="mb-2 font-medium" style={{ color: colors.textSecondary }}>Email</Text>
              <View 
                className="flex-row items-center px-4 py-3 rounded-2xl border"
                style={{ 
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border
                }}
              >
                <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View className="mt-4">
              <Text className="mb-2 font-medium" style={{ color: colors.textSecondary }}>Password</Text>
              <View 
                className="flex-row items-center px-4 py-3 rounded-2xl border"
                style={{ 
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border
                }}
              >
                <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Create a password"
                  placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
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
             <View className="mt-4">
              <Text className="mb-2 font-medium" style={{ color: colors.textSecondary }}>Confirm Password</Text>
              <View 
                className="flex-row items-center px-4 py-3 rounded-2xl border"
                style={{ 
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border
                }}
              >
                <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Confirm your password"
                  placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, color: colors.textPrimary, fontSize: 16 }}
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
              className="w-full py-4 rounded-2xl items-center justify-center mt-6 shadow-sm"
              style={{ backgroundColor: colors.primary }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
              <Text className="mx-4 text-sm" style={{ color: colors.textTertiary }}>OR</Text>
              <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
            </View>

            {/* Google Sign Up */}
            <TouchableOpacity
              onPress={handleGoogleSignUp}
              disabled={loading}
              className="w-full py-4 rounded-2xl items-center justify-center border flex-row"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}
            >
               <Ionicons name="logo-google" size={20} color={colors.textPrimary} style={{ marginRight: 10 }} />
               <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Sign up with Google</Text>
            </TouchableOpacity>

          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-8">
            <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUp;

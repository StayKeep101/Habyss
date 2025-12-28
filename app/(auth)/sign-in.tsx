import { router } from 'expo-router';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { auth } from '@/Firebase.config';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { getUserId } from '@/lib/habits';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SignIn = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Google Auth Setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    // TODO: Replace with your actual client IDs from Google Cloud Console
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .then(() => {
            router.replace("/(root)/(tabs)/home");
        })
        .catch((error) => {
           console.error(error);
           Alert.alert("Error", "Google Sign-In failed");
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/(root)/(tabs)/home");
    } catch (e: any) {
      console.error(e);
      let msg = 'Failed to sign in';
      if (e.code === 'auth/invalid-credential') msg = 'Invalid email or password';
      if (e.code === 'auth/invalid-email') msg = 'Invalid email address';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      await getUserId(); // Anonymous auth
      router.replace("/(root)/(tabs)/home");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, paddingHorizontal: 24 }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* Header */}
          <View className="mb-10">
            <Text className="text-4xl font-bold mb-2" style={{ color: colors.textPrimary }}>Welcome Back</Text>
            <Text className="text-lg" style={{ color: colors.textSecondary }}>Sign in to continue your journey</Text>
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
                  placeholder="Enter your password"
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

            {/* Forgot Password */}
            <TouchableOpacity className="items-end mt-2">
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading}
              className="w-full py-4 rounded-2xl items-center justify-center mt-6 shadow-sm"
              style={{ backgroundColor: colors.primary }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
              <Text className="mx-4 text-sm" style={{ color: colors.textTertiary }}>OR</Text>
              <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              onPress={() => promptAsync()}
              disabled={loading || !request}
              className="w-full py-4 rounded-2xl items-center justify-center border mb-3 flex-row"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}
            >
               <Ionicons name="logo-google" size={20} color={colors.textPrimary} style={{ marginRight: 10 }} />
               <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Sign in with Google</Text>
            </TouchableOpacity>

            {/* Skip / Guest */}
            <TouchableOpacity
              onPress={handleSkip}
              disabled={loading}
              className="w-full py-4 rounded-2xl items-center justify-center border"
              style={{ borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}
            >
               <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>Continue as Guest</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="flex-row justify-center mt-8">
            <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignIn;

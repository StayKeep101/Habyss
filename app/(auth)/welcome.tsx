import { router } from 'expo-router';
import { Text, TouchableOpacity, View, Dimensions, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  // Animation Values
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTracking = useSharedValue(10); // Spacing starts wide
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(50);

  // Breathing Animation for background
  const bgRotate = useSharedValue(0);

  useEffect(() => {
    // 1. Logo Entrance
    logoOpacity.value = withTiming(1, { duration: 1000 });
    logoScale.value = withSpring(1, { damping: 12 });

    // 2. Title Entrance (Delayed)
    titleOpacity.value = withDelay(500, withTiming(1, { duration: 1000 }));
    titleTracking.value = withDelay(500, withSpring(2, { damping: 15 })); // Closes in

    // 3. Button Entrance (Delayed more)
    buttonOpacity.value = withDelay(1200, withTiming(1, { duration: 800 }));
    buttonY.value = withDelay(1200, withSpring(0, { damping: 12 }));

    // Background slow rotation
    bgRotate.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }]
  }));

  const animatedTitleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    letterSpacing: titleTracking.value
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonY.value }]
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bgRotate.value}deg` }, { scale: 1.5 }]
  }));

  const handleEnter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/sign-up');
  };

  const handleLogin = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <StatusBar style="light" />

      {/* Dynamic Background Mesh */}
      <Animated.View style={[{ position: 'absolute', width: width * 2, height: width * 2, top: -width * 0.5 }, animatedBgStyle]}>
        <LinearGradient
          colors={['#1e1b4b', '#020617', '#312e81']} // Indigo-950 to Slate-950
          style={{ flex: 1, opacity: 0.6 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Center Content */}
      <View style={{ alignItems: 'center', zIndex: 10 }}>
        {/* Logo Placeholder (Geometric H) */}
        <Animated.View style={[
          {
            width: 120,
            height: 120,
            borderRadius: 30,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
            shadowColor: "#60A5FA",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 20
          },
          animatedLogoStyle
        ]}>
          <Ionicons name="cube-outline" size={64} color="#60A5FA" />
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[
          {
            color: 'white',
            fontSize: 42,
            fontWeight: '200',
            textTransform: 'uppercase',
            marginBottom: 10
          },
          animatedTitleStyle
        ]}>
          Habyss
        </Animated.Text>

        <Animated.Text style={[{ color: '#94A3B8', fontSize: 14, letterSpacing: 1, opacity: 0.8 }, animatedButtonStyle]}>
          ARCHITECT YOUR LIFE
        </Animated.Text>
      </View>

      {/* Bottom Actions */}
      <Animated.View style={[{ position: 'absolute', bottom: 60, width: '100%', paddingHorizontal: 30 }, animatedButtonStyle]}>
        <TouchableOpacity
          onPress={handleEnter}
          activeOpacity={0.8}
        >
          <BlurView intensity={30} tint="light" style={{
            overflow: 'hidden',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)'
          }}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.2)', 'rgba(96, 165, 250, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>GET STARTED</Text>
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogin}
          style={{ marginTop: 20, alignItems: 'center', padding: 10 }}
        >
          <Text style={{ color: '#64748B', fontSize: 14 }}>I have an account</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

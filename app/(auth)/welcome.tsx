import { router } from 'expo-router';
import { Text, TouchableOpacity, View, Dimensions, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

interface OnboardingCard {
  title: string;
  description: string;
  icon: string;
}

const onboardingCards: OnboardingCard[] = [
  {
    title: "Welcome to Habyss",
    description: "Your personal productivity companion that helps you achieve more with less effort.",
    icon: "🚀"
  },
  {
    title: "Smart Task Management",
    description: "Organize your tasks intelligently and let AI help you prioritize what matters most.",
    icon: "✨"
  },
  {
    title: "Track Your Progress",
    description: "Monitor your productivity with beautiful insights and detailed analytics.",
    icon: "📊"
  }
];

const Onboarding = () => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const renderCard = (card: OnboardingCard, index: number) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
    });

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [20, 0, 20],
    });

    return (
      <View key={index} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        <Animated.View
          style={{
            transform: [{ scale }, { translateY }],
            opacity,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Big Iconic Centerpiece */}
          <View className="w-40 h-40 rounded-full items-center justify-center mb-10 shadow-lg" 
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <Text className="text-8xl">{card.icon}</Text>
          </View>
          
          <Text className="text-4xl font-extrabold text-white text-center mb-4 tracking-tight leading-tight">
            {card.title}
          </Text>
          <Text className="text-lg text-blue-100 text-center font-medium leading-6 px-4">
            {card.description}
          </Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.light.primary }}>
      <StatusBar style="light" />
      
      {/* Top Section - Brand Area */}
      <View className="flex-1 justify-center pb-20">
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(newIndex);
          }}
        >
          {onboardingCards.map((card, index) => renderCard(card, index))}
        </Animated.ScrollView>

        {/* Indicators */}
        <View className="absolute bottom-10 left-0 right-0 flex-row justify-center items-center">
          {onboardingCards.map((_, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const widthAnim = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacityAnim = scrollX.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={{
                  height: 8,
                  width: widthAnim,
                  opacity: opacityAnim,
                  backgroundColor: 'white',
                  borderRadius: 4,
                  marginHorizontal: 4,
                }}
              />
            );
          })}
        </View>
      </View>

      {/* Bottom Sheet - Action Area */}
      <View 
        className="absolute bottom-0 left-0 right-0 pt-8 pb-12 px-6 rounded-t-[32px] shadow-2xl"
        style={{ backgroundColor: colors.background }}
      >
        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-up')}
          className="w-full py-4 rounded-2xl items-center justify-center mb-4 shadow-md transform active:scale-95 transition-transform"
          style={{ backgroundColor: Colors.light.primary }}
        >
          <Text className="text-lg font-bold text-white tracking-wide">Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-in')}
          className="w-full py-4 rounded-2xl items-center justify-center border-2"
          style={{ borderColor: colors.border }}
        >
          <Text className="text-lg font-bold" style={{ color: colors.textPrimary }}>I have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Onboarding;


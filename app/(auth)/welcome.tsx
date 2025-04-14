import { router } from 'expo-router';
import { Text, TouchableOpacity, View, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

interface OnboardingCard {
  title: string;
  description: string;
  icon: string;
}

const onboardingCards: OnboardingCard[] = [
  {
    title: "Welcome to FrictionLess",
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
      outputRange: [0.5, 1, 0.5],
    });

    return (
      <Animated.View
        key={index}
        style={{
          width,
          transform: [{ scale }],
          opacity,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Text className="text-6xl mb-6">{card.icon}</Text>
        <Text className="text-3xl font-bold text-black text-center mb-4">{card.title}</Text>
        <Text className="text-lg text-black text-center">{card.description}</Text>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <StatusBar style="light" />
      <View className="flex-1">
        
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
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

        <View className="absolute bottom-10 left-0 right-0 flex-row justify-center items-center">
          {onboardingCards.map((_, index) => (
            <View
              key={index}
              className={`h-2 w-2 mx-2 rounded-full ${
                currentIndex === index ? 'bg-white w-4' : 'bg-white/50'
              }`}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.replace('./sign-up')}
          className="absolute top-10 right-10 bg-blue-500 py-2 px-4 rounded-full"
        >
          <Text className="text-md font-bold text-white">Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Onboarding;


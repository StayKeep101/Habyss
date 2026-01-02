import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate,
  withSpring,
  useAnimatedGestureHandler
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent, TapGestureHandler, LongPressGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface AIAgentButtonProps {
  onPress: () => void;
  isThinking?: boolean;
  hasNewSuggestion?: boolean;
  isProcessing?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 56;
const MARGIN = 24;

const AIAgentButton: React.FC<AIAgentButtonProps> = ({
  onPress,
  isThinking = false,
  hasNewSuggestion = false,
  isProcessing = false
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { lightFeedback, heavyFeedback } = useHaptics();
  const { playPop } = useSoundEffects();

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Breathing animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    // Glow animation if thinking
    if (isThinking) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = 0.3;
    }
  }, [isThinking]);

  const onPanGestureEvent = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number; startY: number }>({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
    onEnd: () => {
      // Snapping logic
      const rightSnapX = 0;
      const leftSnapX = -(SCREEN_WIDTH - BUTTON_SIZE - MARGIN * 2);
      translateX.value = withSpring(translateX.value > -SCREEN_WIDTH / 2 + BUTTON_SIZE ? rightSnapX : leftSnapX);
      translateY.value = withSpring(translateY.value);
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(scale.value, [1, 1.05], [1, 1.2], Extrapolate.CLAMP) }],
  }));

  const handleLongPress = () => {
    heavyFeedback();
    Alert.alert(
      "🤖 AI Quick Actions",
      "What would you like me to do?",
      [
        { text: "Analyze Progress", onPress: () => console.log("Analyze") },
        { text: "Suggest Habits", onPress: () => console.log("Suggest") },
        { text: "View Insights", onPress: () => console.log("Insights") },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  return (
    <PanGestureHandler onGestureEvent={onPanGestureEvent}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <LongPressGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              handleLongPress();
            }
          }}
          minDurationMs={600}
        >
          <Animated.View>
            <TapGestureHandler
              onActivated={() => {
                playPop();
                lightFeedback();
                onPress();
              }}
            >
              <Animated.View style={styles.touchableArea}>
                <View style={[styles.button, { backgroundColor: colors.primary }]}>
                  <Animated.View
                    style={[
                      styles.glow,
                      { backgroundColor: colors.primary },
                      glowStyle
                    ]}
                  />
                  <View style={styles.iconContainer}>
                    <Ionicons name="sparkles" size={28} color="white" />
                  </View>

                  {hasNewSuggestion && (
                    <View style={[styles.badge, { backgroundColor: '#FF3B30' }]} />
                  )}

                  {isProcessing && (
                    <View style={styles.processingRing} />
                  )}
                </View>
              </Animated.View>
            </TapGestureHandler>
          </Animated.View>
        </LongPressGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: MARGIN + 96, // Moved higher to avoid overlapping with other buttons
    right: MARGIN,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    zIndex: 1000,
  },
  touchableArea: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  glow: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    zIndex: -1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  processingRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 4,
    height: BUTTON_SIZE + 4,
    borderRadius: (BUTTON_SIZE + 4) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderStyle: 'dashed',
  },
});

export default AIAgentButton;

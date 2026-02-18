import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { VoidModal } from '@/components/Layout/VoidModal';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptics } from '@/hooks/useHaptics';
import { useSounds } from '@/hooks/useSounds';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';

const { width } = Dimensions.get('window');

interface StreakSuccessModalProps {
    visible: boolean;
    streak: number;
    onClose: () => void;
}

export const StreakSuccessModal: React.FC<StreakSuccessModalProps> = ({ visible, streak, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { colors: accentColors, primary: accentColor } = useAccentGradient();
    const { successFeedback } = useHaptics();
    const { playComplete } = useSounds(); // Or a more specific celebration sound if available

    // Animations
    const scale = useSharedValue(0);
    const rotation = useSharedValue(0);
    const glowOpacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);

    useEffect(() => {
        if (visible) {
            successFeedback();
            // playComplete(); // Optional: sound effect

            // Reset values
            scale.value = 0;
            rotation.value = 0;
            glowOpacity.value = 0;
            textOpacity.value = 0;
            textTranslateY.value = 20;

            // Animate In
            scale.value = withSpring(1, { damping: 12, stiffness: 90 });

            // Continuous rotation/wiggle for the flame
            rotation.value = withRepeat(
                withSequence(
                    withTiming(-5, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                    withTiming(5, { duration: 1500, easing: Easing.inOut(Easing.quad) })
                ),
                -1,
                true
            );

            // Glow pulse
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.6, { duration: 1000 }),
                    withTiming(0.2, { duration: 1000 })
                ),
                -1,
                true
            );

            // Text entrance
            textOpacity.value = withTiming(1, { duration: 600 });
            textTranslateY.value = withSpring(0);
        }
    }, [visible]);

    const fireStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }]
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: 1.5 }]
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }]
    }));

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.65}>
            <View style={styles.container}>

                {/* Fire Animation Container */}
                <View style={styles.fireContainer}>
                    {/* Glow Effect behind flame */}
                    <Animated.View style={[styles.glow, glowStyle, { backgroundColor: accentColor }]} />

                    {/* Main Flame */}
                    <Animated.View style={[styles.fireWrapper, fireStyle]}>
                        <LinearGradient
                            colors={['#F97316', '#FBBF24', '#EF4444']}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.flameGradient}
                        >
                            <Ionicons name="flame" size={120} color="white" />
                        </LinearGradient>
                    </Animated.View>
                </View>

                {/* Text Content */}
                <Animated.View style={[styles.textContainer, textStyle]}>
                    <Text style={[styles.title, { color: colors.text }]}>STREAK EXTENDED!</Text>

                    <View style={styles.streakRow}>
                        <Text style={[styles.streakNumber, { color: accentColor }]}>{streak}</Text>
                        <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>DAYS</Text>
                    </View>

                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        You're on fire! Keep the momentum going.
                    </Text>
                </Animated.View>

                {/* Continue Button */}
                <TouchableOpacity
                    onPress={onClose}
                    activeOpacity={0.8}
                    style={[styles.button, { backgroundColor: accentColor }]}
                >
                    <Text style={[styles.buttonText, { color: '#fff' }]}>CONTINUE</Text>
                </TouchableOpacity>

            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40
    },
    fireContainer: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 40
    },
    glow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        opacity: 0.4,
        filter: 'blur(20px)', // Helps if engine supports it, else opacity does the job mostly
    },
    fireWrapper: {
        shadowColor: "#F97316",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    flameGradient: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 40
    },
    title: {
        fontSize: 24,
        fontFamily: 'Lexend',
        fontWeight: '900',
        marginBottom: 16,
        letterSpacing: 1,
        textAlign: 'center'
    },
    streakRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
        gap: 8
    },
    streakNumber: {
        fontSize: 64,
        fontFamily: 'Lexend',
        fontWeight: '900',
        lineHeight: 70
    },
    streakLabel: {
        fontSize: 18,
        fontFamily: 'Lexend_400Regular',
        fontWeight: '600',
        letterSpacing: 1
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        opacity: 0.8,
        lineHeight: 20,
        maxWidth: '80%'
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: 'bold',
        letterSpacing: 1
    }
});

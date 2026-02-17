import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Messages to display during "analysis"
const ANALYSIS_STEPS = [
    "Analyzing your habit patterns...",
    "Identifying key struggle points...",
    "Calibrating motivation engine...",
    "Designing your personalized plan...",
    "Finalizing your Habyss experience..."
];

export const AnalyzingScreen = ({ onComplete }: { onComplete: () => void }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const router = useRouter();
    const progress = useSharedValue(0);
    const [currentStep, setCurrentStep] = React.useState(0);

    useEffect(() => {
        // Animate progress bar to 100% over 5 seconds
        progress.value = withTiming(100, { duration: 5000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });

        // Cycle through text steps
        const stepInterval = setInterval(() => {
            setCurrentStep(prev => {
                if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
                return prev;
            });
        }, 1000);

        // Complete after 5.5s
        const completeTimeout = setTimeout(() => {
            onComplete();
        }, 5500);

        return () => {
            clearInterval(stepInterval);
            clearTimeout(completeTimeout);
        };
    }, []);

    const animatedProgressStyle = useAnimatedStyle(() => {
        return {
            width: `${progress.value}%`,
        };
    });

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000000', '#1A1A1A']}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.content}>
                {/* Spinning Icon */}
                <Animated.View
                    style={styles.iconContainer}
                    entering={FadeInDown.duration(800)}
                >
                    <Ionicons name="sparkles" size={64} color={colors.primary} />
                    <Animated.View style={[styles.pulseRing, { borderColor: colors.primary }]} />
                </Animated.View>

                {/* Text Updates */}
                <Animated.Text
                    key={currentStep}
                    entering={FadeInDown.springify()}
                    style={[styles.stepText, { color: colors.text }]}
                >
                    {ANALYSIS_STEPS[currentStep]}
                </Animated.Text>

                {/* Progress Bar */}
                <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            animatedProgressStyle,
                            { backgroundColor: colors.primary }
                        ]}
                    />
                </View>

                <Text style={[styles.percentage, { color: colors.textSecondary }]}>
                    {Math.round((currentStep + 1) / ANALYSIS_STEPS.length * 100)}%
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
    },
    iconContainer: {
        marginBottom: 48,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: 120,
        height: 120,
    },
    pulseRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        opacity: 0.5,
    },
    stepText: {
        fontSize: 20,
        fontFamily: 'Lexend_600SemiBold',
        textAlign: 'center',
        marginBottom: 32,
        height: 60, // Fixed height to prevent jumping
    },
    progressTrack: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },
    percentage: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
});

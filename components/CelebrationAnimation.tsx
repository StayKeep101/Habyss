import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDelay,
    Easing,
    runOnJS,
    cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';

const { width, height } = Dimensions.get('window');

interface CelebrationProps {
    visible: boolean;
    onComplete: () => void;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    color: string;
    emoji: string;
    delay: number;
    rotation: number;
}

const EMOJIS = ['⭐', '🎉', '✨', '💪', '🔥', '🚀', '💯', '🎯'];
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899'];

const CelebrationParticle: React.FC<{ particle: Particle }> = ({ particle }) => {
    const translateY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const rotate = useSharedValue(0);

    useEffect(() => {
        translateY.value = withDelay(
            particle.delay,
            withTiming(-height * 0.5 - Math.random() * 200, {
                duration: 1500 + Math.random() * 500,
                easing: Easing.out(Easing.quad),
            })
        );
        translateX.value = withDelay(
            particle.delay,
            withTiming((Math.random() - 0.5) * 200, {
                duration: 1500,
                easing: Easing.out(Easing.quad),
            })
        );
        scale.value = withDelay(
            particle.delay,
            withSpring(1, { damping: 10, stiffness: 100 })
        );
        opacity.value = withDelay(
            particle.delay,
            withTiming(1, { duration: 200 })
        );
        opacity.value = withDelay(
            particle.delay + 1000,
            withTiming(0, { duration: 500 })
        );
        rotate.value = withDelay(
            particle.delay,
            withTiming(particle.rotation, { duration: 1500 })
        );
        return () => {
            cancelAnimation(translateY);
            cancelAnimation(translateX);
            cancelAnimation(scale);
            cancelAnimation(opacity);
            cancelAnimation(rotate);
        };
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
            { scale: scale.value },
            { rotate: `${rotate.value}deg` },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.particle,
                { left: particle.x, top: particle.y },
                style,
            ]}
        >
            <Animated.Text style={styles.emoji}>{particle.emoji}</Animated.Text>
        </Animated.View>
    );
};

export const CelebrationAnimation: React.FC<CelebrationProps> = ({ visible, onComplete }) => {
    const mainScale = useSharedValue(0);
    const mainOpacity = useSharedValue(0);
    const checkScale = useSharedValue(0);
    const ringScale = useSharedValue(0.5);
    const ringOpacity = useSharedValue(0);
    const { successFeedback } = useHaptics();

    const particles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: width / 2 + (Math.random() - 0.5) * 150,
        y: height / 2 + (Math.random() - 0.5) * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        delay: Math.random() * 300,
        rotation: (Math.random() - 0.5) * 720,
    }));

    useEffect(() => {
        if (visible) {
            successFeedback();

            // Main container animation
            mainScale.value = withSpring(1, { damping: 12, stiffness: 100 });
            mainOpacity.value = withTiming(1, { duration: 200 });

            // Checkmark animation
            checkScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 150 }));

            // Ring pulse
            ringScale.value = withSpring(1.2, { damping: 10 });
            ringOpacity.value = withTiming(0.5, { duration: 200 });
            ringScale.value = withDelay(200, withSpring(1.5, { damping: 5 }));
            ringOpacity.value = withDelay(200, withTiming(0, { duration: 400 }));

            // Auto-hide after animation
            setTimeout(() => {
                mainOpacity.value = withTiming(0, { duration: 300 }, () => {
                    runOnJS(onComplete)();
                });
            }, 1800);
        } else {
            mainScale.value = 0;
            mainOpacity.value = 0;
            checkScale.value = 0;
        }
    }, [visible]);

    const mainStyle = useAnimatedStyle(() => ({
        transform: [{ scale: mainScale.value }],
        opacity: mainOpacity.value,
    }));

    const checkStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            {/* Particles */}
            {particles.map((particle) => (
                <CelebrationParticle key={particle.id} particle={particle} />
            ))}

            {/* Center celebration */}
            <Animated.View style={[styles.centerContainer, mainStyle]}>
                {/* Pulse ring */}
                <Animated.View style={[styles.ring, ringStyle]} />

                {/* Checkmark */}
                <Animated.View style={[styles.checkContainer, checkStyle]}>
                    <Ionicons name="checkmark" size={48} color="#fff" />
                </Animated.View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 1000,
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    ring: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#10B981',
    },
    particle: {
        position: 'absolute',
    },
    emoji: {
        fontSize: 24,
    },
});

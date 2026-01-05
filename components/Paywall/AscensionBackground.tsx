import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    Easing,
    interpolate
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export const AscensionBackground = () => {
    // Shared values for animation deep space effect
    const shift = useSharedValue(0);
    const pulse = useSharedValue(0);

    useEffect(() => {
        shift.value = withRepeat(
            withTiming(1, { duration: 15000, easing: Easing.linear }),
            -1,
            true
        );
        pulse.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateY = interpolate(shift.value, [0, 1], [-50, 50]);
        const scale = interpolate(pulse.value, [0, 1], [1, 1.1]);

        return {
            transform: [{ translateY }, { scale }]
        };
    });

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Deep Void Base */}
            <LinearGradient
                colors={['#000000', '#0F0518', '#1A0B2E']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Nebula Pulse */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['transparent', 'rgba(107, 70, 193, 0.15)', 'rgba(59, 130, 246, 0.1)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            {/* Simulated Stars (Static for performance, could be randomized views) */}
            {[...Array(20)].map((_, i) => (
                <Star key={i} index={i} />
            ))}
        </View>
    );
};

const Star = ({ index }: { index: number }) => {
    const opacity = useSharedValue(0.2 + Math.random() * 0.5);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(1, { duration: 2000 + Math.random() * 3000 }),
            -1,
            true
        );
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const size = Math.random() * 2 + 1;
    const top = Math.random() * height;
    const left = Math.random() * width;

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    top,
                    left,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: '#FFF',
                    shadowColor: '#FFF',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 4,
                },
                style
            ]}
        />
    );
};

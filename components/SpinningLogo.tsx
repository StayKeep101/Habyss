import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation
} from 'react-native-reanimated';

interface SpinningLogoProps {
    className?: string;
    size?: number;
    glow?: boolean;
}

export const SpinningLogo: React.FC<SpinningLogoProps> = ({ size = 80, glow = false }) => {
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, {
                duration: 2600,
                easing: Easing.inOut(Easing.ease),
            }),
            -1, // Infinite repeat
            false // Do not reverse
        );

        scale.value = withRepeat(
            withTiming(1.08, {
                duration: 1300,
                easing: Easing.inOut(Easing.quad),
            }),
            -1,
            true
        );

        return () => {
            cancelAnimation(rotation);
            cancelAnimation(scale);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
        };
    });

    return (
        <View style={styles.container}>
            {glow ? <View style={[styles.glow, { width: size * 1.65, height: size * 1.65, borderRadius: size }]} /> : null}
            <Animated.View style={[animatedStyle, styles.imageContainer, { width: size, height: size }]}>
                <Image
                    source={require('@/assets/images/Habyss Logo.png')}
                    style={styles.image}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    glow: {
        position: 'absolute',
        backgroundColor: 'rgba(95, 150, 220, 0.18)',
        shadowColor: '#8BADD6',
        shadowOpacity: 0.45,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 0 },
    },
    image: {
        width: '100%',
        height: '100%',
    }
});

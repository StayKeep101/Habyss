import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, withRepeat, withTiming, Easing, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface GenesisIntroProps {
    onComplete: () => void;
}

const { width } = Dimensions.get('window');

export const GenesisIntro: React.FC<GenesisIntroProps> = ({ onComplete }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const pulse = useSharedValue(1);

    // Stages: 0 = "Descend...", 1 = "...Rise", 2 = "Logo", 3 = Complete
    const [stage, setStage] = useState(0);

    useEffect(() => {
        // Timeline
        pulse.value = withRepeat(withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
        const t1 = setTimeout(() => setStage(1), 2200);
        const t2 = setTimeout(() => setStage(2), 4700);
        const t3 = setTimeout(() => {
            setStage(3);
            onComplete();
        }, 7200);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    if (stage === 3) return null;

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            {stage === 0 && (
                <Animated.View
                    entering={FadeIn.duration(1500)}
                    exiting={FadeOut.duration(1000)}
                    style={styles.center}
                >
                    <Text style={styles.textMain}>Build your private system</Text>
                </Animated.View>
            )}

            {stage === 1 && (
                <Animated.View
                    entering={FadeIn.duration(2000)}
                    exiting={FadeOut.duration(1000)}
                    style={styles.center}
                >
                    <Text style={styles.textMain}>...and train it daily.</Text>
                </Animated.View>
            )}

            {stage === 2 && (
                <Animated.View
                    entering={ZoomIn.duration(1500).damping(12)}
                    exiting={FadeOut.duration(800)}
                    style={styles.center}
                >
                    <Animated.View style={pulseStyle}>
                        <Image
                            source={require('@/assets/images/Habyss Logo.png')}
                            style={{ width: 120, height: 120, marginBottom: 24 }}
                            resizeMode="contain"
                        />
                    </Animated.View>
                    <Text style={styles.brandText}>HABYSS</Text>
                    <Text style={styles.brandSubtext}>Local-first focus, owned by you</Text>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    textMain: {
        color: '#fff',
        fontSize: 30,
        fontWeight: '200',
        letterSpacing: 2,
        textAlign: 'center',
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
    logoBox: {
        width: 80,
        height: 80,
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    logoInner: {
        width: 40,
        height: 40,
        backgroundColor: '#fff',
        opacity: 0.8,
    },
    brandText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 8,
        fontFamily: 'Lexend',
    },
    brandSubtext: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.72)',
        fontSize: 12,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface GenesisIntroProps {
    onComplete: () => void;
}

const { width } = Dimensions.get('window');

export const GenesisIntro: React.FC<GenesisIntroProps> = ({ onComplete }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Stages: 0 = "Descend...", 1 = "...Rise", 2 = "Logo", 3 = Complete
    const [stage, setStage] = useState(0);

    useEffect(() => {
        // Timeline
        const t1 = setTimeout(() => setStage(1), 3000); // Show second part
        const t2 = setTimeout(() => setStage(2), 6500); // Show logo/final
        const t3 = setTimeout(() => {
            setStage(3);
            onComplete();
        }, 9000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    if (stage === 3) return null;

    return (
        <View style={[styles.container, { backgroundColor: '#000' }]}>
            {stage === 0 && (
                <Animated.View
                    entering={FadeIn.duration(1500)}
                    exiting={FadeOut.duration(1000)}
                    style={styles.center}
                >
                    <Text style={styles.textMain}>Descend into discipline</Text>
                </Animated.View>
            )}

            {stage === 1 && (
                <Animated.View
                    entering={FadeIn.duration(2000)}
                    exiting={FadeOut.duration(1000)}
                    style={styles.center}
                >
                    <Text style={styles.textMain}>...rise through time.</Text>
                </Animated.View>
            )}

            {stage === 2 && (
                <Animated.View
                    entering={ZoomIn.duration(1500).damping(12)}
                    exiting={FadeOut.duration(800)}
                    style={styles.center}
                >
                    {/* Simplified geometric logo representation for the intro */}
                    <View style={styles.logoBox}>
                        <View style={styles.logoInner} />
                    </View>
                    <Text style={styles.brandText}>HABYSS</Text>
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
        fontSize: 32,
        fontWeight: '200',
        letterSpacing: 2,
        textAlign: 'center',
        textTransform: 'uppercase',
        fontFamily: 'System', // Use default lightweight system font
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
    }
});

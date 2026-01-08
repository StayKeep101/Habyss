import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import Animated, { FadeInDown, FadeOut, useSharedValue, withSpring, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Master Your Void',
        desc: 'Build habits that withstand the entropy of life.',
        icon: 'planet'
    },
    {
        id: '2',
        title: 'Architect Reality',
        desc: 'Design your days with precision and purpose.',
        icon: 'construct'
    },
    {
        id: '3',
        title: 'Ascend Together',
        desc: 'Join a community of disciplined minds.',
        icon: 'infinite'
    }
];

interface GenesisCarouselProps {
    onFinish: () => void;
    onLogin: () => void;
}

export const GenesisCarousel: React.FC<GenesisCarouselProps> = ({ onFinish, onLogin }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const { lightFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];

    const handleNext = () => {
        lightFeedback();
        if (currentSlide < SLIDES.length - 1) {
            setCurrentSlide(prev => prev + 1);
        } else {
            onFinish();
        }
    };

    return (
        <View style={styles.container}>
            {/* Slide Content */}
            <View style={styles.slideContainer}>
                {SLIDES.map((slide, index) => {
                    if (index !== currentSlide) return null;
                    return (
                        <Animated.View
                            key={slide.id}
                            entering={FadeInDown.springify().damping(12)}
                            exiting={FadeOut.duration(200)}
                            style={styles.slideContent}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', shadowColor: colors.textPrimary }]}>
                                <Ionicons name={slide.icon as any} size={80} color={colors.textPrimary} />
                            </View>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{slide.title}</Text>
                            <Text style={[styles.desc, { color: colors.textSecondary }]}>{slide.desc}</Text>
                        </Animated.View>
                    );
                })}
            </View>

            {/* Pagination Dots */}
            <View style={styles.pagination}>
                {SLIDES.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            { backgroundColor: index === currentSlide ? colors.textPrimary : colors.textTertiary, width: index === currentSlide ? 24 : 8 }
                        ]}
                    />
                ))}
            </View>

            {/* Actions */}
            <View style={styles.footer}>
                <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
                    <BlurView intensity={20} style={[styles.primaryBtn, { borderColor: colors.border, backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}>
                        <Text style={[styles.primaryBtnText, { color: colors.textPrimary }]}>
                            {currentSlide === SLIDES.length - 1 ? 'BEGIN JOURNEY' : 'CONTINUE'}
                        </Text>
                    </BlurView>
                </TouchableOpacity>

                <TouchableOpacity onPress={onLogin} style={styles.secondaryBtn}>
                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>I already have an account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 60,
    },
    slideContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    slideContent: {
        alignItems: 'center',
        width: '100%',
    },
    iconContainer: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    desc: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        fontFamily: 'Lexend_400Regular',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 40,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    footer: {
        paddingHorizontal: 30,
        gap: 20,
    },
    primaryBtn: {
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 2,
        fontFamily: 'Lexend',
    },
    secondaryBtn: {
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    }
});

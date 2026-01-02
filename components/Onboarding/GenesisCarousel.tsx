import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import Animated, { FadeInDown, FadeOut, useSharedValue, withSpring, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

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

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                            <View style={styles.iconContainer}>
                                <Ionicons name={slide.icon as any} size={80} color="#fff" />
                            </View>
                            <Text style={styles.title}>{slide.title}</Text>
                            <Text style={styles.desc}>{slide.desc}</Text>
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
                            { backgroundColor: index === currentSlide ? '#fff' : 'rgba(255,255,255,0.2)', width: index === currentSlide ? 24 : 8 }
                        ]}
                    />
                ))}
            </View>

            {/* Actions */}
            <View style={styles.footer}>
                <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
                    <BlurView intensity={20} style={styles.primaryBtn}>
                        <Text style={styles.primaryBtnText}>
                            {currentSlide === SLIDES.length - 1 ? 'BEGIN JOURNEY' : 'CONTINUE'}
                        </Text>
                    </BlurView>
                </TouchableOpacity>

                <TouchableOpacity onPress={onLogin} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>I already have an account</Text>
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: 'white',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 1,
    },
    desc: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24,
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
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    primaryBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    secondaryBtn: {
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
    }
});

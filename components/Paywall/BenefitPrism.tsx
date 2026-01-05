import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const BENEFITS = [
    {
        id: 'ai',
        icon: 'sparkles',
        title: 'Cosmic Wisdom',
        desc: 'Unlimited AI coaching & personalized insights.',
        color: '#8B5CF6'
    },
    {
        id: 'analytics',
        icon: 'analytics',
        title: 'Quantified Self',
        desc: 'Deep analytics, heatmaps & trend predictions.',
        color: '#3B82F6'
    },
    {
        id: 'void',
        icon: 'infinite',
        title: 'Unlimited Potential',
        desc: 'Infinite habits, goals, and categories.',
        color: '#10B981'
    },
    {
        id: 'sync',
        icon: 'cloud-upload',
        title: 'Universal Sync',
        desc: 'Seamlessly sync across all your devices.',
        color: '#F59E0B'
    },
    {
        id: 'export',
        icon: 'download',
        title: 'Data Sovereignty',
        desc: 'Export your data anytime. You own your story.',
        color: '#EC4899'
    }
];

export const BenefitPrism = () => {
    return (
        <View style={styles.container}>
            {BENEFITS.map((item, index) => (
                <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(index * 200 + 300).springify()}
                    style={styles.cardWrapper}
                >
                    <BlurView intensity={20} tint="light" style={styles.blurContainer}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
                            style={styles.cardGradient}
                        >
                            <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                                <Ionicons name={item.icon as any} size={24} color={item.color} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.title}>{item.title}</Text>
                                <Text style={styles.desc}>{item.desc}</Text>
                            </View>
                        </LinearGradient>
                    </BlurView>
                </Animated.View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
        paddingHorizontal: 24,
    },
    cardWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    blurContainer: {
        backgroundColor: 'rgba(20, 20, 30, 0.4)',
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Lexend',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    desc: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'Lexend_400Regular',
    },
});

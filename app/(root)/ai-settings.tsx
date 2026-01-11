import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings, GreetingStyle } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

// Greeting style options
const GREETING_STYLES: { id: GreetingStyle; label: string; icon: string; description: string }[] = [
    { id: 'ai', label: 'AI Personality', icon: 'sparkles', description: 'Based on selected personality' },
    { id: 'quotes', label: 'Motivational', icon: 'bulb', description: 'Inspiring quotes' },
    { id: 'data', label: 'Data Driven', icon: 'analytics', description: 'Your stats & insights' },
    { id: 'all', label: 'Mixed', icon: 'shuffle', description: 'Random combination' },
];

const AISettings = () => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const { mediumFeedback, selectionFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle } = useAppSettings();

    const handleSelectPersonality = (id: PersonalityModeId) => {
        mediumFeedback();
        const mode = PERSONALITY_MODES.find(m => m.id === id);
        if (mode?.warning) {
            Alert.alert('⚠️ Warning', mode.warning, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'I understand', onPress: () => setAIPersonality(id) }
            ]);
        } else {
            setAIPersonality(id);
        }
    };

    const handleSelectGreeting = (style: GreetingStyle) => {
        selectionFeedback();
        setGreetingStyle(style);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>AI Configuration</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* AI Personality Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AI PERSONALITY</Text>
                    <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>
                        Choose how the AI communicates with you
                    </Text>

                    {/* 2x2 Grid for Personalities */}
                    <View style={styles.personalityGrid}>
                        {PERSONALITY_MODES.map((mode) => {
                            const isSelected = aiPersonality === mode.id;

                            return (
                                <TouchableOpacity
                                    key={mode.id}
                                    style={[
                                        styles.personalityCard,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: isSelected ? colors.success : colors.border,
                                            borderWidth: isSelected ? 2 : 1,
                                            width: CARD_WIDTH,
                                        }
                                    ]}
                                    onPress={() => handleSelectPersonality(mode.id)}
                                    activeOpacity={0.7}
                                >
                                    {/* Icon and check */}
                                    <View style={styles.cardTopRow}>
                                        <Text style={styles.emoji}>{mode.icon}</Text>
                                        {isSelected && (
                                            <View style={[styles.checkBadge, { backgroundColor: colors.success }]}>
                                                <Ionicons name="checkmark" size={10} color="#fff" />
                                            </View>
                                        )}
                                    </View>

                                    {/* Name */}
                                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{mode.name}</Text>

                                    {/* Short description */}
                                    <Text style={[styles.cardDesc, { color: colors.textTertiary }]} numberOfLines={3}>
                                        {mode.description}
                                    </Text>

                                    {/* Warning indicator */}
                                    {mode.warning && (
                                        <View style={styles.warningDot}>
                                            <Ionicons name="warning" size={10} color="#F59E0B" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Greeting Style Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>
                        DASHBOARD GREETING
                    </Text>
                    <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>
                        What type of greeting to show on your dashboard
                    </Text>

                    {/* Greeting Style Grid */}
                    <View style={styles.greetingGrid}>
                        {GREETING_STYLES.map((style) => {
                            const isSelected = greetingStyle === style.id;

                            return (
                                <TouchableOpacity
                                    key={style.id}
                                    style={[
                                        styles.greetingCard,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: isSelected ? colors.primary : colors.border,
                                            borderWidth: isSelected ? 2 : 1,
                                        }
                                    ]}
                                    onPress={() => handleSelectGreeting(style.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.greetingIcon, { backgroundColor: isSelected ? colors.primary + '20' : colors.surfaceSecondary }]}>
                                        <Ionicons name={style.icon as any} size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                                    </View>
                                    <Text style={[styles.greetingLabel, { color: isSelected ? colors.primary : colors.textPrimary }]}>
                                        {style.label}
                                    </Text>
                                    <Text style={[styles.greetingDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                                        {style.description}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    sectionDesc: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 16,
    },
    // 2x2 Grid for personalities
    personalityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    personalityCard: {
        borderRadius: 16,
        padding: 14,
        minHeight: 110,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    emoji: { fontSize: 24 },
    checkBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        lineHeight: 14,
    },
    warningDot: {
        position: 'absolute',
        bottom: 10,
        right: 10,
    },
    // Greeting style cards
    greetingGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    greetingCard: {
        borderRadius: 12,
        padding: 12,
        width: (width - 48) / 2 - 5,
        alignItems: 'center',
    },
    greetingIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    greetingLabel: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Lexend',
        marginBottom: 2,
    },
    greetingDesc: {
        fontSize: 9,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
    },
});

export default AISettings;

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { router } from 'expo-router';

export default function AIConfigScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback, mediumFeedback, lightFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle } = useAppSettings();
    const { isPremium } = usePremiumStatus();
    const { primary: accentColor } = useAccentGradient();

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
                    {/* Personality Selection */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PERSONALITY MODE</Text>
                    </View>

                    <View style={styles.grid}>
                        {PERSONALITY_MODES.map((mode) => {
                            const isActive = aiPersonality === mode.id;
                            const isLocked = mode.premiumOnly && !isPremium;

                            return (
                                <TouchableOpacity
                                    key={mode.id}
                                    onPress={() => {
                                        if (isLocked) {
                                            Alert.alert("Premium Feature", "Upgrade to Pro to unlock this personality.");
                                            return;
                                        }
                                        handleSelectPersonality(mode.id as PersonalityModeId);
                                    }}
                                    activeOpacity={0.8}
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor: isActive
                                                ? (isLight ? accentColor + '15' : accentColor + '20')
                                                : (colors.surface),
                                            borderColor: isActive ? accentColor : colors.border,
                                            borderWidth: 1
                                        }
                                    ]}
                                >
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.iconBox, { backgroundColor: isActive ? accentColor : (isLight ? '#fff' : 'rgba(255,255,255,0.05)') }]}>
                                            <Ionicons name={mode.icon as any} size={18} color={isActive ? '#fff' : colors.textPrimary} />
                                        </View>
                                        {isLocked && <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />}
                                    </View>

                                    <Text style={[styles.modeName, { color: colors.textPrimary }]}>{mode.name}</Text>
                                    <Text style={[styles.modeDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                                        {mode.description}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Greeting Style */}
                    <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GREETING STYLE</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        {[
                            { id: 'brief', label: 'Brief', icon: 'flash' },
                            { id: 'warm', label: 'Warm', icon: 'sunny' },
                            { id: 'random', label: 'Random', icon: 'shuffle' }
                        ].map((style) => (
                            <TouchableOpacity
                                key={style.id}
                                onPress={() => { lightFeedback(); setGreetingStyle(style.id as any); }}
                                style={[
                                    styles.greetingChip,
                                    {
                                        backgroundColor: greetingStyle === style.id
                                            ? (isLight ? accentColor + '15' : accentColor + '20')
                                            : (colors.surface),
                                        borderColor: greetingStyle === style.id ? accentColor : colors.border,
                                        borderWidth: 1
                                    }
                                ]}
                            >
                                <Ionicons name={style.icon as any} size={14} color={greetingStyle === style.id ? accentColor : colors.textSecondary} />
                                <Text style={[styles.greetingLabel, { color: greetingStyle === style.id ? accentColor : colors.textSecondary }]}>
                                    {style.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        fontFamily: 'Lexend_700Bold',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    card: {
        width: '48%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeName: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    modeDesc: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        opacity: 0.8,
        lineHeight: 18,
    },
    greetingChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderRadius: 12,
    },
    greetingLabel: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});

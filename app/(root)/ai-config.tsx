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

                    <View style={styles.list}>
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
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: isActive, disabled: isLocked }}
                                    style={[
                                        styles.row,
                                        {
                                            backgroundColor: isActive
                                                ? (isLight ? accentColor + '15' : accentColor + '20')
                                                : colors.surface,
                                            borderColor: isActive ? accentColor : colors.border,
                                            opacity: isLocked ? 0.6 : 1,
                                        },
                                    ]}
                                >
                                    <View style={[styles.emojiBox, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                        {/* These are emoji, not Ionicons glyphs. */}
                                        <Text style={styles.emoji}>{mode.icon}</Text>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <View style={styles.rowTitleLine}>
                                            <Text style={[styles.modeName, { color: colors.textPrimary }]}>{mode.name}</Text>
                                            {isLocked ? <Ionicons name="lock-closed" size={12} color={colors.textTertiary} /> : null}
                                        </View>
                                        {isActive ? (
                                            <Text style={[styles.modeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                                                {mode.description}
                                            </Text>
                                        ) : null}
                                    </View>

                                    <Ionicons
                                        name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={20}
                                        color={isActive ? accentColor : colors.textTertiary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

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
    list: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    rowTitleLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    emojiBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: 20,
    },
    modeName: {
        fontSize: 15,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    modeDesc: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        opacity: 0.85,
        lineHeight: 17,
        marginTop: 3,
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

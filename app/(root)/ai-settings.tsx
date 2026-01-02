import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { useAIPersonality } from '@/constants/AIPersonalityContext';
import { PERSONALITY_MODES, PersonalityMode, PersonalityModeId } from '@/constants/AIPersonalities';
import { useSoundEffects } from '@/hooks/useSoundEffects';

const AISettings = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, mediumFeedback, heavyFeedback } = useHaptics();
    const { personalityId, setPersonalityId } = useAIPersonality();
    const { playClick } = useSoundEffects();

    const [expandedMode, setExpandedMode] = useState<string | null>(null);

    const handleSelectMode = async (mode: PersonalityMode) => {
        playClick();

        if (mode.id === personalityId) return;

        if (mode.id === 'bully_mode') {
            heavyFeedback();
            Alert.alert(
                "⚠️ Warning: Bully Mode",
                mode.warning || "This mode uses harsh language.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Enable Bully Mode",
                        style: "destructive",
                        onPress: () => {
                            setPersonalityId(mode.id);
                            mediumFeedback();
                        }
                    }
                ]
            );
        } else {
            lightFeedback();
            setPersonalityId(mode.id);
        }
    };

    const toggleExpand = (id: string) => {
        lightFeedback();
        setExpandedMode(expandedMode === id ? null : id);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Personality</Text>
                <TouchableOpacity style={styles.infoButton}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.introContainer}>
                    <Text style={[styles.introText, { color: colors.textSecondary }]}>
                        Choose how your AI assistant communicates with you. From supportive best friend to tough drill sergeant.
                    </Text>
                </View>

                <View style={styles.cardsContainer}>
                    {PERSONALITY_MODES.map((mode) => {
                        const isSelected = personalityId === mode.id;
                        const isExpanded = expandedMode === mode.id;

                        return (
                            <TouchableOpacity
                                key={mode.id}
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: isSelected ? colors.primary : 'transparent',
                                        borderWidth: 2
                                    }
                                ]}
                                activeOpacity={0.9}
                                onPress={() => toggleExpand(mode.id)}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardHeaderLeft}>
                                        <Text style={styles.modeIcon}>{mode.icon}</Text>
                                        <View>
                                            <Text style={[styles.modeName, { color: colors.textPrimary }]}>{mode.name}</Text>
                                            <Text style={[styles.modeDescShort, { color: colors.textSecondary }]}>
                                                {mode.description}
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.radioButton,
                                            { borderColor: isSelected ? colors.primary : colors.textTertiary }
                                        ]}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleSelectMode(mode);
                                        }}
                                    >
                                        {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                                    </TouchableOpacity>
                                </View>

                                {isExpanded && (
                                    <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>

                                        {/* Examples */}
                                        <View style={styles.exampleSection}>
                                            <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>Success:</Text>
                                            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>"{mode.examples.success}"</Text>
                                        </View>

                                        <View style={styles.exampleSection}>
                                            <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>Setback:</Text>
                                            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>"{mode.examples.failure}"</Text>
                                        </View>

                                        {/* Attributes Graph (Simple Bars) */}
                                        <View style={styles.attributesContainer}>
                                            <View style={styles.attributeRow}>
                                                <Text style={[styles.attrLabel, { color: colors.textTertiary }]}>Warmth</Text>
                                                <View style={styles.attrBarBg}>
                                                    <View style={[styles.attrBarFill, { width: `${mode.attributes.warmth}%`, backgroundColor: colors.primary }]} />
                                                </View>
                                            </View>
                                            <View style={styles.attributeRow}>
                                                <Text style={[styles.attrLabel, { color: colors.textTertiary }]}>Toughness</Text>
                                                <View style={styles.attrBarBg}>
                                                    <View style={[styles.attrBarFill, { width: `${mode.attributes.toughness}%`, backgroundColor: '#FF3B30' }]} />
                                                </View>
                                            </View>
                                        </View>

                                        {/* Activate Button */}
                                        {!isSelected && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.activateButton,
                                                    { backgroundColor: mode.id === 'bully_mode' ? '#FF3B30' : colors.primary }
                                                ]}
                                                onPress={() => handleSelectMode(mode)}
                                            >
                                                <Text style={styles.activateButtonText}>
                                                    {mode.id === 'bully_mode' ? 'Enable (If You Dare)' : 'Select Mode'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    infoButton: {
        padding: 8,
        marginRight: -8,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    introContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    introText: {
        fontSize: 16,
        lineHeight: 24,
    },
    cardsContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 16,
    },
    modeIcon: {
        fontSize: 32,
        marginRight: 16,
    },
    modeName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    modeDescShort: {
        fontSize: 13,
        lineHeight: 18,
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    expandedContent: {
        borderTopWidth: 1,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    exampleSection: {
        marginBottom: 12,
    },
    exampleLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    exampleText: {
        fontSize: 14,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    attributesContainer: {
        marginTop: 16,
        marginBottom: 20,
        gap: 8,
    },
    attributeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    attrLabel: {
        width: 80,
        fontSize: 12,
        fontWeight: '500',
    },
    attrBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    attrBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    activateButton: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    activateButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AISettings;

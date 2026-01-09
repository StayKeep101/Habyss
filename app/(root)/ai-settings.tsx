import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';

const AISettings = () => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const { mediumFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality } = useAppSettings();

    const handleSelect = (id: PersonalityModeId) => {
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
                    {PERSONALITY_MODES.map((mode) => {
                        const isSelected = aiPersonality === mode.id;

                        return (
                            <TouchableOpacity
                                key={mode.id}
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: isSelected ? colors.success : colors.border,
                                        borderWidth: isSelected ? 2 : 1,
                                    }
                                ]}
                                onPress={() => handleSelect(mode.id)}
                                activeOpacity={0.7}
                            >
                                {/* Header Row */}
                                <View style={styles.cardHeader}>
                                    <Text style={styles.emoji}>{mode.icon}</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{mode.name}</Text>
                                        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{mode.description}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={[styles.checkBadge, { backgroundColor: colors.success }]}>
                                            <Ionicons name="checkmark" size={14} color="#fff" />
                                        </View>
                                    )}
                                </View>

                                {/* Attribute Bars */}
                                <View style={styles.attributes}>
                                    {Object.entries(mode.attributes).map(([key, value]) => (
                                        <View key={key} style={styles.attrRow}>
                                            <Text style={[styles.attrLabel, { color: colors.textTertiary }]}>
                                                {key.charAt(0).toUpperCase() + key.slice(1)}
                                            </Text>
                                            <View style={[styles.attrBar, { backgroundColor: colors.surfaceSecondary }]}>
                                                <View
                                                    style={[
                                                        styles.attrFill,
                                                        {
                                                            width: `${value}%`,
                                                            backgroundColor: isSelected ? colors.success : colors.textTertiary
                                                        }
                                                    ]}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {mode.warning && (
                                    <View style={[styles.warning, { backgroundColor: '#F59E0B20' }]}>
                                        <Ionicons name="warning" size={12} color="#F59E0B" />
                                        <Text style={styles.warningText}>Contains harsh language</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
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
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    emoji: { fontSize: 28 },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    cardDesc: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    checkBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    attributes: { gap: 6 },
    attrRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    attrLabel: {
        width: 70,
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'capitalize',
    },
    attrBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    attrFill: {
        height: '100%',
        borderRadius: 2,
    },
    warning: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        marginTop: 12,
        gap: 6,
    },
    warningText: {
        fontSize: 10,
        color: '#F59E0B',
        fontFamily: 'Lexend_400Regular',
    },
});

export default AISettings;

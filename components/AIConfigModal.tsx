import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { useAccentGradient } from '@/constants/AccentContext';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { height } = Dimensions.get('window');

interface AIConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

export const AIConfigModal: React.FC<AIConfigModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle } = useAppSettings();
    const { isPremium } = usePremiumStatus();

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

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <Animated.View
                    entering={SlideInDown.springify().damping(18).stiffness(120)}
                    exiting={SlideOutDown.duration(200)}
                    style={[
                        styles.sheet,
                        { backgroundColor: isLight ? '#ffffff' : '#0f1218' }
                    ]}
                >
                    {/* Border overlay */}
                    <View style={[styles.borderOverlay, { borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(139, 92, 246, 0.2)' }]} />

                    {/* Handle */}
                    <View style={styles.handleContainer}>
                        <View style={[styles.handle, { backgroundColor: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Ionicons name="sparkles" size={24} color={colors.primary} />
                        <Text style={[styles.title, { color: colors.textPrimary }]}>AI Configuration</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Home Greeting Section */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>HOME GREETING</Text>
                            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                                Choose how your AI greets you on the home screen
                            </Text>

                            <View style={styles.greetingOptions}>
                                <TouchableOpacity
                                    style={[
                                        styles.greetingOption,
                                        {
                                            backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.05)',
                                            borderColor: greetingStyle === 'ai' ? colors.primary : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'),
                                            borderWidth: greetingStyle === 'ai' ? 2 : 1,
                                        }
                                    ]}
                                    onPress={() => {
                                        if (!isPremium) {
                                            Alert.alert('Pro Feature', 'AI-powered greetings require Habyss Pro.');
                                            return;
                                        }
                                        selectionFeedback();
                                        setGreetingStyle('ai');
                                    }}
                                >
                                    <View style={[styles.greetingIcon, { backgroundColor: colors.primary + '20' }]}>
                                        <Ionicons name="sparkles" size={20} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.greetingLabel, { color: colors.textPrimary }]}>AI-Powered</Text>
                                        <Text style={[styles.greetingDesc, { color: colors.textSecondary }]}>
                                            Personalized messages based on your progress
                                        </Text>
                                    </View>
                                    {greetingStyle === 'ai' && (
                                        <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="checkmark" size={14} color="#fff" />
                                        </View>
                                    )}
                                    {!isPremium && (
                                        <View style={styles.proBadge}>
                                            <Text style={styles.proBadgeText}>PRO</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.greetingOption,
                                        {
                                            backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.05)',
                                            borderColor: greetingStyle === 'quotes' ? colors.primary : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'),
                                            borderWidth: greetingStyle === 'quotes' ? 2 : 1,
                                        }
                                    ]}
                                    onPress={() => {
                                        selectionFeedback();
                                        setGreetingStyle('quotes');
                                    }}
                                >
                                    <View style={[styles.greetingIcon, { backgroundColor: '#F59E0B20' }]}>
                                        <Ionicons name="chatbubble-ellipses" size={20} color="#F59E0B" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.greetingLabel, { color: colors.textPrimary }]}>Quotes Only</Text>
                                        <Text style={[styles.greetingDesc, { color: colors.textSecondary }]}>
                                            Motivational quotes matching your personality
                                        </Text>
                                    </View>
                                    {greetingStyle === 'quotes' && (
                                        <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="checkmark" size={14} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* AI Personality Section */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>AI PERSONALITY</Text>
                            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                                Choose your AI coach's personality and tone
                            </Text>

                            {PERSONALITY_MODES.map((mode) => {
                                const isSelected = aiPersonality === mode.id;

                                return (
                                    <TouchableOpacity
                                        key={mode.id}
                                        style={[
                                            styles.personalityCard,
                                            {
                                                backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.03)',
                                                borderColor: isSelected ? colors.primary : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'),
                                                borderWidth: isSelected ? 2 : 1,
                                            }
                                        ]}
                                        onPress={() => handleSelectPersonality(mode.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.personalityHeader}>
                                            <Text style={styles.emoji}>{mode.icon}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.personalityTitle, { color: colors.textPrimary }]}>{mode.name}</Text>
                                                <Text style={[styles.personalityDesc, { color: colors.textSecondary }]}>{mode.description}</Text>
                                            </View>
                                            {isSelected && (
                                                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
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
                                                    <View style={[styles.attrBar, { backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' }]}>
                                                        <View
                                                            style={[
                                                                styles.attrFill,
                                                                {
                                                                    width: `${value}%`,
                                                                    backgroundColor: isSelected ? colors.primary : colors.textTertiary
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
                        </View>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        maxHeight: height * 0.85,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    borderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 1,
        borderBottomWidth: 0,
        pointerEvents: 'none',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: 'Lexend',
        flex: 1,
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 4,
        fontFamily: 'Lexend',
    },
    sectionDesc: {
        fontSize: 13,
        marginBottom: 16,
        fontFamily: 'Lexend_400Regular',
    },
    greetingOptions: {
        gap: 12,
    },
    greetingOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 12,
    },
    greetingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    greetingLabel: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    greetingDesc: {
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
    proBadge: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    proBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    personalityCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    personalityHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    emoji: {
        fontSize: 28,
    },
    personalityTitle: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    personalityDesc: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    attributes: {
        gap: 6,
    },
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

import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { useHaptics } from '@/hooks/useHaptics';

const { width } = Dimensions.get('window');

const AISettings = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { aiPersonality, setAIPersonality } = useAppSettings();
    const { mediumFeedback, selectionFeedback } = useHaptics();

    const handleSelectPersonality = (id: PersonalityModeId) => {
        mediumFeedback();

        const mode = PERSONALITY_MODES.find(m => m.id === id);
        if (mode?.warning) {
            Alert.alert(
                '⚠️ Warning',
                mode.warning,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'I understand', onPress: () => setAIPersonality(id) }
                ]
            );
        } else {
            setAIPersonality(id);
        }
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            selectionFeedback();
                            router.back();
                        }}
                        style={styles.backButton}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Personality</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Glow */}
                <LinearGradient
                    colors={['rgba(16, 185, 129, 0.1)', 'transparent']}
                    style={styles.headerGlow}
                />

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Introduction */}
                    <BlurView intensity={40} tint="dark" style={styles.introCard}>
                        <LinearGradient
                            colors={['rgba(16, 185, 129, 0.15)', 'rgba(59, 130, 246, 0.15)']}
                            style={styles.introGradient}
                        >
                            <View style={styles.introIcon}>
                                <Ionicons name="sparkles" size={24} color="#10B981" />
                            </View>
                            <Text style={styles.introTitle}>Choose Your AI Companion</Text>
                            <Text style={styles.introText}>
                                Select how you want your AI assistant to interact with you. Each personality offers a unique approach to motivation.
                            </Text>
                        </LinearGradient>
                    </BlurView>

                    {/* Personality Cards */}
                    {PERSONALITY_MODES.map((mode) => {
                        const isSelected = aiPersonality === mode.id;

                        return (
                            <TouchableOpacity
                                key={mode.id}
                                onPress={() => handleSelectPersonality(mode.id)}
                                activeOpacity={0.8}
                            >
                                <VoidCard
                                    style={{
                                        ...styles.personalityCard,
                                        ...(isSelected && { borderColor: '#10B981', borderWidth: 2 })
                                    }}
                                >
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Text style={styles.emoji}>{mode.icon}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                                                    {mode.name}
                                                </Text>
                                                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                                                    {mode.description}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <View style={styles.selectedBadge}>
                                                    <Ionicons name="checkmark" size={16} color="#fff" />
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Attribute Bars */}
                                    <View style={styles.attributes}>
                                        {Object.entries(mode.attributes).map(([key, value]) => (
                                            <View key={key} style={styles.attributeRow}>
                                                <Text style={[styles.attributeLabel, { color: colors.textTertiary }]}>
                                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                                </Text>
                                                <View style={[styles.attributeBar, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <View
                                                        style={[
                                                            styles.attributeFill,
                                                            {
                                                                width: `${value}%`,
                                                                backgroundColor: isSelected ? '#10B981' : colors.textTertiary
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Example Messages */}
                                    <View style={styles.examples}>
                                        <Text style={[styles.exampleLabel, { color: colors.textTertiary }]}>EXAMPLES</Text>
                                        <View style={[styles.exampleBubble, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={{ color: '#10B981', fontSize: 10, marginBottom: 4 }}>✓ Success</Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>
                                                "{mode.examples.success}"
                                            </Text>
                                        </View>
                                        <View style={[styles.exampleBubble, { backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={{ color: '#EF4444', fontSize: 10, marginBottom: 4 }}>✗ Missed</Text>
                                            <Text style={{ color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' }}>
                                                "{mode.examples.failure}"
                                            </Text>
                                        </View>
                                    </View>

                                    {mode.warning && (
                                        <View style={styles.warningBox}>
                                            <Ionicons name="warning" size={14} color="#F59E0B" />
                                            <Text style={{ color: '#F59E0B', fontSize: 10, flex: 1, marginLeft: 6 }}>
                                                Contains harsh language
                                            </Text>
                                        </View>
                                    )}
                                </VoidCard>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </SafeAreaView>
        </VoidShell>
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
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 1,
    },
    headerGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
        zIndex: -1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    introCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    introGradient: {
        padding: 24,
        alignItems: 'center',
    },
    introIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    introTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    introText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        fontFamily: 'SpaceMono-Regular',
        lineHeight: 20,
    },
    personalityCard: {
        marginBottom: 16,
        padding: 16,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    emoji: {
        fontSize: 32,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 13,
        fontFamily: 'SpaceMono-Regular',
        lineHeight: 18,
    },
    selectedBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    attributes: {
        marginBottom: 16,
    },
    attributeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    attributeLabel: {
        width: 80,
        fontSize: 10,
        fontFamily: 'SpaceMono-Regular',
        textTransform: 'capitalize',
    },
    attributeBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    attributeFill: {
        height: '100%',
        borderRadius: 2,
    },
    examples: {
        marginBottom: 12,
    },
    exampleLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'SpaceMono-Regular',
    },
    exampleBubble: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        padding: 10,
        borderRadius: 8,
    },
});

export default AISettings;

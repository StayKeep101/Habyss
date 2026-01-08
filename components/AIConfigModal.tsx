import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.70;
const DRAG_THRESHOLD = 120;

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

    const [isOpen, setIsOpen] = useState(false);
    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
        contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) {
            openModal();
        } else if (!visible && isOpen) {
            closeModal();
        }
    }, [visible]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DRAG_THRESHOLD) {
                runOnJS(closeModal)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        });

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
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal}>
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} activeOpacity={1} />
                </Animated.View>

                {/* Sheet */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient
                            colors={isLight ? ['#ffffff', '#f5f5f5'] : ['#1a1f2e', '#0f1218']}
                            style={styles.sheetGradient}
                        >
                            {/* Drag Handle */}
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, { backgroundColor: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }]} />
                            </View>

                            <Animated.View style={[{ flex: 1 }, contentStyle]}>
                                {/* Header */}
                                <Text style={[styles.title, { color: colors.textPrimary }]}>AI CONFIGURATION</Text>

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
                                                                ? (isLight ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.2)')
                                                                : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)'),
                                                            borderColor: isActive ? colors.primary : 'transparent',
                                                            borderWidth: isActive ? 1 : 0
                                                        }
                                                    ]}
                                                >
                                                    <View style={styles.cardHeader}>
                                                        <View style={[styles.iconBox, { backgroundColor: isActive ? colors.primary : (isLight ? '#fff' : 'rgba(255,255,255,0.1)') }]}>
                                                            <Ionicons name={mode.icon as any} size={18} color={isActive ? '#fff' : colors.textPrimary} />
                                                        </View>
                                                        {isLocked && <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />}
                                                    </View>

                                                    <Text style={[styles.modeName, { color: colors.textPrimary }]}>{mode.name}</Text>
                                                    <Text style={[styles.modeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
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
                                                onPress={() => setGreetingStyle(style.id as any)}
                                                style={[
                                                    styles.greetingChip,
                                                    {
                                                        backgroundColor: greetingStyle === style.id
                                                            ? (isLight ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.2)')
                                                            : (isLight ? '#f3f4f6' : 'rgba(255,255,255,0.05)'),
                                                        borderColor: greetingStyle === style.id ? colors.primary : 'transparent',
                                                        borderWidth: greetingStyle === style.id ? 1 : 0
                                                    }
                                                ]}
                                            >
                                                <Ionicons name={style.icon as any} size={14} color={greetingStyle === style.id ? colors.primary : colors.textSecondary} />
                                                <Text style={[styles.greetingLabel, { color: greetingStyle === style.id ? colors.primary : colors.textSecondary }]}>
                                                    {style.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={{ height: 40 }} />
                                </ScrollView>
                            </Animated.View>
                        </LinearGradient>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    sheetGradient: {
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
        textAlign: 'center',
        marginBottom: 24,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 10,
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
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        opacity: 0.7,
        lineHeight: 16,
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
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});

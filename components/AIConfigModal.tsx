import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { VoidCard } from '@/components/Layout/VoidCard';

const { height } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.85;
const DRAG_THRESHOLD = 100;

interface AIConfigModalProps {
    visible: boolean;
    onClose: () => void;
}

export const AIConfigModal: React.FC<AIConfigModalProps> = ({ visible, onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
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
        if (visible && !isOpen) openModal();
        else if (!visible && isOpen) closeModal();
    }, [visible]);

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

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient colors={['#0f1218', '#080a0e']} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder]} />

                        <View style={styles.header}>
                            <TouchableOpacity onPress={closeModal} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                                <Ionicons name="close" size={22} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 16 }}>
                                <Text style={styles.title}>AI SETTINGS</Text>
                                <Text style={[styles.subtitle, { color: accentColor }]}>PERSONALITY & GREETING</Text>
                            </View>
                        </View>

                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <Animated.View style={contentStyle}>

                                {/* Greeting Style */}
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: accentColor + '20' }]}>
                                        <Ionicons name="chatbubble-ellipses" size={14} color={accentColor} />
                                    </View>
                                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GREETING STYLE</Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                                    {[
                                        { id: 'brief', label: 'Dashboard', icon: 'flash' }, // Mapped from 'brief'
                                        { id: 'warm', label: 'Quote Based', icon: 'text' }, // Mapped from 'warm'
                                        { id: 'random', label: 'Random', icon: 'shuffle' }  // Mapped from 'random'
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

                                {/* Personality Selection */}
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: accentColor + '20' }]}>
                                        <Ionicons name="person" size={14} color={accentColor} />
                                    </View>
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

                            </Animated.View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
    sheetBorder: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.1)', pointerEvents: 'none' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Lexend' },
    subtitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'Lexend', marginTop: 4 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    sectionIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'Lexend' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: { width: '48%', padding: 16, borderRadius: 20, marginBottom: 0 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modeName: { fontSize: 15, fontWeight: '700', fontFamily: 'Lexend', marginBottom: 6 },
    modeDesc: { fontSize: 12, fontFamily: 'Lexend_400Regular', opacity: 0.7, lineHeight: 18 },
    greetingChip: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8, borderRadius: 16 },
    greetingLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Lexend', textAlign: 'center' },
});

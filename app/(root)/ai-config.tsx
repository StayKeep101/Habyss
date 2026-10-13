import { SheetScreen } from '@/components/Layout/SheetScreen';
import { FontFamily, UIStyles } from '@/constants/DesignSystem';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { router } from 'expo-router';
import { styles } from '@/styles/screens/ai-config.styles';

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
        <SheetScreen title="AI Configuration" onBack={() => router.back()}>

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
                                    <View style={[styles.iconBox, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                        <Ionicons name={mode.icon} size={24} color={colors.textPrimary} />
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
            </SheetScreen>
    );
}

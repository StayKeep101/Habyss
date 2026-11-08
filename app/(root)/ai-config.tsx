import { SheetScreen } from '@/components/ui/SheetScreen';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAccentGradient } from '@/context/AccentContext';
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { router } from 'expo-router';
import { styles } from '@/styles/screens/ai-config.styles';

export default function AIConfigScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback, mediumFeedback, lightFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle } = useAppSettings();
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
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personality</Text>
                    </View>

                    <View style={styles.list}>
                        {PERSONALITY_MODES.map((mode) => {
                            const isActive = aiPersonality === mode.id;

                            return (
                                <TouchableOpacity
                                    key={mode.id}
                                    onPress={() => handleSelectPersonality(mode.id as PersonalityModeId)}
                                    activeOpacity={0.8}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: isActive }}
                                    style={[
                                        styles.row,
                                        {
                                            backgroundColor: isActive
                                                ? (isLight ? accentColor + '15' : accentColor + '20')
                                                : colors.surface,
                                            borderColor: isActive ? accentColor : colors.border,
                                        },
                                    ]}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                                        <Ionicons name={mode.icon} size={24} color={colors.textPrimary} />
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <View style={styles.rowTitleLine}>
                                            <Text style={[styles.modeName, { color: colors.textPrimary }]}>{mode.name}</Text>
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
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Greeting</Text>
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

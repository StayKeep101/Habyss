import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useTheme, ThemeMode } from '@/constants/themeContext';
import { useAppSettings, RoadMapCardSize } from '@/constants/AppSettingsContext';
import { useAccent, ACCENT_GRADIENTS, AccentGradientId } from '@/constants/AccentContext';

const Appearance = () => {
    const { theme, setTheme } = useTheme();
    const colors = Colors[theme];
    const { cardSize, setCardSize } = useAppSettings();
    const { accentGradient, setAccentGradientId } = useAccent();
    const { lightFeedback, mediumFeedback } = useHaptics();

    const themes: { id: ThemeMode; name: string; icon: string; desc: string }[] = [
        { id: 'light', name: 'Light', icon: 'sunny-outline', desc: 'Bright and clean' },
        { id: 'abyss', name: 'Habyss', icon: 'moon-outline', desc: 'Signature dark mode' },
        { id: 'trueDark', name: 'True Dark', icon: 'contrast-outline', desc: 'OLED black' },
    ];

    const sizes: { id: RoadMapCardSize; name: string }[] = [
        { id: 'small', name: 'Compact' },
        { id: 'standard', name: 'Standard' },
        { id: 'big', name: 'Large' },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Appearance</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Theme Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>THEME</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {themes.map((t, index) => (
                            <View key={t.id}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <TouchableOpacity
                                    style={styles.themeRow}
                                    onPress={() => { lightFeedback(); setTheme(t.id); }}
                                >
                                    <Ionicons
                                        name={t.icon as any}
                                        size={22}
                                        color={theme === t.id ? accentGradient.colors[0] : colors.textSecondary}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.themeName, { color: colors.textPrimary }]}>{t.name}</Text>
                                        <Text style={[styles.themeDesc, { color: colors.textTertiary }]}>{t.desc}</Text>
                                    </View>
                                    {theme === t.id && (
                                        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    {/* Accent Gradient Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>ACCENT COLOR</Text>
                    <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>
                        Customize buttons, icons, and highlights
                    </Text>
                    <View style={styles.gradientGrid}>
                        {ACCENT_GRADIENTS.map((g) => {
                            const isSelected = accentGradient.id === g.id;
                            return (
                                <TouchableOpacity
                                    key={g.id}
                                    style={[
                                        styles.gradientCell,
                                        isSelected && { borderColor: '#fff', borderWidth: 2 }
                                    ]}
                                    onPress={() => { mediumFeedback(); setAccentGradientId(g.id); }}
                                    activeOpacity={0.7}
                                >
                                    <LinearGradient
                                        colors={g.colors as [string, string]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.gradientInner}
                                    >
                                        {isSelected && (
                                            <View style={styles.checkContainer}>
                                                <Ionicons name="checkmark" size={16} color="#fff" />
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={[styles.gradientName, { color: colors.textSecondary }]}>
                        {accentGradient.name}
                    </Text>

                    {/* Card Size Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>CARD SIZE</Text>
                    <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>
                        Size of goal and habit cards in Roadmap
                    </Text>
                    <View style={styles.sizeRow}>
                        {sizes.map((s) => (
                            <TouchableOpacity
                                key={s.id}
                                style={[
                                    styles.sizeBtn,
                                    {
                                        backgroundColor: cardSize === s.id ? accentGradient.colors[0] : colors.surface,
                                        borderColor: cardSize === s.id ? accentGradient.colors[0] : colors.border,
                                    }
                                ]}
                                onPress={() => { lightFeedback(); setCardSize(s.id); }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.sizeBtnText,
                                        { color: cardSize === s.id ? '#fff' : colors.textPrimary }
                                    ]}
                                >
                                    {s.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    sectionDesc: {
        fontSize: 12,
        marginBottom: 12,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    themeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    themeName: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    themeDesc: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    // Gradient Grid
    gradientGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    gradientCell: {
        width: 56,
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    gradientInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gradientName: {
        fontSize: 13,
        marginTop: 12,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    // Card Size
    sizeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    sizeBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    sizeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});

export default Appearance;

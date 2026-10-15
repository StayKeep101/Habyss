import { FontFamily } from '@/theme/designSystem';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { CountUp } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { s, vs, ms } from '@/theme/scale';

interface StreakCardProps {
    streak: number;
    completionTier: number; // 0-4
    onPress: () => void;
}

const FLAME_COLORS: Record<number, string[]> = {
    0: ['#F97316', '#FB923C'], // Default orange
    1: ['#F97316', '#FBBF24'], // Orange-yellow
    2: ['#3B82F6', '#60A5FA'], // Blue
    3: ['#8B5CF6', '#A78BFA'], // Purple
    4: ['#EF4444', '#F97316', '#FBBF24', '#22C55E', '#3B82F6', '#8B5CF6'], // Rainbow
};

export const StreakCard: React.FC<StreakCardProps> = ({ streak, completionTier, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';

    const flameColors = FLAME_COLORS[completionTier] || FLAME_COLORS[0];
    const isRainbow = completionTier === 4;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container]}>
                <View style={styles.iconContainer}>
                    {isRainbow ? (
                        <LinearGradient
                            colors={flameColors as [string, string, ...string[]]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.flameGradient}
                        >
                            <Ionicons name="flame" size={s(20)} color="white" />
                        </LinearGradient>
                    ) : (
                        <IconTile icon="flame" color={flameColors[0]} size={s(36)} />
                    )}
                </View>

                <View>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={streak} />
                    <Text style={[styles.label, { color: colors.textTertiary }]}>DAY STREAK</Text>
                </View>

                {completionTier === 4 && (
                    <View style={styles.perfectBadge}>
                        <Ionicons name="star" size={s(10)} color="#FBBF24" />
                    </View>
                )}
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    touchable: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: s(10),
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
    },
    iconContainer: {
        marginBottom: vs(2),
    },
    flameGradient: {
        width: s(36),
        height: s(36),
        borderRadius: s(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: {
        fontSize: ms(24),
        fontFamily: FontFamily.bold,
        textAlign: 'center',
        lineHeight: ms(24),
    },
    label: {
        fontSize: ms(8),
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
        textAlign: 'center',
        marginTop: vs(2),
    },
    perfectBadge: {
        position: 'absolute',
        top: vs(12),
        right: s(12),
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        padding: s(4),
        borderRadius: s(10),
    },
});

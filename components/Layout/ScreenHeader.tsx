import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.container}>
            {/* Ambient Background Glow */}
            <LinearGradient
                colors={[colors.primary, 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.ambientGlow}
            />

            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: colors.primary }]}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 32,
        position: 'relative',
    },
    ambientGlow: {
        position: 'absolute',
        top: -120,
        left: -20, // Extend slightly beyond container if needed, but absolute positioning relative to this headers view might be tricky if consistent placement is needed at Screen top. 
        // Actually, ScreenHeader is likely placed inside the ScrollView padding. 
        // To be consistent with statistics.tsx which had it absolute at top of screen, we might need to adjust.
        // But having it localized to the heater is safer for now. Let's make it bigger.
        right: -20,
        height: 300,
        opacity: 0.12, // Increased slightly as it's localized
        zIndex: -1,
    },
    content: {
        // paddingHorizontal is handled by parent ScrollView usually
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        fontFamily: 'Lexend',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
        opacity: 0.8,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
    }
});

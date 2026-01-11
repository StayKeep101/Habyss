import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { width, height } = Dimensions.get('window');

interface SpotifyPageProps {
    habitId: string;
}

export const SpotifyPage: React.FC<SpotifyPageProps> = ({ habitId }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Large Icon */}
                <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="musical-notes" size={60} color={colors.textSecondary} />
                </View>

                {/* Big Coming Soon Text */}
                <Text style={[styles.comingSoonText, { color: colors.textPrimary }]}>
                    COMING SOON
                </Text>

                {/* Feature Name */}
                <Text style={[styles.featureName, { color: colors.primary }]}>
                    AUDIO PROTOCOL
                </Text>

                {/* Description */}
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Link specific playlists to this habit for improved focus and conditioning.
                </Text>

                {/* Hint to swipe back */}
                <View style={styles.swipeHint}>
                    <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                    <Text style={[styles.swipeHintText, { color: colors.textSecondary }]}>
                        Swipe to go back
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    content: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    comingSoonText: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 4,
        fontFamily: 'Lexend',
        marginBottom: 8,
        textAlign: 'center',
    },
    featureName: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 3,
        fontFamily: 'Lexend',
        marginBottom: 24,
        opacity: 0.8,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 22,
        maxWidth: '90%',
        marginBottom: 48,
    },
    swipeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    swipeHintText: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
});

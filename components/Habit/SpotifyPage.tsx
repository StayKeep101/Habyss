import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '@/components/Layout/VoidCard';

const { width } = Dimensions.get('window');

interface SpotifyPageProps {
    habitId: string;
}

export const SpotifyPage: React.FC<SpotifyPageProps> = ({ habitId }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>AUDIO PROTOCOL</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Link specific playlists to this habit for improved focus.
                </Text>

                {/* Coming Soon Placeholder */}
                <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.comingSoonCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primaryDark + '20' }]}>
                        <Ionicons name="musical-notes" size={40} color={colors.primary} />
                    </View>
                    <Text style={[styles.comingSoonTitle, { color: colors.textPrimary }]}>
                        Spotify Integration
                    </Text>
                    <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
                        Coming Soon
                    </Text>
                    <Text style={[styles.comingSoonDesc, { color: colors.textTertiary }]}>
                        Connect your Spotify account to play focus playlists during your habit sessions.
                    </Text>
                </VoidCard>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        paddingHorizontal: 20,
        alignItems: 'center',
        paddingTop: 20,
        flex: 1,
    },
    content: {
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: 2,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 32,
        fontFamily: 'Lexend_400Regular',
        lineHeight: 18,
        maxWidth: '80%',
    },
    comingSoonCard: {
        width: '100%',
        padding: 32,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    comingSoonTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 8,
    },
    comingSoonText: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Lexend',
        marginBottom: 16,
    },
    comingSoonDesc: {
        fontSize: 12,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 18,
        maxWidth: '85%',
    },
});

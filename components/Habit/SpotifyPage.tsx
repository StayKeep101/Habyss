import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SpotifyPlayer } from './SpotifyPlayer';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { width } = Dimensions.get('window');

interface SpotifyPageProps {
    habitId: string;
}

export const SpotifyPage: React.FC<SpotifyPageProps> = ({ habitId }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>AUDIO PROTOCOL (COMING SOON)</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Link specific playlists to this habit for improved focus and conditioning.
                </Text>
                <View style={styles.playerContainer}>
                    <SpotifyPlayer habitId={habitId} />
                </View>
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
    playerContainer: {
        width: '100%',
    }
});

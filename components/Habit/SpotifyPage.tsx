import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { MusicService } from '@/lib/MusicService';

const { width } = Dimensions.get('window');

interface SpotifyPageProps {
    habitId: string;
}

export const SpotifyPage: React.FC<SpotifyPageProps> = ({ habitId }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<string | null>(null);

    useEffect(() => {
        checkPermissionsAndLoad();
    }, []);

    const checkPermissionsAndLoad = async () => {
        setLoading(true);
        const authorized = await MusicService.isAuthorized();
        if (authorized) {
            setPermissionGranted(true);
            loadPlaylists();
        } else {
            // Don't request immediately on mount to avoid jarring popups? 
            // Better to show a "Connect Music" button.
            setPermissionGranted(false);
            setLoading(false);
        }
    };

    const requestAccess = async () => {
        setLoading(true);
        const result = await MusicService.requestAuthorization();
        if (result) {
            setPermissionGranted(true);
            loadPlaylists();
        } else {
            setPermissionGranted(false);
            setLoading(false);
            Alert.alert("Permission Required", "Please allow access to Apple Music in settings to use this feature.");
        }
    };

    const loadPlaylists = async () => {
        try {
            const list = await MusicService.getPlaylists();
            setPlaylists(list);
        } catch (e) {
            console.warn('Failed to load playlists', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (playlist: any) => {
        try {
            await MusicService.playPlaylist(playlist.id);
            setCurrentTrack(playlist.name);
        } catch (e) {
            Alert.alert("Error", "Could not play this playlist.");
        }
    };

    const handleStop = async () => {
        await MusicService.stop();
        setCurrentTrack(null);
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => handlePlay(item)}
            activeOpacity={0.7}
        >
            {item.artwork ? (
                <Image source={{ uri: item.artwork }} style={styles.artwork} />
            ) : (
                <View style={[styles.artwork, { backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="musical-notes" size={24} color={colors.textTertiary} />
                </View>
            )}
            <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>Playlist</Text>
            </View>
            <TouchableOpacity onPress={() => handlePlay(item)} style={{ padding: 8 }}>
                <Ionicons name="play-circle" size={32} color={colors.primary} />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: 'transparent' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 16, color: colors.textSecondary, fontFamily: 'Lexend' }}>Loading Library...</Text>
            </View>
        );
    }

    if (!permissionGranted) {
        return (
            <View style={[styles.container, { paddingHorizontal: 40 }]}>
                <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="musical-notes" size={60} color={colors.textSecondary} />
                </View>
                <Text style={[styles.title, { color: colors.textPrimary, textAlign: 'center', marginBottom: 12 }]}>
                    Audio Protocol
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Connect Apple Music to play focus playlists directly from this habit.
                </Text>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary, marginTop: 32 }]}
                    onPress={requestAccess}
                >
                    <Text style={styles.buttonText}>Connect Apple Music</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ width: '100%', paddingHorizontal: 20, marginBottom: 16, paddingTop: 20 }}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AUDIO PROTOCOL</Text>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend_400Regular', fontSize: 12 }}>
                    Select a playlist to enhance your focus
                </Text>
            </View>

            <FlatList
                data={playlists}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend' }}>No playlists found in your library.</Text>
                    </View>
                }
            />

            {/* Current Track / Stop Control */}
            {currentTrack && (
                <View style={[styles.nowPlaying, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Lexend', fontWeight: 'bold', marginBottom: 2 }}>NOW PLAYING</Text>
                        <Text style={{ color: colors.textPrimary, fontFamily: 'Lexend_400Regular' }} numberOfLines={1}>{currentTrack}</Text>
                    </View>
                    <TouchableOpacity onPress={handleStop} style={{ padding: 8 }}>
                        <Ionicons name="stop-circle" size={32} color={colors.error} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        flex: 1,
        // justifyContent: 'center',
        // alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        fontFamily: 'Lexend',
        letterSpacing: 1,
        marginBottom: 4,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        alignSelf: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 22,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontFamily: 'Lexend',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    artwork: {
        width: 56,
        height: 56,
        borderRadius: 8,
        marginRight: 16,
    },
    itemName: {
        fontSize: 16,
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    nowPlaying: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    }
});

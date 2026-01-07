import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { VoidCard } from '@/components/Layout/VoidCard';
import { SpotifyService, SpotifyPlaylist } from '@/lib/spotifyService';
import { useHaptics } from '@/hooks/useHaptics';

interface SpotifyPlayerProps {
    habitId: string;
}

export const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ habitId }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [linkedMusic, setLinkedMusic] = useState<{ uri: string; name: string } | null>(null);
    const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [loading, setLoading] = useState(true);

    const { lightFeedback, mediumFeedback } = useHaptics();

    useEffect(() => {
        checkConnection();
        loadLinkedMusic();
    }, [habitId]);

    const checkConnection = async () => {
        const connected = await SpotifyService.isConnected();
        setIsConnected(connected);
        setLoading(false);
    };

    const loadLinkedMusic = async () => {
        const link = await SpotifyService.getHabitLink(habitId);
        setLinkedMusic(link);
    };

    const handleConnect = async () => {
        mediumFeedback();
        try {
            await SpotifyService.connect();
        } catch (error) {
            Alert.alert('Error', 'Failed to connect to Spotify. Make sure EXPO_PUBLIC_SPOTIFY_CLIENT_ID is configured.');
        }
    };

    const handleOpenPlaylists = async () => {
        lightFeedback();
        try {
            setLoading(true);
            const lists = await SpotifyService.getPlaylists();
            setPlaylists(lists);
            setShowPlaylistPicker(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to load playlists');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
        mediumFeedback();
        await SpotifyService.linkToHabit(habitId, playlist.uri, playlist.name);
        setLinkedMusic({ uri: playlist.uri, name: playlist.name });
        setShowPlaylistPicker(false);
    };

    const handlePlayMusic = async () => {
        mediumFeedback();
        if (linkedMusic) {
            await SpotifyService.openInSpotify(linkedMusic.uri);
        }
    };

    const handleUnlink = async () => {
        lightFeedback();
        await SpotifyService.unlinkFromHabit(habitId);
        setLinkedMusic(null);
    };

    if (loading) {
        return null;
    }

    // Not connected state
    if (!isConnected) {
        return (
            <TouchableOpacity onPress={handleConnect} activeOpacity={0.8}>
                <VoidCard glass style={styles.container}>
                    <View style={styles.spotifyBrand}>
                        <Ionicons name="musical-notes" size={20} color="#1DB954" />
                        <Text style={styles.spotifyText}>Connect Spotify</Text>
                    </View>
                    <Text style={styles.subtitle}>Play music while building habits</Text>
                </VoidCard>
            </TouchableOpacity>
        );
    }

    // Connected with linked music
    if (linkedMusic) {
        return (
            <VoidCard glass style={styles.container}>
                <View style={styles.linkedContainer}>
                    <TouchableOpacity onPress={handlePlayMusic} style={styles.playButton} activeOpacity={0.8}>
                        <LinearGradient colors={['#1DB954', '#1ed760']} style={styles.playGradient}>
                            <Ionicons name="play" size={24} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.trackInfo}>
                        <Text style={styles.trackName} numberOfLines={1}>{linkedMusic.name}</Text>
                        <Text style={styles.spotifyLabel}>Open in Spotify</Text>
                    </View>

                    <TouchableOpacity onPress={handleUnlink} style={styles.unlinkButton}>
                        <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                </View>
            </VoidCard>
        );
    }

    // Connected but no linked music
    return (
        <>
            <TouchableOpacity onPress={handleOpenPlaylists} activeOpacity={0.8}>
                <VoidCard glass style={styles.container}>
                    <View style={styles.spotifyBrand}>
                        <Ionicons name="musical-notes" size={20} color="#1DB954" />
                        <Text style={styles.spotifyText}>Add Music</Text>
                    </View>
                    <Text style={styles.subtitle}>Link a playlist to this habit</Text>
                </VoidCard>
            </TouchableOpacity>

            {/* Playlist Picker Modal */}
            <Modal
                visible={showPlaylistPicker}
                animationType="slide"
                transparent
                onRequestClose={() => setShowPlaylistPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={80} tint="dark" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Playlist</Text>
                            <TouchableOpacity onPress={() => setShowPlaylistPicker(false)}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={playlists}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => handleSelectPlaylist(item)}
                                    style={styles.playlistItem}
                                    activeOpacity={0.7}
                                >
                                    {item.imageUrl ? (
                                        <Image source={{ uri: item.imageUrl }} style={styles.playlistImage} />
                                    ) : (
                                        <View style={[styles.playlistImage, styles.placeholderImage]}>
                                            <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.4)" />
                                        </View>
                                    )}
                                    <View style={styles.playlistInfo}>
                                        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.playlistTracks}>{item.trackCount} tracks</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                                </TouchableOpacity>
                            )}
                        />
                    </BlurView>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    spotifyBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    spotifyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1DB954',
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Lexend_400Regular',
    },
    linkedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    playGradient: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackInfo: {
        flex: 1,
    },
    trackName: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
        fontFamily: 'Lexend',
    },
    spotifyLabel: {
        fontSize: 10,
        color: '#1DB954',
        marginTop: 2,
        fontFamily: 'Lexend_400Regular',
    },
    unlinkButton: {
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '70%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        fontFamily: 'Lexend',
    },
    playlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 8,
        gap: 12,
    },
    playlistImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    placeholderImage: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playlistInfo: {
        flex: 1,
    },
    playlistName: {
        fontSize: 14,
        fontWeight: '600',
        color: 'white',
        fontFamily: 'Lexend',
    },
    playlistTracks: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
        fontFamily: 'Lexend_400Regular',
    },
});

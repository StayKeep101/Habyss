import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MusicService } from '@/lib/MusicService';

interface MusicSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (playlistName: string) => void;
}

export const MusicSelectorModal: React.FC<MusicSelectorModalProps> = ({ visible, onClose, onSelect }) => {
    const colorScheme = useColorScheme();
    const isLight = colorScheme === 'light';
    // @ts-ignore
    const colors = Colors[isLight ? 'light' : 'abyss'];

    const [playlists, setPlaylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);

    useEffect(() => {
        if (visible) {
            checkPermissionsAndLoad();
        }
    }, [visible]);

    const checkPermissionsAndLoad = async () => {
        setLoading(true);
        const authorized = await MusicService.isAuthorized();
        if (authorized) {
            setPermissionGranted(true);
            loadPlaylists();
        } else {
            const result = await MusicService.requestAuthorization();
            if (result) {
                setPermissionGranted(true);
                loadPlaylists();
            } else {
                setPermissionGranted(false);
                setLoading(false);
            }
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
            onSelect(playlist.name);
            onClose();
        } catch (e) {
            Alert.alert("Error", "Could not play this playlist.");
        }
    };

    const handleStop = async () => {
        await MusicService.stop();
        onSelect('Stopped');
        onClose();
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => handlePlay(item)}
        >
            {item.artwork ? (
                <Image source={{ uri: item.artwork }} style={styles.artwork} />
            ) : (
                <View style={[styles.artwork, { backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="musical-notes" size={20} color={colors.textTertiary} />
                </View>
            )}
            <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
            <Ionicons name="play-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <BlurView intensity={isLight ? 20 : 30} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill}>
                <View style={[styles.container, { backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,25,0.9)' }]}>

                    <View style={[styles.header, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Apple Music</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : !permissionGranted ? (
                        <View style={styles.center}>
                            <Ionicons name="musical-note" size={48} color={colors.textTertiary} />
                            <Text style={[styles.msgText, { color: colors.textSecondary }]}>
                                Habyss needs access to Apple Music to play your playlists.
                            </Text>
                            <TouchableOpacity
                                style={[styles.permButton, { backgroundColor: colors.primary }]}
                                onPress={checkPermissionsAndLoad}
                            >
                                <Text style={styles.permButtonText}>Grant Access</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <FlatList
                                data={playlists}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                contentContainerStyle={{ padding: 16 }}
                                ListEmptyComponent={
                                    <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No playlists found.</Text>
                                }
                            />
                            <View style={[styles.footer, { borderTopColor: colors.border }]}>
                                <TouchableOpacity
                                    style={[styles.stopButton, { backgroundColor: colors.error + '20' }]}
                                    onPress={handleStop}
                                >
                                    <Ionicons name="stop" size={20} color={colors.error} />
                                    <Text style={[styles.stopText, { color: colors.error }]}>Stop Music</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 60,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    closeBtn: {
        position: 'absolute',
        right: 16,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    msgText: {
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
        fontFamily: 'Lexend_400Regular',
    },
    permButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    permButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    artwork: {
        width: 48,
        height: 48,
        borderRadius: 6,
        marginRight: 12,
    },
    itemName: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Lexend',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    stopText: {
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { IntegrationService, Integration } from '@/lib/integrationService';
import { SpotifyService } from '@/lib/spotifyService';
import { HealthKitService } from '@/lib/healthKit';
// import * as Calendar from 'expo-calendar'; // Removed static import

interface IntegrationItem {
    id: string;
    name: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    service: string;
    available: boolean;
    badge?: string;
}

const INTEGRATIONS: IntegrationItem[] = [
    {
        id: 'spotify',
        name: 'Spotify',
        description: 'Play music while building habits',
        icon: 'musical-notes',
        service: 'spotify',
        available: true,
        badge: 'Beta',
    },
    {
        id: 'calendar',
        name: 'Calendar',
        description: 'Sync habits with your calendar events',
        icon: 'calendar-outline',
        service: 'apple_calendar',
        available: false,
        badge: 'Soon',
    },
    {
        id: 'reminders',
        name: 'Reminders',
        description: 'Create reminders for your habits',
        icon: 'notifications-outline',
        service: 'apple_reminders',
        available: false,
        badge: 'Soon',
    },
    {
        id: 'health',
        name: 'Apple Health',
        description: 'Auto-complete fitness habits from Health data',
        icon: 'heart-outline',
        service: 'apple_health',
        available: Platform.OS === 'ios',
        badge: Platform.OS === 'ios' ? undefined : 'iOS only',
    },
];

export default function IntegrationsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    // Load integration statuses
    useEffect(() => {
        loadIntegrations();
    }, []);

    const loadIntegrations = useCallback(async () => {
        try {
            const data = await IntegrationService.getIntegrations();
            const statuses: Record<string, boolean> = {};
            data.forEach((i: Integration) => {
                statuses[i.service_name] = i.is_connected;
            });

            statuses.spotify = await SpotifyService.isConnected();
            setIntegrations(statuses);
        } catch (e) {
            console.error('Error loading integrations:', e);
        }
    }, []);

    useEffect(() => {
        const handleSpotifyCallback = async (url: string | null) => {
            if (!url || !url.includes('spotify-callback')) return;

            setLoading(prev => ({ ...prev, spotify: true }));
            try {
                const connected = await SpotifyService.handleCallback(url);
                if (connected) {
                    successFeedback();
                    await loadIntegrations();
                    Alert.alert('Connected', 'Spotify integration enabled');
                } else {
                    Alert.alert('Spotify', 'Could not complete Spotify sign-in.');
                }
            } catch (e) {
                console.error('Spotify callback handling error:', e);
                Alert.alert('Error', 'Failed to finish Spotify connection');
            } finally {
                setLoading(prev => ({ ...prev, spotify: false }));
            }
        };

        Linking.getInitialURL().then(handleSpotifyCallback).catch(() => undefined);
        const subscription = Linking.addEventListener('url', ({ url }) => {
            handleSpotifyCallback(url);
        });

        return () => {
            subscription.remove();
        };
    }, [loadIntegrations, successFeedback]);

    const showUnavailableNotice = (name: string) => {
        Alert.alert('Not available yet', `${name} is not ready in the app yet.`);
    };

    const handleHealthToggle = async (enabled: boolean) => {
        setLoading(prev => ({ ...prev, apple_health: true }));
        try {
            if (enabled) {
                const available = await HealthKitService.isAvailable();
                if (!available) {
                    Alert.alert('Not Available', 'Apple Health is not available on this device.');
                    return;
                }

                const granted = await HealthKitService.requestPermissions();
                if (granted) {
                    await IntegrationService.connectService('apple_health', { accessToken: 'local' });
                    setIntegrations(prev => ({ ...prev, apple_health: true }));
                    successFeedback();
                    Alert.alert('Connected', 'Apple Health integration enabled.');
                } else {
                    Alert.alert('Permission Denied', 'Health access is required to sync minutes.');
                }
            } else {
                await IntegrationService.disconnectService('apple_health');
                setIntegrations(prev => ({ ...prev, apple_health: false }));
                lightFeedback();
            }
        } catch (e) {
            console.error('Health toggle error:', e);
            Alert.alert('Error', 'Failed to toggle Health integration');
        } finally {
            setLoading(prev => ({ ...prev, apple_health: false }));
        }
    };

    const handleSpotifyToggle = async (enabled: boolean) => {
        setLoading(prev => ({ ...prev, spotify: true }));
        try {
            if (enabled) {
                const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
                if (!clientId) {
                    Alert.alert(
                        'Configuration Required',
                        'Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID to your .env file.\n\n' +
                        'Get it from: https://developer.spotify.com/dashboard'
                    );
                    setLoading(prev => ({ ...prev, spotify: false }));
                    return;
                }
                await SpotifyService.connect();
                Alert.alert('Spotify', 'Complete the login in your browser, then return to the app.');
            } else {
                await SpotifyService.disconnect();
                setIntegrations(prev => ({ ...prev, spotify: false }));
                lightFeedback();
            }
        } catch (e) {
            console.error('Spotify toggle error:', e);
            Alert.alert('Error', 'Failed to connect to Spotify');
        }
        setLoading(prev => ({ ...prev, spotify: false }));
    };

    const getToggleHandler = (service: string) => {
        switch (service) {
            case 'spotify': return handleSpotifyToggle;
            case 'apple_health': return handleHealthToggle;
            default: return () => { };
        }
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Integrations</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        CONNECTED SERVICES
                    </Text>
                    <Text style={[styles.sectionDesc, { color: colors.textTertiary }]}>
                        Sync your habits with other apps
                    </Text>

                    <VoidCard
                        glass={!isTrueDark}
                        intensity={isLight ? 20 : 80}
                        style={[
                            styles.card,
                            {
                                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                                borderColor: colors.border
                            }
                        ]}
                    >
                        {INTEGRATIONS.map((item, index) => (
                            <View key={item.id}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <View style={styles.row}>
                                    <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
                                        <Ionicons name={item.icon} size={20} color={accentColor} />
                                    </View>
                                    <View style={styles.textContent}>
                                        <View style={styles.nameRow}>
                                            <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                                                {item.name}
                                            </Text>
                                            {item.badge ? (
                                                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                                                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                                                        {item.badge}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={[styles.itemDesc, { color: colors.textTertiary }]}>
                                            {item.description}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={integrations[item.service] || false}
                                        onValueChange={(v) => {
                                            if (!item.available) {
                                                showUnavailableNotice(item.name);
                                                return;
                                            }
                                            getToggleHandler(item.service)(v);
                                        }}
                                        disabled={loading[item.service] || !item.available}
                                        trackColor={{ false: colors.border, true: accentColor }}
                                    />
                                </View>
                            </View>
                        ))}
                    </VoidCard>

                    {Platform.OS === 'ios' && (
                        <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                            Note: Apple Health requires additional native setup
                        </Text>
                    )}
                </View>
            </SafeAreaView>
        </VoidShell>
    );
}

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
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 4,
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContent: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
    },
    itemDesc: {
        fontSize: 11,
        marginTop: 2,
        fontFamily: 'Lexend_400Regular',
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    footnote: {
        fontSize: 11,
        marginTop: 16,
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: 'Lexend_400Regular',
    },
});

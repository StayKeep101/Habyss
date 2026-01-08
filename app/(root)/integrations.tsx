import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { IntegrationService, Integration } from '@/lib/integrationService';
import { SpotifyService } from '@/lib/spotifyService';
// import * as Calendar from 'expo-calendar'; // Removed static import

interface IntegrationItem {
    id: string;
    name: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    service: string;
}

const INTEGRATIONS: IntegrationItem[] = [
    {
        id: 'spotify',
        name: 'Spotify (Coming Soon)',
        description: 'Play music while building habits',
        icon: 'musical-notes',
        service: 'spotify',
    },
    {
        id: 'calendar',
        name: 'Calendar (Coming Soon)',
        description: 'Sync habits with your calendar events',
        icon: 'calendar-outline',
        service: 'apple_calendar',
    },
    {
        id: 'reminders',
        name: 'Reminders (Coming Soon)',
        description: 'Create reminders for your habits',
        icon: 'notifications-outline',
        service: 'apple_reminders',
    },
    {
        id: 'health',
        name: 'Apple Health (Coming Soon)',
        description: 'Auto-complete fitness habits from Health data',
        icon: 'heart-outline',
        service: 'apple_health',
    },
];

export default function IntegrationsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [integrations, setIntegrations] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    // Load integration statuses
    useEffect(() => {
        loadIntegrations();
    }, []);

    const loadIntegrations = async () => {
        try {
            const data = await IntegrationService.getIntegrations();
            const statuses: Record<string, boolean> = {};
            data.forEach((i: Integration) => {
                statuses[i.service_name] = i.is_connected;
            });
            setIntegrations(statuses);
        } catch (e) {
            console.error('Error loading integrations:', e);
        }
    };

    const handleCalendarToggle = async (enabled: boolean) => {
        setLoading(prev => ({ ...prev, apple_calendar: true }));
        try {
            if (enabled) {
                try {
                    const Calendar = require('expo-calendar');
                    const { status } = await Calendar.requestCalendarPermissionsAsync();
                    if (status === 'granted') {
                        // Get default calendar
                        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
                        if (calendars.length > 0) {
                            await IntegrationService.connectService('apple_calendar', { accessToken: 'local' });
                            setIntegrations(prev => ({ ...prev, apple_calendar: true }));
                            successFeedback();
                            Alert.alert('Connected', 'Calendar integration enabled');
                        }
                    } else {
                        Alert.alert('Permission Denied', 'Calendar access is required for this feature');
                    }
                } catch (e) {
                    Alert.alert('Not Available', 'Calendar feature is not available in this build.');
                    console.error(e);
                }
            } else {
                await IntegrationService.disconnectService('apple_calendar');
                setIntegrations(prev => ({ ...prev, apple_calendar: false }));
                lightFeedback();
            }
        } catch (e) {
            console.error('Calendar toggle error:', e);
            Alert.alert('Error', 'Failed to toggle calendar integration');
        }
        setLoading(prev => ({ ...prev, apple_calendar: false }));
    };

    const handleRemindersToggle = async (enabled: boolean) => {
        setLoading(prev => ({ ...prev, apple_reminders: true }));
        try {
            if (enabled) {
                try {
                    const Calendar = require('expo-calendar');
                    const { status } = await Calendar.requestRemindersPermissionsAsync();
                    if (status === 'granted') {
                        await IntegrationService.connectService('apple_reminders', { accessToken: 'local' });
                        setIntegrations(prev => ({ ...prev, apple_reminders: true }));
                        successFeedback();
                        Alert.alert('Connected', 'Reminders integration enabled');
                    } else {
                        Alert.alert('Permission Denied', 'Reminders access is required for this feature');
                    }
                } catch (e) {
                    Alert.alert('Not Available', 'Reminders feature is not available in this build.');
                    console.error(e);
                }
            } else {
                await IntegrationService.disconnectService('apple_reminders');
                setIntegrations(prev => ({ ...prev, apple_reminders: false }));
                lightFeedback();
            }
        } catch (e) {
            console.error('Reminders toggle error:', e);
            Alert.alert('Error', 'Failed to toggle reminders integration');
        }
        setLoading(prev => ({ ...prev, apple_reminders: false }));
    };

    const handleHealthToggle = async (enabled: boolean) => {
        // Apple Health requires react-native-health which needs native build
        if (enabled) {
            Alert.alert(
                'Apple Health',
                'Apple Health integration is coming soon!\n\n' +
                'This feature requires a native module (react-native-health) which needs:\n\n' +
                '• Development build (npx expo run:ios)\n' +
                '• HealthKit entitlement in Apple Developer Portal\n' +
                '• iOS device (not available in Expo Go)',
                [
                    { text: 'OK', style: 'cancel' }
                ]
            );
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
                // Note: OAuth callback will update the connection status
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
            case 'apple_calendar': return handleCalendarToggle;
            case 'apple_reminders': return handleRemindersToggle;
            case 'apple_health': return handleHealthToggle;
            default: return () => { };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
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

                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {INTEGRATIONS.map((item, index) => (
                            <View key={item.id}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <View style={styles.row}>
                                    <View style={[styles.iconBox, { backgroundColor: accentColor + '20' }]}>
                                        <Ionicons name={item.icon} size={20} color={accentColor} />
                                    </View>
                                    <View style={styles.textContent}>
                                        <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.itemDesc, { color: colors.textTertiary }]}>
                                            {item.description}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={integrations[item.service] || false}
                                        onValueChange={(v) => getToggleHandler(item.service)(v)}
                                        disabled={loading[item.service]}
                                        trackColor={{ false: colors.border, true: accentColor }}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>

                    {Platform.OS === 'ios' && (
                        <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                            Note: Apple Health requires additional native setup
                        </Text>
                    )}
                </View>
            </SafeAreaView>
        </View>
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
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
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

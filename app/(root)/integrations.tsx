import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';
import { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Switch, Alert, Platform } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { IntegrationService, Integration } from '@/lib/integrationService';
import { isHealthAvailable } from '@/lib/integrationAvailability';
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

const ALL_INTEGRATIONS: IntegrationItem[] = [
    {
        id: 'health',
        name: 'Apple Health',
        description: 'Save focus sessions as mindful minutes',
        icon: 'heart-outline',
        service: 'apple_health',
        available: isHealthAvailable(),
    },
];

// Anything unavailable is filtered out rather than shown as a dead switch.
const INTEGRATIONS: IntegrationItem[] = ALL_INTEGRATIONS.filter(item => item.available);

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

            setIntegrations(statuses);
        } catch (e) {
            console.error('Error loading integrations:', e);
        }
    }, []);

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

    const getToggleHandler = (service: string) => {
        switch (service) {
            case 'apple_health': return handleHealthToggle;
            default: return () => { };
        }
    };

    return (
        <SheetScreen title="Integrations" onBack={() => router.back()}>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                                        onValueChange={(v) => getToggleHandler(item.service)(v)}
                                        disabled={loading[item.service]}
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
                </ScrollView>
            </SheetScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { ...UIStyles.screenContent },
    sectionTitle: UIStyles.sectionTitle,
    sectionDesc: UIStyles.sectionDescription,
    card: {
        borderRadius: Radius.card,
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
        fontFamily: FontFamily.semibold,
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: FontFamily.regular,
        textTransform: 'uppercase',
    },
    itemDesc: {
        fontSize: 11,
        marginTop: 2,
        fontFamily: FontFamily.regular,
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
        fontFamily: FontFamily.regular,
    },
});

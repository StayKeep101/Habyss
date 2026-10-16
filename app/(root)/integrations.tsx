import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { HealthKitService } from '@/lib/HealthKitService';
import { syncHealthKitData } from '@/lib/habitsSQLite';
import { styles } from '@/styles/screens/integrations.styles';

/**
 * Apple Health, and only that: one switch. Health is the hub every watch and
 * tracker already writes into, so connecting it connects them all.
 */
export default function IntegrationsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();

    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [filled, setFilled] = useState<number | null>(null);

    useEffect(() => {
        let alive = true;
        // Asking whether it is authorised is not the same as asking for it: this
        // must not put a permission sheet in front of somebody who only opened
        // a settings screen.
        HealthKitService.authorised()
            .then(yes => { if (alive) setConnected(yes); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, []);

    const connect = useCallback(async (on: boolean) => {
        if (!on) {
            // iOS gives no way to revoke from inside an app, and pretending
            // otherwise would leave the switch lying about the system state.
            Alert.alert(
                'Turn it off in Settings',
                'Only iOS can withdraw Health access: Settings → Privacy & Security → Health → Habyss.',
            );
            return;
        }
        if (!HealthKitService.isAvailable) {
            Alert.alert('Not available here', 'Apple Health only exists on iPhone.');
            return;
        }

        setBusy(true);
        const granted = await HealthKitService.init();
        if (!granted) {
            setBusy(false);
            Alert.alert('Health said no', 'Nothing will be filled in automatically until it is allowed.');
            return;
        }
        setConnected(true);
        successFeedback();

        // Straight away, so the first thing anybody sees is it working rather
        // than a promise that it will.
        const count = await syncHealthKitData().catch(() => 0);
        setFilled(count);
        setBusy(false);
    }, [successFeedback]);

    return (
        <SheetScreen title="Integrations" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* One switch. Everything that writes to Health — watches,
                    rings, gyms — comes through it. */}
                <SettingsGroup title="Health">
                    <SettingsRow icon="heart" color="#FF375F" label="Apple Health"
                        toggle={connected} disabled={busy} onToggle={value => { lightFeedback(); void connect(value); }} />
                </SettingsGroup>
                {/* Habyss already answers Siri and Shortcuts (log a habit, add a
                    task); this is where to find them. */}
                <SettingsGroup title="Siri & Shortcuts">
                    <SettingsRow icon="mic" color="#5E5CE6" label="Open Shortcuts"
                        onPress={() => { lightFeedback(); void Linking.openURL('shortcuts://').catch(() => undefined); }} />
                </SettingsGroup>
                {filled !== null && filled > 0 ? (
                    <Text style={[styles.filled, { color: colors.textTertiary }]}>{filled} filled in from Health</Text>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

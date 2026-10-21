import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { HealthKitService } from '@/lib/HealthKitService';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { syncHealthKitData } from '@/lib/habitsSQLite';
import { styles } from '@/styles/screens/integrations.styles';
import { McpKeySheet } from '@/components/Integrations/McpKeySheet';
import { useCalendarEvents, useCalendarOn } from '@/hooks/useCalendarEvents';
import { explainCalendarRefused, setCalendarOn } from '@/lib/calendarEvents';
import { createMcpKey, listMcpKeys, mcpAvailable, mcpUrl, revokeMcpKey, type McpKey } from '@/lib/mcpKeys';
import { localDateKey } from '@/lib/habitSchedule';

/**
 * What Habyss connects to: Apple Calendar (events become fixed blocks in the
 * timeline), Apple Health (sleep, from every watch and tracker that writes to
 * it), AI assistants over MCP (Claude, ChatGPT and others can see your plan
 * and add or tick things), and Siri & Shortcuts.
 */
export default function IntegrationsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();

    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [filled, setFilled] = useState<number | null>(null);

    // Apple Calendar: the same switch as Settings → Timeline, with what it found today.
    const calendar = useCalendarOn();
    const todayEvents = useCalendarEvents(localDateKey(new Date()));
    const toggleCalendar = async (next: boolean) => {
        lightFeedback();
        const done = await setCalendarOn(next);
        if (!done && next) explainCalendarRefused();
    };

    // AI assistants (MCP): your keys, and a new one shown once.
    const [canMcp, setCanMcp] = useState<boolean | null>(null);
    const [keys, setKeys] = useState<McpKey[]>([]);
    const [newAddress, setNewAddress] = useState<string | null>(null);
    const refreshKeys = useCallback(async () => {
        const ok = await mcpAvailable().catch(() => false);
        setCanMcp(ok);
        if (ok) setKeys(await listMcpKeys().catch(() => []));
    }, []);
    useEffect(() => { void refreshKeys(); }, [refreshKeys]);
    const makeKey = () => {
        lightFeedback();
        if (!canMcp) { Alert.alert('Sign in first', 'An assistant reads your Habyss account, so sign in (Settings → Account) to connect one.'); return; }
        const make = async (label: string) => {
            try { setNewAddress(mcpUrl(await createMcpKey(label))); successFeedback(); void refreshKeys(); }
            catch (error) { Alert.alert('Could not connect', error instanceof Error ? error.message : 'Try again.'); }
        };
        Alert.prompt('Which assistant?', 'A name so you can tell your keys apart.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Make key', onPress: (value?: string) => void make(value?.trim() || 'AI assistant') },
        ], 'plain-text', 'Claude');
    };
    const removeKey = (key: McpKey) => {
        lightFeedback();
        Alert.alert(`Disconnect ${key.label}?`, 'The assistant using this key loses access straight away.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disconnect', style: 'destructive', onPress: () => void revokeMcpKey(key.id).then(refreshKeys).catch(error => Alert.alert('Could not disconnect', error.message)) },
        ]);
    };
    const usedLabel = (key: McpKey) => key.lastUsedAt
        ? `used ${new Date(key.lastUsedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
        : 'not used yet';

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
                {/* Screen Time: the apps blocked whenever a focus session runs. */}
                <SettingsGroup title="Focus">
                    <SettingsRow icon="hand-left" color={colors.warning} label="Apps blocked while focusing"
                        onPress={() => {
                            lightFeedback();
                            void ScreenTimeService.chooseApps().then(ok => {
                                if (!ok) Alert.alert('Screen Time not available', 'Allow Habyss in Settings → Screen Time, or update to the newest version of Habyss, then try again.');
                            });
                        }} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>
                    Every focus session blocks these apps until it ends or you pause it.
                </Text>

                {/* Your calendars' events, as fixed blocks the day is planned around. */}
                <SettingsGroup title="Calendar">
                    <SettingsRow icon="calendar" color={colors.error} label="Apple Calendar"
                        toggle={calendar} onToggle={value => void toggleCalendar(value)} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>
                    {calendar
                        ? `${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'events'} on your timeline today. Includes Google and Outlook accounts added to this iPhone.`
                        : 'Your events show on the timeline as fixed blocks, and habits and tasks are planned around them. Read on this phone only.'}
                </Text>

                {/* One switch. Everything that writes to Health — watches,
                    rings, gyms — comes through it. */}
                {/* Sleep only. Apple Watch, Garmin, Oura, Whoop and the rest all
                    write their sleep into Apple Health, so this covers them. */}
                <SettingsGroup title="Sleep">
                    <SettingsRow icon="moon" color="#5E5CE6" label="Sleep from Apple Health"
                        toggle={connected} disabled={busy} onToggle={value => { lightFeedback(); void connect(value); }} />
                </SettingsGroup>
                {/* Claude, ChatGPT and other assistants, through MCP: one key each. */}
                <SettingsGroup title="AI assistants (MCP)">
                    {keys.map(key => (
                        <SettingsRow key={key.id} icon="sparkles" color={colors.success} label={key.label} value={usedLabel(key)}
                            onPress={() => removeKey(key)} />
                    ))}
                    <SettingsRow icon="add" color={colors.primary} label={keys.length ? 'Connect another assistant' : 'Connect an assistant'}
                        disabled={canMcp === null} onPress={makeKey} />
                </SettingsGroup>
                <Text style={[styles.note, { color: colors.textTertiary }]}>
                    {canMcp === false
                        ? 'Sign in to Habyss to connect an assistant: it works with your account.'
                        : 'Let Claude, ChatGPT or any MCP app see your plan for today, add tasks and tick off habits and tasks. Tap a key to disconnect it.'}
                </Text>

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
            <McpKeySheet address={newAddress} onClose={() => setNewAddress(null)} />
        </SheetScreen>
    );
}

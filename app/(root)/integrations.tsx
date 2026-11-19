import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { McpKeySheet, type Assistant } from '@/components/Integrations/McpKeySheet';
import { useCalendarEvents, useCalendarOn, useCalendars } from '@/hooks/useCalendarEvents';
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

    // Opens already showing whether Health is connected (kept once read), then checks again behind it.
    const [connected, setConnected] = useState(() => HealthKitService.known ?? false);
    const [busy, setBusy] = useState(false);
    const [filled, setFilled] = useState<number | null>(null);

    // Apple Calendar: the same switch as Settings → Timeline, with what it found today.
    const calendar = useCalendarOn();
    const todayEvents = useCalendarEvents(localDateKey(new Date()));
    // Which of the phone's calendars reach the timeline, grouped by account.
    const { calendars, shown, setShown } = useCalendars();
    const accounts = useMemo(() => {
        const groups = new Map<string, typeof calendars>();
        for (const item of calendars) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
        return [...groups.entries()];
    }, [calendars]);
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
    // One tap per assistant: the key is made and named for it, then the sheet copies and opens it.
    const [assistant, setAssistant] = useState<Assistant>('Claude');
    const connectTo = async (which: Assistant) => {
        lightFeedback();
        if (!canMcp) { Alert.alert('Sign in first', 'Sign in to Habyss (Settings → Account) to connect an assistant.'); return; }
        try {
            const key = await createMcpKey(which);
            setAssistant(which);
            setNewAddress(mcpUrl(key));
            void refreshKeys();
        } catch (error) { Alert.alert('Could not connect', error instanceof Error ? error.message : 'Try again.'); }
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
        <SheetScreen title="Connected apps" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Your calendars' events, as fixed blocks the day is planned around:
                    one switch, then every account open with its calendars, each one in
                    its own colour, so choosing what reaches the timeline is one look. */}
                <SettingsGroup title="Calendar">
                    <SettingsRow icon="calendar" color={colors.error} label="Apple & Google Calendar"
                        toggle={calendar} onToggle={value => void toggleCalendar(value)} />
                </SettingsGroup>
                {calendar ? accounts.map(([account, list]) => (
                    <SettingsGroup key={account} title={account}>
                        {list.map(item => (
                            <SettingsRow key={item.id} icon="ellipse" color={item.color || colors.error} label={item.title}
                                toggle={shown(item.id)} onToggle={value => { lightFeedback(); setShown(item.id, value); }} />
                        ))}
                    </SettingsGroup>
                )) : null}
                <Text style={[styles.note, { color: colors.textTertiary }]}>
                    {calendar
                        ? `${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'events'} on your timeline today, from the calendars switched on above.`
                        : 'Events show on your timeline as fixed blocks, and habits and tasks are planned around them. Google Calendar comes in through the Google account on this iPhone.'}
                </Text>

                {/* One switch. Everything that writes to Health — watches,
                    rings, gyms — comes through it. */}
                {/* Sleep and activity. Apple Watch, Garmin, Oura, Whoop and the rest all
                    write into Apple Health, so this covers them. */}
                <SettingsGroup title="Apple Health">
                    <SettingsRow icon="heart" color="#FF375F" label="Sleep, exercise and steps"
                        toggle={connected} disabled={busy} onToggle={value => { lightFeedback(); void connect(value); }} />
                </SettingsGroup>
                {/* Claude, ChatGPT and other assistants, through MCP: one key each. */}
                <SettingsGroup title="AI assistants">
                    <SettingsRow icon="sparkles" color={colors.primary} label="Connect Claude"
                        disabled={canMcp === null} onPress={() => void connectTo('Claude')} />
                    <SettingsRow icon="chatbubble-ellipses" color={colors.success} label="Connect ChatGPT"
                        disabled={canMcp === null} onPress={() => void connectTo('ChatGPT')} />
                </SettingsGroup>
                {keys.length ? (
                    <SettingsGroup title="Connected">
                        {keys.map(key => (
                            <SettingsRow key={key.id} icon="link" color={colors.textTertiary} label={key.label} value={usedLabel(key)}
                                onPress={() => removeKey(key)} />
                        ))}
                    </SettingsGroup>
                ) : null}
                <Text style={[styles.note, { color: colors.textTertiary }]}>
                    {canMcp === false
                        ? 'Sign in to Habyss to connect an assistant.'
                        : 'Ask it to plan, add or tick things off in Habyss. Tap a connection to remove it.'}
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
            <McpKeySheet address={newAddress} assistant={assistant} onClose={() => setNewAddress(null)} />
        </SheetScreen>
    );
}

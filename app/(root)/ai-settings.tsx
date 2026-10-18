import { AppButton } from '@/components/ui/AppButton';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { FontFamily } from '@/theme/designSystem';
import React from 'react';
import { Alert, AppState, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAccentGradient } from '@/context/AccentContext';
import { textOn } from '@/theme/tokens';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { IconTile } from '@/components/ui/IconTile';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { AlivePreview } from '@/components/Echo/AlivePreview';
import { aliveLine } from '@/lib/echoAlive';
import { AnimatedFill } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings, GreetingStyle } from '@/context/AppSettingsContext';
import { currentEngine, isOnDeviceAIReady } from '@/lib/onDeviceAI';
import { LOCAL_MODEL } from '@/lib/localModelDownload';
import type { ModelDownloadState } from '@/lib/LocalLLMService';
import { coachHello } from '@/lib/coachMessages';
import { NotificationService } from '@/lib/notificationService';
import { PAYWALL_ENABLED } from '@/constants/features';
import {
    DEFAULT_DAY, DEFAULT_ECHO, eveningCheckIn, getDayWindow, getEchoConfig, getName,
    morningCheckIn, saveEchoConfig, type DayWindow, type EchoConfig,
} from '@/lib/echo';
import { hasTurboModule } from '@/lib/nativeModules';
import { clearWrittenLines } from '@/lib/echoWriter';

import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { styles } from '@/styles/screens/ai-settings.styles';

/** null in a build without the on-device model's native code. */
const localModel = (): typeof import('@/lib/LocalLLMService').default | null =>
    (hasTurboModule('MLCEngine') ? require('@/lib/LocalLLMService').default : null);

// Greeting style options
const GREETING_STYLES: { id: GreetingStyle; label: string; icon: string; description: string }[] = [
    { id: 'ai', label: 'Echo decides', icon: 'sparkles', description: 'The mix that suits the voice' },
    { id: 'quotes', label: 'Motivation', icon: 'bulb', description: 'Habit science and a push' },
    { id: 'data', label: 'My data', icon: 'analytics', description: 'Only your own progress' },
    { id: 'all', label: 'Everything', icon: 'shuffle', description: 'A bit of all of it' },
];

/** Apple supplies its system model; the optional Llama files come from Hugging Face. */
const OfflineStartCard = ({ colors, isLight, isTrueDark }: any) => {
    const { primary: accentSolid } = useAccentGradient();
    const Service = localModel();
    const [engine, setEngine] = React.useState(currentEngine());
    const [transfer, setTransfer] = React.useState<ModelDownloadState>(() => Service?.getDownloadState() ?? {
        phase: 'idle', downloadedBytes: 0, totalBytes: null, percentage: 0,
    });
    const [downloaded, setDownloaded] = React.useState<boolean | null>(null);
    React.useEffect(() => Service?.subscribeDownloadState(setTransfer), [Service]);
    React.useEffect(() => {
        let active = true;
        const refresh = () => {
            setEngine(currentEngine());
            if (!Service) { setDownloaded(false); return; }
            void Service.isDownloaded().then((found: boolean) => { if (active) setDownloaded(found); });
        };
        refresh();
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
        return () => { active = false; subscription.remove(); };
    }, [Service, transfer.phase]);

    const isDownloading = transfer.phase === 'downloading';
    const busy = isDownloading || transfer.phase === 'loading';
    const retry = transfer.phase === 'error' || transfer.phase === 'cancelled';
    const mb = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

    const remove = () => {
        Alert.alert('Remove the on-device model?', `Removes ${LOCAL_MODEL.sizeLabel} if fully downloaded. Habyss keeps working with its built-in rules.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    if (!await Service?.deleteModel()) Alert.alert('Could not remove model', 'Try again.');
                },
            },
        ]);
    };

    const canDownload = !!Service;
    const apple = engine === 'apple';
    const onPhone = apple || downloaded === true;
    const title = apple ? 'Apple Intelligence' : 'Llama 3.2 (1B)';
    const badge = apple ? 'Built in' : transfer.phase === 'loading' ? 'Loading…'
        : isDownloading ? (transfer.totalBytes ? `${Math.floor(transfer.percentage)}%` : 'Connecting…')
            : engine === 'llama' ? 'Ready' : downloaded ? 'Downloaded' : retry ? 'Incomplete' : 'Optional';
    const status = apple
        ? 'Part of this iPhone. Nothing to download. Private.'
        : !canDownload ? 'Offline AI is not included in this build. Install a newer Habyss build to use it.'
        : busy
            ? transfer.phase === 'loading' ? 'Checking and loading the model on this phone…'
                : `${mb(transfer.downloadedBytes)}${transfer.totalBytes ? ` of ${mb(transfer.totalBytes)}` : ''} downloaded. Keep Habyss open on Wi-Fi.`
            : transfer.phase === 'error' ? transfer.error
            : transfer.phase === 'cancelled' ? 'Download stopped. Retry keeps the files already completed.'
            : downloaded
                ? 'Runs on this phone. Tap “Use offline AI” when creating a habit, task or goal. Automatic AI stays off to limit heat and battery use.'
                : `Apple Intelligence is unavailable on this device. Download Llama once (${LOCAL_MODEL.sizeLabel}) to use AI when you tap. Habyss also works without it.`;

    return (
        <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={{ borderRadius: 16, padding: 16, backgroundColor: isLight ? colors.surfaceSecondary : undefined, gap: 10 }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={onPhone ? 'hardware-chip' : 'hardware-chip-outline'} size={20} color={onPhone ? colors.success : colors.textTertiary} />
                <Text style={{ flex: 1, fontSize: 16, color: colors.textPrimary, fontFamily: FontFamily.semibold }}>{title}</Text>
                {badge ? (
                    <Text style={{ fontSize: 12, color: onPhone ? colors.success : isDownloading ? accentSolid : colors.textTertiary, fontFamily: FontFamily.semibold }}>{badge}</Text>
                ) : null}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textTertiary, fontFamily: FontFamily.regular }}>
                {status}
            </Text>
            {isDownloading ? (
                <View style={{ height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' }}>
                    <AnimatedFill progress={transfer.percentage / 100} style={{ height: '100%', backgroundColor: accentSolid }} />
                </View>
            ) : null}
            {!apple && canDownload ? (
                <>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textTertiary, fontFamily: FontFamily.regular }}>
                        Model files come from Hugging Face. AI processing stays on this phone.
                    </Text>
                    <AppButton label="View model source" variant="ghost" onPress={() => {
                        void Linking.openURL(LOCAL_MODEL.source).catch(() => Alert.alert('Could not open model source', LOCAL_MODEL.source));
                    }} />
                </>
            ) : null}
            {!apple && !busy && canDownload && downloaded !== null && engine !== 'llama' ? (
                <AppButton label={retry ? 'Retry' : downloaded ? 'Load offline AI' : `Download · ${LOCAL_MODEL.sizeLabel}`}
                    icon="cloud-download-outline" onPress={() => void Service.downloadModel()} />
            ) : null}
            {isDownloading && Platform.OS === 'ios' ? (
                <AppButton label="Cancel download" variant="ghost" onPress={() => Service?.cancelDownload()} />
            ) : null}
            {!apple && !busy && (downloaded || retry) ? (
                <AppButton label="Remove from this phone" variant="danger" onPress={remove} />
            ) : null}
        </VoidCard>
    );
};

// import { useSuperwall } from 'expo-superwall';

const AISettings = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentSolid } = useAccentGradient();
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { mediumFeedback, selectionFeedback } = useHaptics();
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle, notificationsEnabled, setNotificationsEnabled } = useAppSettings();
    // const { registerPlacement } = useSuperwall();

    const handleSelectPersonality = (id: PersonalityModeId) => {
        mediumFeedback();
        const mode = PERSONALITY_MODES.find(m => m.id === id);
        if (mode?.warning) {
            Alert.alert('⚠️ Warning', mode.warning, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'I understand', onPress: () => setAIPersonality(id) }
            ]);
        } else {
            setAIPersonality(id);
        }
    };

    // What Echo knows about the user, and what it is allowed to do.
    const [name, setName] = React.useState<string | undefined>(undefined);
    const [day, setDay] = React.useState<DayWindow>(DEFAULT_DAY);
    const [echo, setEcho] = React.useState<EchoConfig>(DEFAULT_ECHO);

    React.useEffect(() => {
        getName().then(setName).catch(() => undefined);
        getDayWindow().then(setDay).catch(() => undefined);
        getEchoConfig().then(setEcho).catch(() => undefined);
    }, []);

    // Echo can only write its own reminders where a model is ready.
    const hasModel = isOnDeviceAIReady();

    /** Saved, then the notifications are rewritten to match. */
    const saveEcho = (next: EchoConfig) => {
        selectionFeedback();
        setEcho(next);
        saveEchoConfig(next)
            .then(() => NotificationService.refreshReminders())
            .catch(() => undefined);
    };

    /** Echo Alive needs notifications; turning it on asks for them if needed. */
    const setAlive = async (alive: boolean) => {
        if (alive && !(await NotificationService.requestPermissions())) {
            Alert.alert('Allow notifications for Echo', 'Enable Habyss notifications in iOS Settings.', [
                { text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() },
            ]);
            return;
        }
        if (alive && !notificationsEnabled) await setNotificationsEnabled(true);
        saveEcho({ ...echo, alive });
    };
    const sample = { key: 'habit:run:preview', kind: 'habit' as const, id: 'run', title: 'Run 5 km', day: '', start: new Date(), end: new Date(), url: '' };
    const aliveLines = [
        { ...aliveLine(sample, 'before', aiPersonality), when: '7:50' },
        { ...aliveLine(sample, 'follow-up', aiPersonality), when: '8:45' },
    ];

    const handleSelectGreeting = (style: GreetingStyle) => {
        selectionFeedback();
        setGreetingStyle(style);
    };

    return (
        <SheetScreen title="Echo" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* What Echo sounds like, heard rather than described. */}
                <MatteSurface radius={16} style={styles.sample}>
                    <IconTile icon="sparkles" color="#5E5CE6" size={32} />
                    <Text style={[styles.sampleText, { color: colors.textSecondary }]}>
                        “{coachHello(aiPersonality, name)}”
                    </Text>
                </MatteSurface>

                {/* Every option visible at once, as a grid; the one in use
                    says what it is in a word or two underneath. */}
                <Text style={[styles.groupTitle, styles.gridTitle, { color: colors.textPrimary }]}>Voice</Text>
                <OptionGrid
                    options={PERSONALITY_MODES.map(mode => ({ id: mode.id, label: mode.name, icon: mode.icon as string, detail: mode.description }))}
                    value={aiPersonality}
                    onChange={handleSelectPersonality}
                />

                <Text style={[styles.groupTitle, styles.gridTitle, { color: colors.textPrimary }]}>On Home</Text>
                <OptionGrid
                    options={GREETING_STYLES.map(style => ({ id: style.id, label: style.label, icon: style.icon, detail: style.description }))}
                    value={greetingStyle}
                    onChange={handleSelectGreeting}
                />

                {/* Echo's coaching: insights, getting started, the week, memory. */}
                <SettingsGroup title="Coaching">
                    <SettingsRow icon="calendar" color="#30D158" label="Your week" onPress={() => router.push('/(root)/week-review' as never)} />
                    <SettingsRow icon="bookmark" color="#FF9F0A" label="What Echo remembers" onPress={() => router.push('/(root)/echo-memory' as never)} />
                    <SettingsRow icon="notifications" color="#FF453A" label="Weekly review reminder" toggle={echo.weeklyReview !== false}
                        onToggle={value => { saveEcho({ ...echo, weeklyReview: value }); setTimeout(() => { void (require('@/lib/weeklyReviewNotice') as typeof import('@/lib/weeklyReviewNotice')).syncWeeklyReviewNotice(); }, 300); }} />
                </SettingsGroup>

                <Group title="Check-ins">
                    <ToggleRow
                        icon="sunny-outline"
                        label="Morning"
                        detail={morningCheckIn(day)}
                        value={echo.morning}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => saveEcho({ ...echo, morning: value })}
                    />
                    <ToggleRow
                        icon="moon-outline"
                        label="Before bed"
                        detail={eveningCheckIn(day)}
                        value={echo.evening}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => saveEcho({ ...echo, evening: value })}
                    />
                    <ToggleRow
                        icon="person-outline"
                        label="Call me by name"
                        detail={name ? `“${name}”` : 'Set a name in your profile'}
                        value={echo.useName && !!name}
                        disabled={!name}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => saveEcho({ ...echo, useName: value })}
                    />
                    <ToggleRow
                        icon="create-outline"
                        label="Echo writes reminders"
                        detail={hasModel ? 'In this voice' : 'Requires Apple Intelligence'}
                        value={echo.writeReminders && hasModel}
                        disabled={!hasModel}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => {
                            // Turning it off throws the written lines away, so
                            // the next reminder is the built-in one again.
                            if (!value) void clearWrittenLines();
                            saveEcho({ ...echo, writeReminders: value });
                        }}
                    />
                </Group>

                {/* Echo's nudges around a planned session, shown not explained. */}
                <Group title="Echo Alive">
                    <AlivePreview lines={aliveLines} accent={accentSolid} />
                    <ToggleRow
                        icon="sparkles-outline"
                        label="Echo Alive"
                        value={!!echo.alive && notificationsEnabled}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => void setAlive(value)}
                    />
                    <ToggleRow
                        icon="refresh-outline"
                        label="Follow-up"
                        value={echo.aliveFollowUp !== false}
                        disabled={!echo.alive}
                        colors={colors}
                        accent={accentSolid}
                        onChange={(value: boolean) => saveEcho({ ...echo, aliveFollowUp: value })}
                    />
                </Group>

                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 22 }]}>On-device AI</Text>
                <OfflineStartCard colors={colors} isLight={isLight} isTrueDark={isTrueDark} />

                {PAYWALL_ENABLED ? (
                    <TouchableOpacity
                        style={styles.manage}
                        onPress={async () => {
                            const RevenueCatUI = require('react-native-purchases-ui').default;
                            await RevenueCatUI.presentCustomerCenter();
                        }}
                    >
                        <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.medium, fontSize: 14 }}>Manage subscription</Text>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

/** Choices as a grid of tiles: all visible, one tap each. */
function OptionGrid<T extends string>({ options, value, onChange }: {
    options: { id: T; label: string; icon: string; detail: string }[];
    value: T;
    onChange: (id: T) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: chosen } = useAccentGradient();
    const selected = options.find(option => option.id === value);
    return (
        <View>
            <View style={styles.grid} accessibilityRole="radiogroup">
                {options.map(option => {
                    const on = option.id === value;
                    return (
                        <TouchableOpacity
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`${option.label}. ${option.detail}`}
                            activeOpacity={0.75}
                            onPress={() => onChange(option.id)}
                            style={styles.tilePress}
                        >
                            {/* Matte; chosen, it turns solid and light — no accent. */}
                            <MatteSurface radius={16} level="control" elevation="none" tint={on ? chosen : undefined} style={styles.tile}>
                                <Ionicons filled name={option.icon as any} size={18} color={on ? textOn(chosen) : colors.textSecondary} />
                                <Text numberOfLines={1} style={[styles.tileLabel, { color: on ? textOn(chosen) : colors.textSecondary }]}>{option.label}</Text>
                            </MatteSurface>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {selected ? <Text style={[styles.groupHint, { color: colors.textTertiary, marginTop: 8 }]}>{selected.detail}</Text> : null}
        </View>
    );
}

/** A titled group of rows: the shared settings card. */
const Group = ({ title, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <SettingsGroup title={title}>{children}</SettingsGroup>
);

const ROW_COLOURS: Record<string, string> = {
    'sunny-outline': '#FF9F0A', 'moon-outline': '#5E5CE6', 'person-outline': '#5B8CFF', 'create-outline': '#BF5AF2',
    'sparkles-outline': '#FF375F', 'refresh-outline': '#30D158',
};
/** An on/off row: the shared settings row with a switch. */
const ToggleRow = ({ icon, label, value, disabled, onChange }: any) => (
    <SettingsRow icon={String(icon).replace('-outline', '')} color={ROW_COLOURS[icon] ?? '#8A8A94'} label={label}
        toggle={!!value} disabled={disabled} onToggle={onChange} />
);

/** A time the user can change, in the phone's own picker. */

export default AISettings;

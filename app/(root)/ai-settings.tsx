import { SheetScreen } from '@/components/ui/SheetScreen';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import React from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
import { currentEngine } from '@/lib/onDeviceAI';
import { coachHello } from '@/lib/coachMessages';
import { NotificationService } from '@/lib/notificationService';
import { PAYWALL_ENABLED } from '@/constants/features';
import {
    DEFAULT_DAY, DEFAULT_ECHO, eveningCheckIn, getDayWindow, getEchoConfig, getName,
    morningCheckIn, saveEchoConfig, type DayWindow, type EchoConfig,
} from '@/lib/echo';
import { hasTurboModule } from '@/lib/nativeModules';
import { clearWrittenLines } from '@/lib/echoWriter';

/** null in a build without the on-device model's native code. */
const localModel = () => (hasTurboModule('MLCEngine') ? require('@/lib/LocalLLMService').default : null);
import { PERSONALITY_MODES, PersonalityModeId } from '@/constants/AIPersonalities';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { styles } from '@/styles/screens/ai-settings.styles';


// Greeting style options
const GREETING_STYLES: { id: GreetingStyle; label: string; icon: string; description: string }[] = [
    { id: 'ai', label: 'Echo decides', icon: 'sparkles', description: 'The mix that suits the voice' },
    { id: 'quotes', label: 'Motivation', icon: 'bulb', description: 'Habit science and a push' },
    { id: 'data', label: 'My data', icon: 'analytics', description: 'Only your own progress' },
    { id: 'all', label: 'Everything', icon: 'shuffle', description: 'A bit of all of it' },
];

// Separate component to handle Local LLM logic
/**
 * Which on-device model Echo and the natural-language parsing use. Apple's
 * model is built into the phone; the Llama model downloads by itself on Wi-Fi
 * the first time, and can be downloaded now or removed here.
 */
const OfflineStartCard = ({ colors, isLight, isTrueDark }: any) => {
    const [engine, setEngine] = React.useState(currentEngine());
    const [isDownloading, setIsDownloading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);

    const download = async () => {
        const Service = localModel();
        if (!Service) {
            Alert.alert('Not in this version', 'Update the app to download the on-device model.');
            return;
        }
        setIsDownloading(true);
        const success = await Service.downloadModel((p: number) => setProgress(p));
        setIsDownloading(false);
        setEngine(currentEngine());
        if (!success) Alert.alert('Download failed', 'Check your connection and try again. On Wi-Fi it also downloads by itself.');
    };

    const remove = () => {
        Alert.alert('Remove the on-device model?', 'Frees about 1.2 GB. Habyss keeps working with its built-in rules, and the model downloads again next time you are on Wi-Fi.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    await localModel()?.deleteModel();
                    setEngine(currentEngine());
                },
            },
        ]);
    };

    const canDownload = !!localModel();
    const title = engine === 'apple' ? 'Apple Intelligence' : 'Llama 3.2 (1B)';
    const status = engine === 'apple'
        ? 'Built in. Private.'
        : engine === 'llama'
            ? 'On this phone · 1.2 GB. Private.'
            : isDownloading
                ? `Downloading… ${Math.round(progress)}%`
                : 'Downloads on Wi-Fi · 1.2 GB.';

    return (
        <VoidCard
            glass={!isTrueDark}
            intensity={isLight ? 20 : 80}
            style={{ borderRadius: 16, padding: 16, backgroundColor: isLight ? colors.surfaceSecondary : undefined, gap: 10 }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={engine ? 'hardware-chip' : 'hardware-chip-outline'} size={20} color={engine ? colors.success : colors.textTertiary} />
                <Text style={{ flex: 1, fontSize: 16, color: colors.textPrimary, fontFamily: FontFamily.semibold }}>{title}</Text>
                {engine ? <Text style={{ fontSize: 12, color: colors.success, fontFamily: FontFamily.semibold }}>Ready</Text> : null}
            </View>
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textTertiary, fontFamily: FontFamily.regular }}>
                {status}
            </Text>
            {isDownloading ? (
                <View style={{ height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' }}>
                    <AnimatedFill progress={progress / 100} style={{ height: '100%', backgroundColor: colors.primary }} />
                </View>
            ) : null}
            {engine === null && !isDownloading && canDownload ? (
                <TouchableOpacity accessibilityRole="button" onPress={download} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: FontFamily.medium }}>Download now</Text>
                </TouchableOpacity>
            ) : null}
            {engine === 'llama' ? (
                <TouchableOpacity accessibilityRole="button" onPress={remove} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                    <Text style={{ color: colors.error, fontSize: 14, fontFamily: FontFamily.medium }}>Remove from this phone</Text>
                </TouchableOpacity>
            ) : null}
        </VoidCard>
    );
};

// import { useSuperwall } from 'expo-superwall';

const AISettings = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
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
    const hasModel = currentEngine() !== null;

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
                <Text style={[styles.groupTitle, styles.gridTitle, { color: colors.textSecondary }]}>VOICE</Text>
                <OptionGrid
                    options={PERSONALITY_MODES.map(mode => ({ id: mode.id, label: mode.name, icon: mode.icon as string, detail: mode.description }))}
                    value={aiPersonality}
                    onChange={handleSelectPersonality}
                />

                <Text style={[styles.groupTitle, styles.gridTitle, { color: colors.textSecondary }]}>ON HOME</Text>
                <OptionGrid
                    options={GREETING_STYLES.map(style => ({ id: style.id, label: style.label, icon: style.icon, detail: style.description }))}
                    value={greetingStyle}
                    onChange={handleSelectGreeting}
                />

                <Group title="Check-ins">
                    <ToggleRow
                        icon="sunny-outline"
                        label="Morning"
                        detail={morningCheckIn(day)}
                        value={echo.morning}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, morning: value })}
                    />
                    <ToggleRow
                        icon="moon-outline"
                        label="Before bed"
                        detail={eveningCheckIn(day)}
                        value={echo.evening}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, evening: value })}
                    />
                    <ToggleRow
                        icon="person-outline"
                        label="Call me by name"
                        detail={name ? `“${name}”` : 'Set a name in your profile'}
                        value={echo.useName && !!name}
                        disabled={!name}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, useName: value })}
                    />
                    <ToggleRow
                        icon="create-outline"
                        label="Echo writes reminders"
                        detail={hasModel ? 'In this voice' : 'Needs on-device AI'}
                        value={echo.writeReminders && hasModel}
                        disabled={!hasModel}
                        colors={colors}
                        accent={colors.primary}
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
                    <AlivePreview lines={aliveLines} accent={colors.primary} />
                    <ToggleRow
                        icon="sparkles-outline"
                        label="Echo Alive"
                        value={!!echo.alive && notificationsEnabled}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => void setAlive(value)}
                    />
                    <ToggleRow
                        icon="refresh-outline"
                        label="Follow-up"
                        value={echo.aliveFollowUp !== false}
                        disabled={!echo.alive}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, aliveFollowUp: value })}
                    />
                </Group>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 22 }]}>ON-DEVICE AI</Text>
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
                            <MatteSurface radius={16} level="control" elevation="none" tint={on ? colors.textPrimary : undefined} style={styles.tile}>
                                <Ionicons filled name={option.icon as any} size={18} color={on ? colors.background : colors.textSecondary} />
                                <Text numberOfLines={1} style={[styles.tileLabel, { color: on ? colors.background : colors.textSecondary }]}>{option.label}</Text>
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

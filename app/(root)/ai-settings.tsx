import { SheetScreen } from '@/components/Layout/SheetScreen';
import { FontFamily, UIStyles } from '@/constants/DesignSystem';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAppSettings, GreetingStyle } from '@/constants/AppSettingsContext';
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
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';
import { ChipPicker } from '@/components/Common/ChipPicker';


// Greeting style options
const GREETING_STYLES: { id: GreetingStyle; label: string; icon: string; description: string }[] = [
    { id: 'ai', label: 'Echo decides', icon: 'sparkles', description: 'The mix that fits its personality' },
    { id: 'quotes', label: 'Facts & motivation', icon: 'bulb', description: 'Habit science and a push' },
    { id: 'data', label: 'My data', icon: 'analytics', description: 'Only your own progress' },
    { id: 'all', label: 'Everything', icon: 'shuffle', description: 'An even mix of all of it' },
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
        ? 'Built into your iPhone. Ready, nothing to download.'
        : engine === 'llama'
            ? 'On this phone and ready. About 1.2 GB.'
            : isDownloading
                ? `Downloading… ${Math.round(progress)}%`
                : 'Downloads by itself on Wi-Fi (about 1.2 GB). Until then, Habyss uses its built-in rules.';

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
                {status} It reads what you type when you add habits, tasks and goals, and gives Echo fresh things to say. Nothing leaves your phone.
            </Text>
            {isDownloading ? (
                <View style={{ height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${progress}%`, backgroundColor: colors.primary }} />
                </View>
            ) : null}
            {engine === null && !isDownloading && canDownload ? (
                <TouchableOpacity accessibilityRole="button" onPress={download} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                    <Text style={{ color: colors.primary, fontSize: 14, fontFamily: FontFamily.semibold }}>Download now</Text>
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
    const { aiPersonality, setAIPersonality, greetingStyle, setGreetingStyle } = useAppSettings();
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

    const handleSelectGreeting = (style: GreetingStyle) => {
        selectionFeedback();
        setGreetingStyle(style);
    };

    return (
        <SheetScreen title="Echo" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* What Echo sounds like, heard rather than described. */}
                <View style={[styles.sample, { borderColor: colors.border, backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.04)' }]}>
                    <View style={[styles.sampleMark, { backgroundColor: colors.primary + '1f' }]}>
                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.sampleText, { color: colors.textSecondary }]}>
                        “{coachHello(aiPersonality, name)}”
                    </Text>
                </View>

                {/* Every voice stays on screen; only the one in use explains
                    itself, which is the only one describing what Echo does. */}
                <Group title="Voice" hint="How Echo talks to you, everywhere">
                    <ChipPicker
                        options={PERSONALITY_MODES.map(mode => ({
                            id: mode.id,
                            label: mode.name,
                            icon: mode.icon as any,
                            detail: mode.warning ? `${mode.description} · Harsh language` : mode.description,
                        }))}
                        value={aiPersonality}
                        onChange={handleSelectPersonality}
                        accent={colors.primary}
                    />
                </Group>

                <Group title="On Home" hint="A new line every time you open it">
                    <ChipPicker
                        options={GREETING_STYLES.map(style => ({
                            id: style.id,
                            label: style.label,
                            icon: style.icon as any,
                            detail: style.description,
                        }))}
                        value={greetingStyle}
                        onChange={handleSelectGreeting}
                        accent={colors.primary}
                    />
                </Group>

                <Group title="Check-ins" hint={`Your day runs ${day.wake} to ${day.sleep} — set in Notifications`}>
                    <ToggleRow
                        icon="sunny-outline"
                        label="Morning"
                        detail={`What today asks of you, at ${morningCheckIn(day)}`}
                        value={echo.morning}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, morning: value })}
                    />
                    <ToggleRow
                        icon="moon-outline"
                        label="Before bed"
                        detail={`Whatever is still open, at ${eveningCheckIn(day)}`}
                        value={echo.evening}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, evening: value })}
                    />
                    <ToggleRow
                        icon="person-outline"
                        label="Call me by name"
                        detail={name ? `Echo says “${name}”` : 'Set a name in your profile first'}
                        value={echo.useName && !!name}
                        disabled={!name}
                        colors={colors}
                        accent={colors.primary}
                        onChange={(value: boolean) => saveEcho({ ...echo, useName: value })}
                    />
                    <ToggleRow
                        icon="create-outline"
                        label="Echo writes the reminders"
                        detail={hasModel
                            ? 'Each reminder written on your phone, in this voice'
                            : 'Needs the on-device model, below'}
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
                        <Text style={{ color: colors.primary, fontFamily: FontFamily.semibold, fontSize: 14 }}>Manage subscription</Text>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

/** A titled group of rows, as one card, like the Settings tab. */
const Group = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
            {hint ? <Text style={[styles.groupHint, { color: colors.textTertiary }]}>{hint}</Text> : null}
            <View style={[styles.groupCard, { backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.04)', borderColor: colors.border }]}>
                {rows.map((row, index) => (
                    <View key={index}>
                        {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                        {row}
                    </View>
                ))}
            </View>
        </View>
    );
};

const ToggleRow = ({ icon, label, detail, value, disabled, colors, accent, onChange }: any) => (
    <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => onChange(!value)}
        style={[styles.row, disabled && { opacity: 0.5 }]}
    >
        <Ionicons name={icon} size={17} color={value ? accent : colors.textTertiary} />
        <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
            <Text numberOfLines={1} style={[styles.rowDetail, { color: colors.textTertiary }]}>{detail}</Text>
        </View>
        <View style={[styles.switch, { backgroundColor: value ? accent : colors.surfaceTertiary }]}>
            <View style={[styles.knob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
        </View>
    </TouchableOpacity>
);

/** A time the user can change, in the phone's own picker. */
const styles = StyleSheet.create({
    sample: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 6 },
    sampleMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    sampleText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, fontStyle: 'italic' },
    group: { marginTop: 22 },
    groupTitle: { fontSize: 11, letterSpacing: 1.2, fontFamily: FontFamily.medium, marginLeft: 4 },
    groupHint: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 3, marginBottom: 8, marginLeft: 4 },
    groupCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 15, fontFamily: FontFamily.regular },
    rowDetail: { fontSize: 12, fontFamily: FontFamily.regular },
    rowValue: { fontSize: 14, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    switch: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
    knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    manage: { marginTop: 28, alignItems: 'center' },
    container: { flex: 1 },
    content: { ...UIStyles.screenContent },
    sectionTitle: UIStyles.sectionTitle,
    sectionDesc: UIStyles.sectionDescription,
    // 2x2 Grid for personalities
    emoji: { fontSize: 24 },
    // Greeting style cards
});

export default AISettings;

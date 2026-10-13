import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { FontFamily, surfaceFor } from '@/constants/DesignSystem';
import { ms, s, vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { ALL_SHARED, SHARING_LABELS, getSharing, setSharing, type Sharing } from '@/lib/profileSync';
import { PREF_LABELS, getNotificationPrefs, setNotificationPrefs, type NotificationPrefs } from '@/lib/notificationPrefs';
import { styles } from '@/styles/screens/sharing.styles';

/**
 * What friends see of you, and what they are allowed to interrupt you about.
 *
 * Two lists rather than one switch. "Everything or nothing" is not a privacy
 * setting, it is an ultimatum — somebody may happily show their streak and
 * never their face, and there is no reason the app should make them choose.
 *
 * Turning something off takes it off the server too, rather than hiding it in
 * an interface that might be older than the switch.
 */
export default function SharingScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    const [sharing, setSharingState] = useState<Sharing | null>(null);
    const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

    useEffect(() => {
        let alive = true;
        Promise.all([getSharing(), getNotificationPrefs()])
            .then(([found, told]) => { if (alive) { setSharingState(found); setPrefs(told); } })
            .catch(() => { if (alive) setSharingState(ALL_SHARED); });
        return () => { alive = false; };
    }, []);

    const flip = useCallback(async (key: keyof Sharing, value: boolean) => {
        selectionFeedback();
        setSharingState(current => (current ? { ...current, [key]: value } : current));
        setSharingState(await setSharing({ [key]: value }));
    }, [selectionFeedback]);

    const tell = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
        selectionFeedback();
        setPrefs(current => (current ? { ...current, [key]: value } : current));
        setPrefs(await setNotificationPrefs({ [key]: value }));
    }, [selectionFeedback]);

    if (!sharing || !prefs) {
        return (
            <SheetScreen title="Sharing" onBack={() => router.back()}>
                <ActivityIndicator color={accent} style={{ marginTop: vs(40) }} />
            </SheetScreen>
        );
    }

    return (
        <SheetScreen title="Sharing" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>WHAT FRIENDS SEE</Text>
                <Text style={[styles.groupNote, { color: colors.textTertiary }]}>
                    Turning one off removes it from the server, not just from the screen.
                </Text>
                <VoidCard matte style={styles.list}>
                    {SHARING_LABELS.map((item, index) => (
                        <View key={item.id}>
                            {index > 0 ? <View style={[styles.divider, { backgroundColor: tone.line }]} /> : null}
                            <View style={styles.row}>
                                <View style={styles.rowText}>
                                    <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                                    <Text style={[styles.detail, { color: colors.textSecondary }]}>{item.detail}</Text>
                                </View>
                                <Switch
                                    value={sharing[item.id]}
                                    onValueChange={value => void flip(item.id, value)}
                                    trackColor={{ false: tone.raised, true: accent }}
                                    accessibilityLabel={item.label}
                                />
                            </View>
                        </View>
                    ))}
                </VoidCard>

                <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>WHAT YOU ARE TOLD</Text>
                <Text style={[styles.groupNote, { color: colors.textTertiary }]}>
                    Separate from your reminders: those are the app talking to you about your own day.
                </Text>
                <VoidCard matte style={styles.list}>
                    {PREF_LABELS.map((item, index) => (
                        <View key={item.id}>
                            {index > 0 ? <View style={[styles.divider, { backgroundColor: tone.line }]} /> : null}
                            <View style={styles.row}>
                                <View style={styles.rowText}>
                                    <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
                                    <Text style={[styles.detail, { color: colors.textSecondary }]}>{item.detail}</Text>
                                </View>
                                <Switch
                                    value={prefs[item.id]}
                                    onValueChange={value => void tell(item.id, value)}
                                    trackColor={{ false: tone.raised, true: accent }}
                                    accessibilityLabel={item.label}
                                />
                            </View>
                        </View>
                    ))}
                </VoidCard>

                <View style={styles.note}>
                    <Ionicons name="lock-closed-outline" size={s(13)} color={colors.textTertiary} />
                    <Text style={[styles.noteText, { color: colors.textTertiary }]}>
                        Only people you have accepted as friends can see any of this, and a habit’s
                        name only ever reaches somebody you have shared that habit with.
                    </Text>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

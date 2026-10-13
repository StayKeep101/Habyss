import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { INTEGRATIONS, ROUTE_LABEL, type Integration } from '@/lib/integrations';
import { HEALTH_METRICS } from '@/lib/healthMetrics';
import { HealthKitService } from '@/lib/HealthKitService';
import { syncHealthKitData } from '@/lib/habitsSQLite';
import { styles } from '@/styles/screens/integrations.styles';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * What can fill a habit in for you.
 *
 * Written around the one fact that matters and is easy to miss: on iOS, Apple
 * Health is a hub rather than another app. Garmin, Whoop, Oura, Strava, Peloton
 * and the rest all write into it, so connecting Health once connects every
 * device somebody already owns — and this screen says so plainly instead of
 * listing a dozen logos it cannot actually reach.
 *
 * The ones that genuinely cannot be reached are listed too, with what it would
 * take. A screen that quietly omits them reads as a screen that is finished.
 */
export default function IntegrationsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();
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

    const groups: { title: string; note?: string; items: Integration[] }[] = [
        {
            title: 'THE HUB',
            note: 'One prompt. Everything below writes into it.',
            items: INTEGRATIONS.filter(item => item.route === 'direct'),
        },
        {
            title: 'THROUGH APPLE HEALTH',
            note: 'Already connected if the app is set to share with Health. Nothing to do here.',
            items: INTEGRATIONS.filter(item => item.route === 'health'),
        },
        {
            title: 'NO SENSOR CAN SEE IT',
            note: 'Run the timer and the check-in counts as backed rather than taken on your word.',
            items: INTEGRATIONS.filter(item => item.route === 'timer'),
        },
        {
            title: 'NOT YET',
            note: 'Each of these needs something Habyss does not have: a server, or a permission Apple grants case by case.',
            items: INTEGRATIONS.filter(item => item.route === 'needsServer' || item.route === 'needsEntitlement'),
        },
    ];

    return (
        <SheetScreen title="Integrations" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View layout={MORPH}>
                    <VoidCard matte style={styles.hero}>
                        <View style={styles.heroTop}>
                            <View style={[styles.heroIcon, { backgroundColor: tone.raised }]}>
                                <Ionicons name="heart" size={s(19)} color="#FF4757" />
                            </View>
                            <View style={styles.heroText}>
                                <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Apple Health</Text>
                                <Text style={[styles.heroLine, { color: colors.textSecondary }]}>
                                    {connected
                                        ? `Reading ${HEALTH_METRICS.length} kinds of thing.`
                                        : 'Let Habyss read what your watch already knows.'}
                                </Text>
                            </View>
                            {busy
                                ? <ActivityIndicator color={accent} />
                                : <Switch
                                    value={connected}
                                    onValueChange={value => { lightFeedback(); void connect(value); }}
                                    trackColor={{ false: tone.raised, true: accent }}
                                    accessibilityLabel="Connect Apple Health"
                                />}
                        </View>

                        {filled !== null ? (
                            <Animated.Text entering={FadeIn.duration(200)} style={[styles.filled, { color: colors.success }]}>
                                {filled === 0
                                    ? 'Nothing to fill in yet — link a habit to a metric in its Measure row.'
                                    : `Filled in ${filled} habit${filled === 1 ? '' : 's'} just now.`}
                            </Animated.Text>
                        ) : null}
                    </VoidCard>
                </Animated.View>

                {groups.map(group => group.items.length === 0 ? null : (
                    <View key={group.title} style={styles.group}>
                        <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>{group.title}</Text>
                        {group.note ? (
                            <Text style={[styles.groupNote, { color: colors.textTertiary }]}>{group.note}</Text>
                        ) : null}

                        <VoidCard matte style={styles.list}>
                            {group.items.map((item, index) => (
                                <View key={item.id}>
                                    {index > 0 ? <View style={[styles.divider, { backgroundColor: tone.line }]} /> : null}
                                    <View style={styles.row}>
                                        <View style={[styles.icon, { backgroundColor: tone.raised }]}>
                                            <Ionicons name={item.icon} size={s(16)} color={colors.textSecondary} />
                                        </View>
                                        <View style={styles.rowText}>
                                            <Text style={[styles.name, { color: colors.textPrimary }]}>{item.name}</Text>
                                            <Text style={[styles.covers, { color: colors.textSecondary }]}>{item.covers}</Text>
                                            {item.step ? (
                                                <Text style={[styles.step, { color: colors.textTertiary }]}>{item.step}</Text>
                                            ) : null}
                                        </View>
                                        <Text style={[styles.route, {
                                            color: item.route === 'needsServer' || item.route === 'needsEntitlement'
                                                ? colors.textTertiary : colors.success,
                                        }]}>
                                            {item.route === 'direct' ? (connected ? 'On' : ROUTE_LABEL[item.route]) : ROUTE_LABEL[item.route]}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </VoidCard>
                    </View>
                ))}

                <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                    A habit reads from Health once you pick a metric in its Measure row. Anything filled in
                    this way counts as verified to your friends, which is what makes a pact worth making.
                </Text>
            </ScrollView>
        </SheetScreen>
    );
}

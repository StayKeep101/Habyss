import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { setGateOn, useAppGate } from '@/lib/appGate';
import { nightBlockSupported, setBedtimeLock, useBedtimeLock } from '@/lib/bedtimeLock';
import { useFocusBlocking } from '@/lib/focusBlocking';
import { currentLock, type LockState } from '@/lib/gateLock';
import { lockLabel, throughLock } from '@/lib/gateLockPrompt';
import { cachedDayWindow, DEFAULT_DAY, getDayWindow, minutesOf } from '@/lib/echo';
import { clockLabel } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/app-blocking.styles';

const NOT_AVAILABLE = ['Screen Time not available', 'Allow Habyss in Settings → Screen Time, or update to the newest version of Habyss, then try again.'] as const;

/**
 * Everything that blocks apps, in one place: the one list of apps they all
 * block, then each way of blocking them. Earn your scroll and the Bedtime lock
 * are hard locks (lib/gateLock.ts); their state is shown at the bottom.
 */
export default function AppBlockingScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const gate = useAppGate();
    const bedtimeLock = useBedtimeLock();
    const focusBlocking = useFocusBlocking();
    const [day, setDay] = useState(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay); }, []);
    const [lock, setLock] = useState<LockState>({ kind: 'locked' });
    const readLock = useCallback(() => { void currentLock().then(setLock); }, []);
    useEffect(readLock, [readLock]);
    const hardLocked = gate.on || bedtimeLock;

    const pickApps = () => {
        lightFeedback();
        const pick = () => ScreenTimeService.chooseApps().then(ok => { if (!ok) Alert.alert(...NOT_AVAILABLE); });
        // While a hard lock is on, the list is behind it.
        if (hardLocked) void throughLock(pick, readLock); else void pick();
    };

    return (
        <SheetScreen title="App blocking" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* The one list every kind of blocking below uses. */}
                <SettingsGroup title="Apps">
                    <SettingsRow icon="apps" color={t.color.danger} label="Apps to block" value="Used by all below" onPress={pickApps} />
                </SettingsGroup>

                <SettingsGroup title="Blocked">
                    {/* Earn your scroll (lib/appGate.ts): blocked until today's top 3 are done. */}
                    {ScreenTimeService.gateSupported() ? (
                        <SettingsRow icon="lock-closed" color={t.color.danger} label="Until my top 3 are done"
                            toggle={gate.on} onToggle={value => {
                                lightFeedback();
                                if (!value) { void throughLock(() => setGateOn(false), readLock); return; }
                                void ScreenTimeService.hasSelectedApps().then(async chosen => {
                                    if (!chosen && !(await ScreenTimeService.chooseApps())) { Alert.alert(...NOT_AVAILABLE); return; }
                                    await setGateOn(true);
                                });
                            }} />
                    ) : null}
                    {gate.on ? (
                        <SettingsRow icon="diamond" color={t.color.danger} label="Today's top 3"
                            value={gate.view?.earned ? 'Earned' : `${gate.view?.top.filter(item => item.done).length ?? 0} of ${gate.view?.top.length ?? 3} done`}
                            onPress={() => router.push('/(root)/unlock' as never)} />
                    ) : null}
                    {/* Bedtime lock (lib/bedtimeLock.ts): from bedtime to wake, Habyss sleeps and the apps are blocked. */}
                    <SettingsRow icon="moon" color={t.color.accent} label="At bedtime"
                        toggle={bedtimeLock} onToggle={value => {
                            lightFeedback();
                            if (!value) { void throughLock(() => setBedtimeLock(false), readLock); return; }
                            if (!nightBlockSupported()) { void setBedtimeLock(true); return; }
                            void ScreenTimeService.hasSelectedApps().then(async chosen => {
                                if (!chosen) await ScreenTimeService.chooseApps();
                                await setBedtimeLock(true);
                            });
                        }} />
                    {/* The hours come from Day & calendar: shown here, changed there. */}
                    <SettingsRow icon="time" color={t.color.accent} label="Bedtime hours"
                        value={`${clockLabel(minutesOf(day.sleep))} – ${clockLabel(minutesOf(day.wake))}`} onPress={() => router.push('/(root)/meals' as never)} />
                    <SettingsRow icon="hand-left" color={t.color.danger} label="While focusing" value={focusBlocking ? 'On' : 'Off'}
                        onPress={() => router.push('/(root)/focus-settings' as never)} />
                </SettingsGroup>

                {/* Turning a hard lock off, or changing the apps, waits a day after asking. */}
                {hardLocked ? (
                    <SettingsGroup title="Hard lock">
                        <SettingsRow icon="key" color={t.color.textMuted} label="To change anything" value={lockLabel(lock)}
                            onPress={lock.kind === 'open' ? undefined : () => void throughLock(async () => undefined, readLock)} />
                    </SettingsGroup>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

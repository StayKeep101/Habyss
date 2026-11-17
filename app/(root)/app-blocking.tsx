import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { GATE_PRICE } from '@/lib/appGate';
import { setBedtimeLock, useBedtimeLock } from '@/lib/bedtimeLock';
import { askToUnlock, currentLock, relock, timeLeft, type LockState } from '@/lib/gateLock';
import { styles } from '@/styles/screens/app-blocking.styles';

const NOT_AVAILABLE = ['Screen Time not available', 'Allow Habyss in Settings → Screen Time, then try again.'] as const;

/**
 * App blocking: the apps you choose are always blocked, and only Shards open
 * them (an hour for 100, lib/appGate.ts). Adding apps is instant; removing one
 * waits 24 hours, then gives one hour (lib/gateLock.ts). At bedtime every app
 * is blocked; calls and emergencies always work.
 */
export default function AppBlockingScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const bedtime = useBedtimeLock();
    const [lock, setLock] = useState<LockState>({ kind: 'locked' });
    const [, tick] = useState(0);
    const readLock = useCallback(() => { void currentLock().then(setLock); }, []);
    useEffect(() => {
        readLock();
        // The countdown on the row moves, and the hour closes by itself.
        const timer = setInterval(() => { tick(n => n + 1); readLock(); }, 30_000);
        return () => clearInterval(timer);
    }, [readLock]);
    const open = lock.kind === 'open';

    const ask = (why: string) => Alert.alert('Wait 24 hours?', `${why} In 24 hours you get one hour to do it. Then it locks again.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start the wait', onPress: () => { void askToUnlock().then(setLock); } },
    ]);

    const pick = (allowRemoval: boolean) => {
        lightFeedback();
        void ScreenTimeService.pickApps(allowRemoval).then(result => {
            if (result === 'denied') Alert.alert(...NOT_AVAILABLE);
            if (result === 'held') ask('Your new apps are blocked, but apps you took off stay blocked: removing waits.');
            if (result === 'needsWindow') ask('On this version of Habyss, changing the list waits. The next update lets you add apps at once.');
        });
    };

    const removeRow = () => {
        lightFeedback();
        if (open) { pick(true); return; }
        if (lock.kind === 'waiting') {
            Alert.alert('Removing opens soon', `In ${timeLeft(lock.opensAt)}. You'll get a notification.`, [
                { text: 'Cancel the wait', style: 'destructive', onPress: () => { void relock().then(readLock); } },
                { text: 'OK', style: 'cancel' },
            ]);
            return;
        }
        ask('Removing apps takes patience.');
    };

    const bedtimeToggle = (value: boolean) => {
        lightFeedback();
        if (value) {
            void ScreenTimeService.requestAuthorization().then(() => setBedtimeLock(true));
            return;
        }
        if (open) { void setBedtimeLock(false); return; }
        if (lock.kind === 'waiting') { Alert.alert('Not yet', `You can turn this off in ${timeLeft(lock.opensAt)}.`); return; }
        ask('Turning this off takes patience.');
    };

    const removeValue = open ? `Open · ${timeLeft(lock.closesAt)} left`
        : lock.kind === 'waiting' ? `Opens in ${timeLeft(lock.opensAt)}` : '24h wait';

    return (
        <SheetScreen title="App blocking" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Blocked apps">
                    <SettingsRow icon="add-circle" color={t.color.danger} label="Add apps" value="Instant" onPress={() => pick(open)} />
                    <SettingsRow icon="remove-circle" color={t.color.textMuted} label="Remove apps" value={removeValue} onPress={removeRow} />
                    {lock.kind !== 'locked' ? (
                        <SettingsRow icon="lock-closed" color={t.color.textMuted} label={open ? 'Lock now' : 'Cancel the wait'}
                            onPress={() => { lightFeedback(); void relock().then(readLock); }} />
                    ) : null}
                </SettingsGroup>

                <SettingsGroup title="Unlock">
                    <SettingsRow icon="diamond" color={t.color.accent} label="1 hour of your apps" value={`${GATE_PRICE} Shards`}
                        onPress={() => router.push('/(root)/unlock' as never)} />
                </SettingsGroup>

                <SettingsGroup title="Bedtime">
                    <SettingsRow icon="moon" color={t.color.accent} label="Block every app" keywords="sleep night calls emergency"
                        toggle={bedtime} onToggle={bedtimeToggle} />
                </SettingsGroup>
            </ScrollView>
        </SheetScreen>
    );
}

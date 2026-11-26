import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { HoldButton } from '@/components/ui/HoldButton';
import { UnlockCountdown } from '@/components/Blocking/UnlockCountdown';
import { Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { buyScrollHour, GATE_MINUTES, GATE_PRICE } from '@/lib/appGate';
import { setBedtimeLock, useBedtimeLock } from '@/lib/bedtimeLock';
import { relock } from '@/lib/gateLock';
import { styles } from '@/styles/screens/app-blocking.styles';

/** How long iOS takes to close a page sheet (the system's own animation, not ours). */
const IOS_SHEET_CLOSE_MS = 650;

const NOT_AVAILABLE = ['Screen Time not available', 'Allow Habyss in Settings → Screen Time, then try again.'] as const;

/**
 * App blocking: the apps you choose are always blocked, and only Shards open
 * them (an hour for 100, lib/appGate.ts). Adding and removing apps are both
 * instant, as is turning the bedtime block off (no wait). At bedtime every app
 * is blocked; calls and emergencies always work.
 */
export default function AppBlockingScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const bedtime = useBedtimeLock();
    // No wait to loosen the block any more: whatever was asked for before is cleared.
    useEffect(() => { void relock(); }, []);
    // An hour of your apps, right here: hold, pay 100 Shards, open.
    const [shards, setShards] = useState<number | null>(null);
    const [openUntil, setOpenUntil] = useState(0);
    const [buying, setBuying] = useState(false);
    const readWallet = useCallback(() => {
        void (require('@/lib/wallet') as typeof import('@/lib/wallet')).myWallet().then(wallet => setShards(wallet.spendable), () => undefined);
        void ScreenTimeService.gateOpenUntil().then(at => setOpenUntil(at * 1000));
    }, []);
    useEffect(readWallet, [readWallet]);
    const unlocked = openUntil > Date.now();
    const buy = () => {
        if (buying) return;
        setBuying(true);
        buyScrollHour()
            .then(at => { setOpenUntil(at); readWallet(); })
            .catch((error: unknown) => Alert.alert('No hour bought', error instanceof Error ? error.message : 'Please try again.'))
            .finally(() => setBuying(false));
    };

    const pick = (allowRemoval: boolean) => {
        lightFeedback();
        // A build without the guarded picker presents it from the app's root, which iOS refuses
        // while this page (itself a sheet) is up: close the page first, then open the picker.
        if (!ScreenTimeService.guardedPickerSupported()) {
            router.back();
            setTimeout(() => {
                void ScreenTimeService.pickApps(allowRemoval).then(result => { if (result === 'denied') Alert.alert(...NOT_AVAILABLE); });
            }, IOS_SHEET_CLOSE_MS);
            return;
        }
        void ScreenTimeService.pickApps(allowRemoval).then(result => {
            if (result === 'denied') Alert.alert(...NOT_AVAILABLE);

        });
    };


    const bedtimeToggle = (value: boolean) => {
        lightFeedback();
        if (value) {
            void ScreenTimeService.requestAuthorization().then(() => setBedtimeLock(true));
            return;
        }
        void setBedtimeLock(false);
    };

    return (
        <SheetScreen title="App blocking" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="Blocked apps">
                    <SettingsRow icon="add-circle" color={t.color.danger} label="Add apps" onPress={() => pick(true)} />
                    <SettingsRow icon="remove-circle" color={t.color.textMuted} label="Remove apps" onPress={() => pick(true)} />
                </SettingsGroup>

                <SettingsGroup title="Bedtime">
                    <SettingsRow icon="moon" color={t.color.accent} label="Block every app" keywords="sleep night calls emergency"
                        toggle={bedtime} onToggle={bedtimeToggle} />
                </SettingsGroup>

                {/* The only way in: hold to spend Shards on an hour, right here. */}
                <View style={styles.unlock}>
                    {unlocked ? (
                        <UnlockCountdown until={openUntil} length={GATE_MINUTES * 60_000} onEnd={() => { setOpenUntil(0); readWallet(); }} />
                    ) : (
                        <HoldButton label={`Hold to unlock ${GATE_MINUTES / 60} hour · ${GATE_PRICE}`} icon="shard" loading={buying}
                            disabled={shards !== null && shards < GATE_PRICE} onComplete={buy} />
                    )}
                    <Text variant="caption" tone="muted" align="center">
                        {shards === null ? 'Finish habits and tasks to earn Shards.'
                            : unlocked ? `You have ${shards} Shards.`
                            : shards < GATE_PRICE ? `You have ${shards} Shards. Go earn the rest. The apps will wait.`
                                : `You have ${shards} Shards. One hour, then they lock again.`}
                    </Text>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

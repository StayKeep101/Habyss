import { useEffect, useState } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { HoldButton } from '@/components/ui/HoldButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Receipt } from '@/components/ui/Receipt';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { buyScrollHour, GATE_MINUTES, GATE_PRICE } from '@/lib/appGate';
import { clockLabel } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/unlock.styles';
import { Control } from '@/theme/designSystem';

/**
 * Where a blocked app sends you (the block screen's notification), or App
 * blocking. Your apps open only with Shards: an hour for 100 (tap the card,
 * then hold to mean it). Shards come from finishing habits, tasks and goals.
 */
export default function Unlock() {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const [busy, setBusy] = useState(false);
    const [paying, setPaying] = useState(false);
    const [until, setUntil] = useState<number | null>(null);
    const [shards, setShards] = useState<number | null>(null);
    useEffect(() => {
        void (require('@/lib/market') as typeof import('@/lib/market')).myWallet()
            .then(wallet => setShards(wallet.spendable), () => undefined);
    }, []);
    const close = () => router.back();
    const work = () => router.replace('/(root)/(tabs)/roadmap' as never);

    const buy = async () => {
        if (busy) return;
        setBusy(true);
        try { setUntil(await buyScrollHour()); }
        catch (error) { Alert.alert('No hour bought', error instanceof Error ? error.message : 'Please try again.'); }
        finally { setBusy(false); }
    };

    if (until !== null) {
        const at = new Date(until);
        return (
            <SheetScreen title="" onBack={close}>
                <Receipt title="An hour of your apps" amount={-GATE_PRICE} line={`Open until ${clockLabel(at.getHours() * 60 + at.getMinutes())}`} onDone={close} />
            </SheetScreen>
        );
    }

    const short = shards !== null && shards < GATE_PRICE;
    return (
        <SheetScreen title="" onBack={close}>
            <ScrollView contentContainerStyle={[styles.content, { gap: t.space['2xl'] }]}>
                <View style={{ gap: t.space.md }}>
                    <View style={[styles.row, { gap: t.space.sm }]}>
                        <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                        <Text style={[t.type.caption, styles.eyebrow, { color: t.color.textMuted }]}>FOCUS GATE</Text>
                    </View>
                    <View style={{ gap: t.space.xs }}>
                        <Text style={[t.type.screenTitle, { color: t.color.textPrimary }]} accessibilityRole="header">Earn your scroll</Text>
                        <Text style={[t.type.body, { color: t.color.textMuted }]}>
                            Your apps open only with Shards. Finish habits, tasks and goals to earn them.
                        </Text>
                    </View>
                </View>

                <View style={{ gap: t.space.md }}>
                    <Pressable onPress={() => { selectionFeedback(); setPaying(open => !open); }}
                        accessibilityRole="button" accessibilityLabel={`${GATE_PRICE} Shards, unlock 1 hour${shards !== null ? `. You have ${shards}` : ''}`} accessibilityState={{ expanded: paying }}>
                        <MatteSurface radius={t.radius.md} level="control" style={[styles.row, styles.shards, { gap: t.space.md }]}>
                            <ShardIcon size={Control.icon + t.space.xs} />
                            <Text style={[t.type.heading, styles.title, { color: t.color.textPrimary }]} numberOfLines={1}>
                                {GATE_PRICE} Shards <Text style={[t.type.body, { color: t.color.textMuted }]}>· Unlock 1 hour</Text>
                            </Text>
                            <AppIcon name={paying ? 'chevron-down' : 'chevron-forward'} size={Control.icon} color={t.color.textMuted} />
                        </MatteSurface>
                    </Pressable>
                    {paying ? (short
                        ? <Text style={[t.type.body, styles.center, { color: t.color.textMuted }]}>You have {shards}. Finish something to earn the rest.</Text>
                        : <HoldButton label={`Hold to spend ${GATE_PRICE} Shards`} icon="shard" loading={busy} onComplete={() => void buy()} />) : null}
                    <AppButton label="Earn Shards" variant={paying && !short ? 'default' : 'primary'} onPress={work} />
                </View>

                <Text style={[t.type.caption, styles.center, { color: t.color.textMuted }]}>
                    {shards !== null ? `You have ${shards} Shards. ` : ''}Access locks again after {GATE_MINUTES} minutes.
                </Text>
            </ScrollView>
        </SheetScreen>
    );
}

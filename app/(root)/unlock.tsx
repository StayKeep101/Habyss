import { useState } from 'react';
import { ShardIcon } from '@/components/ui/ShardIcon';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { HoldButton } from '@/components/ui/HoldButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { Receipt } from '@/components/ui/Receipt';
import { StepTrack } from '@/components/ui/StepTrack';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { buyScrollHour, GATE_MINUTES, GATE_PRICE, useAppGate } from '@/lib/appGate';
import { clockLabel } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/unlock.styles';
import { Control } from '@/theme/designSystem';

/**
 * The Focus Gate: where a blocked app sends you (the block screen's
 * notification), or Settings. Today's top 3 as steps to earn your apps back,
 * a way straight to them, and an hour for Shards (tap the card, then hold to
 * mean it). Done with all three: "You earned it".
 */
export default function Unlock() {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const { on, view } = useAppGate();
    const [busy, setBusy] = useState(false);
    const [paying, setPaying] = useState(false);
    const [until, setUntil] = useState<number | null>(null);
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

    const earned = !!view?.earned;
    const top = view?.top ?? [];
    const done = top.filter(item => item.done).length;
    const line = earned ? 'Your top 3 are done. Your apps are open until midnight.'
        : !on ? 'Earn your scroll is off in Settings.'
        : view && view.planned === 0 ? 'Nothing is planned today. Add what matters, then finish your top 3.'
        : 'Finish your priorities, or spend Shards for an hour.';

    return (
        <SheetScreen title="" onBack={close}>
            <ScrollView contentContainerStyle={[styles.content, { gap: t.space['2xl'] }]}>
                <View style={{ gap: t.space.md }}>
                    <View style={[styles.row, { gap: t.space.sm }]}>
                        <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                        <Text style={[t.type.caption, styles.eyebrow, { color: t.color.textMuted }]}>FOCUS GATE</Text>
                    </View>
                    <View style={{ gap: t.space.xs }}>
                        <Text style={[t.type.screenTitle, { color: t.color.textPrimary }]} accessibilityRole="header">
                            {earned ? 'You earned it' : 'Earn your scroll'}
                        </Text>
                        <Text style={[t.type.body, { color: t.color.textMuted }]}>{line}</Text>
                    </View>
                </View>

                {top.length ? (
                    <View style={{ gap: t.space.lg }}>
                        <View style={[styles.row, styles.between]}>
                            <Text style={[t.type.heading, { color: t.color.textPrimary }]}>
                                {done} / {top.length} <Text style={[t.type.body, { color: t.color.textMuted }]}>complete</Text>
                            </Text>
                            <StepTrack done={top.map(item => item.done)} label="Your top 3" />
                        </View>
                        <View style={{ gap: t.space.md }}>
                            {top.map(item => (
                                <View key={item.id} style={[styles.row, { gap: t.space.md, minHeight: Control.hitTarget }]}
                                    accessible accessibilityLabel={`${item.title}, ${item.done ? 'done' : 'not done yet'}`}>
                                    <AppIcon name={item.done ? 'checkmark-circle' : 'ellipse-outline'} filled={item.done} size={Control.icon + t.space.xs}
                                        color={item.done ? t.color.accent : t.color.accentText} />
                                    <Text numberOfLines={1} style={[t.type.body, styles.title, { color: item.done ? t.color.textMuted : t.color.textPrimary }]}>{item.title}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {earned ? <AppButton label="Done" variant="primary" onPress={close} /> : (
                    <View style={{ gap: t.space.md }}>
                        <AppButton label={view && view.planned === 0 ? 'Plan your day' : 'Work on priorities'} variant="primary" onPress={work} />
                        {on ? (
                            <Pressable onPress={() => { selectionFeedback(); setPaying(open => !open); }}
                                accessibilityRole="button" accessibilityLabel={`${GATE_PRICE} Shards, unlock 1 hour`} accessibilityState={{ expanded: paying }}>
                                <MatteSurface radius={t.radius.md} level="control" style={[styles.row, styles.shards, { gap: t.space.md }]}>
                                    <ShardIcon size={Control.icon + t.space.xs} />
                                    <Text style={[t.type.heading, styles.title, { color: t.color.textPrimary }]} numberOfLines={1}>
                                        {GATE_PRICE} Shards <Text style={[t.type.body, { color: t.color.textMuted }]}>· Unlock 1 hour</Text>
                                    </Text>
                                    <AppIcon name={paying ? 'chevron-down' : 'chevron-forward'} size={Control.icon} color={t.color.textMuted} />
                                </MatteSurface>
                            </Pressable>
                        ) : null}
                        {on && paying ? <HoldButton label={`Hold to spend ${GATE_PRICE} Shards`} icon="shard" loading={busy} onComplete={() => void buy()} /> : null}
                    </View>
                )}

                {!earned && on ? (
                    <Text style={[t.type.caption, styles.center, { color: t.color.textMuted }]}>Access locks again after {GATE_MINUTES} minutes.</Text>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}

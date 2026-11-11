import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { HoldButton } from '@/components/ui/HoldButton';
import { Receipt } from '@/components/ui/Receipt';
import { useTokens } from '@/hooks/useTokens';
import { buyScrollHour, GATE_PRICE, useAppGate } from '@/lib/appGate';
import { clockLabel } from '@/lib/dayFlow';
import { styles } from '@/styles/screens/unlock.styles';
import { Control } from '@/theme/designSystem';

/**
 * Opened from the block screen's "Spend 100 Shards" (its notification), or from
 * Settings: today's top 3, and an hour of your apps for 100 Shards, held to
 * mean it. Done with all three: "You earned it".
 */
export default function Unlock() {
    const t = useTokens();
    const { on, view } = useAppGate();
    const [busy, setBusy] = useState(false);
    const [until, setUntil] = useState<number | null>(null);
    const close = () => router.back();

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
            <SheetScreen title="Your apps" onBack={close}>
                <Receipt title="An hour of your apps" amount={-GATE_PRICE} line={`Open until ${clockLabel(at.getHours() * 60 + at.getMinutes())}`} onDone={close} />
            </SheetScreen>
        );
    }

    const earned = !!view?.earned;
    return (
        <SheetScreen title="Your apps" onBack={close}>
            <ScrollView contentContainerStyle={[styles.content, { gap: t.space.lg }]}>
                <View style={{ gap: t.space.xs }}>
                    <Text style={[t.type.title, { color: t.color.textPrimary }]}>{earned ? 'You earned it' : 'Finish your top 3 first'}</Text>
                    <Text style={[t.type.body, { color: t.color.textMuted }]}>
                        {earned ? 'Your top 3 are done. Your apps are open until midnight.'
                            : !on ? 'Earn your scroll is off in Settings.'
                            : view && view.planned === 0 ? 'Nothing is planned today. Add what matters, then finish your top 3.'
                            : 'They open the moment these are done.'}
                    </Text>
                </View>

                {view?.top.length ? (
                    <View style={{ gap: t.space.md }}>
                        {view.top.map(item => (
                            <View key={item.id} style={[styles.row, { gap: t.space.md }]}
                                accessible accessibilityLabel={`${item.title}, ${item.done ? 'done' : 'not done yet'}`}>
                                <AppIcon name={item.done ? 'checkmark-circle' : 'ellipse-outline'} filled={item.done} size={Control.icon}
                                    color={item.done ? t.color.success : t.color.textSubtle} />
                                <Text numberOfLines={1} style={[t.type.body, styles.title, { color: item.done ? t.color.textMuted : t.color.textPrimary }]}>{item.title}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {earned ? <AppButton label="Done" onPress={close} /> : (
                    <View style={{ gap: t.space.sm }}>
                        {on ? <HoldButton label={`Hold to spend ${GATE_PRICE} Shards · 1 hour`} icon="diamond" loading={busy} onComplete={() => void buy()} /> : null}
                        <AppButton label="Not now" variant="ghost" onPress={close} />
                    </View>
                )}
            </ScrollView>
        </SheetScreen>
    );
}

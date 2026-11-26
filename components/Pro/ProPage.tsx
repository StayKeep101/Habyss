import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, AppIcon, IconButton, Text, VoidCard } from '@/components/ui';
import { Control, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { usePro } from '@/hooks/usePro';
import { PRO, buyPro, canBuyPro, manageSubscription, proStatusLine, restorePro } from '@/lib/access';
import { currentAccount, knownAccount, onAccountChange } from '@/lib/account';

/** What Pro gives, in three lines: the phone and the desktop app as one. */
const PERKS = [
    { icon: 'sync', line: 'Your phone and the desktop app, always in step' },
    { icon: 'desktop', line: 'Plan on the big screen, act from your pocket' },
    { icon: 'layers', line: 'Habits, tasks and focus, the same everywhere' },
] as const;

/**
 * Habyss Pro: the one thing for sale. Everything else is free, on the phone
 * and on the computer; Pro keeps the two in sync (lib/access.ts).
 *
 * Said plainly before anyone pays (App Store Guideline 3.1.2): the name, the
 * price per month in their currency, that it renews until cancelled and
 * where to cancel, the terms and the privacy policy, restore. Pro needs an
 * account, since the sync runs through it, so signed out the button signs in.
 */
export function ProPage({ onClose }: { onClose: () => void }) {
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const { successFeedback, lightFeedback } = useHaptics();
    const pro = usePro();
    const [price, setPrice] = useState<string>(PRO.fallbackPrice);
    const [signedIn, setSignedIn] = useState<boolean | null>(() => { const known = knownAccount(); return known === undefined ? null : !!known; });
    const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const available = canBuyPro();

    // The store's own price, in the person's currency.
    useEffect(() => {
        if (!available) return;
        const service = (require('@/lib/RevenueCat') as typeof import('@/lib/RevenueCat')).default;
        void service.getSubscription(PRO.product).then(product => { if (product?.priceString) setPrice(product.priceString); });
    }, [available]);
    useEffect(() => {
        void currentAccount().then(account => setSignedIn(!!account)).catch(() => setSignedIn(false));
        return onAccountChange(account => setSignedIn(!!account));
    }, []);

    const subscribe = async () => {
        setBusy('buy'); setNote(null);
        const result = await buyPro();
        setBusy(null);
        if (result === 'bought') successFeedback();
        if (result === 'failed') setNote('The App Store couldn’t be reached. Nothing was charged. Try again in a moment.');
    };
    const bringBack = async () => {
        lightFeedback();
        setBusy('restore'); setNote(null);
        const found = await restorePro();
        setBusy(null);
        if (found) successFeedback(); else setNote('No Habyss Pro subscription was found for this Apple ID.');
    };

    const on = pro.kind === 'pro';
    const status = proStatusLine(pro);

    return (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.color.background }]}>
            <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
                <IconButton icon="close" label="Close" onPress={onClose} />
            </View>
            <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.lg }]} showsVerticalScrollIndicator={false}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text variant="screenTitle" align="center" accessibilityRole="header">Habyss Pro</Text>
                <Text variant="body" tone="muted" align="center">Habyss is free, on your phone and on your computer. Pro keeps the two in sync.</Text>

                <VoidCard style={styles.perks}>
                    {PERKS.map(perk => (
                        <View key={perk.icon} style={styles.perk}>
                            <AppIcon name={perk.icon} filled size={Control.icon} color={t.color.accent} />
                            <View style={styles.perkLine}><Text variant="body">{perk.line}</Text></View>
                        </View>
                    ))}
                </VoidCard>

                <VoidCard style={styles.price}>
                    <View style={styles.priceRow}>
                        <Text variant="display" numeric>{price}</Text>
                        <Text variant="heading" tone="muted">a month</Text>
                    </View>
                    <Text variant="caption" tone="muted" align="center">
                        {status ?? 'Renews every month until you cancel. Cancel any time in Settings, at least a day before it renews.'}
                    </Text>
                </VoidCard>

                {!available ? (
                    <Text variant="bodySmall" tone="muted" align="center">Pro can’t be bought on this build.</Text>
                ) : on ? (
                    pro.until !== null ? <AppButton label="Manage subscription" icon="settings" onPress={() => { lightFeedback(); void manageSubscription(); }} /> : null
                ) : signedIn === false ? (
                    <AppButton label="Sign in to get Pro" icon="person-circle" onPress={() => { lightFeedback(); router.push('/(root)/account'); }} />
                ) : (
                    <AppButton label={`Get Pro · ${price} a month`} icon="sync" loading={busy === 'buy'} disabled={!!busy || signedIn === null} onPress={() => { void subscribe(); }} />
                )}

                {note ? <Text variant="bodySmall" tone="muted" align="center" accessibilityLiveRegion="polite">{note}</Text> : null}
                {available && !on ? (
                    <AppButton label="Restore purchase" variant="ghost" loading={busy === 'restore'} disabled={!!busy} onPress={() => { void bringBack(); }} />
                ) : null}

                <View style={styles.links}>
                    <AppButton label="Terms" variant="ghost" onPress={() => router.push({ pathname: '/(root)/legal' as never, params: { doc: 'terms' } })} />
                    <AppButton label="Privacy" variant="ghost" onPress={() => router.push({ pathname: '/(root)/legal' as never, params: { doc: 'privacy' } })} />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    close: { position: 'absolute', right: Spacing.lg, zIndex: 1 },
    page: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, alignItems: 'stretch' },
    mark: { width: Control.hitTarget * 1.6, height: Control.hitTarget * 1.6, alignSelf: 'center' },
    perks: { padding: Spacing.lg, gap: Spacing.md },
    perk: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    perkLine: { flex: 1 },
    price: { padding: Spacing.lg, gap: Spacing.xs, alignItems: 'center' },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
});

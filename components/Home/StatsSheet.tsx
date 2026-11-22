import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { ModalHeader, VoidModal } from '@/components/ui';
import { PagerGesture } from '@/components/ui/PagerGesture';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { WalletView } from '@/components/Shards/ShardsWallet';
import { StreakView } from '@/components/Streak/StreakView';
import { MissedView } from '@/components/Home/MissedModal';
import type { Wallet } from '@/hooks/useWallet';
import type { Missed } from '@/lib/missed';
import { Radius, Spacing } from '@/theme/designSystem';

export type StatsPage = 'wallet' | 'streak' | 'missed';
const PAGES: StatsPage[] = ['wallet', 'streak', 'missed'];
const TITLE: Record<StatsPage, string> = { wallet: 'Wallet', streak: 'Streak', missed: 'Missed' };

/**
 * Home's three stats in one sheet: Wallet, Streak and Missed, side by side.
 * It opens on the one you tapped; swipe left or right for the others (the
 * title and the dots follow). A swipe on something that moves sideways itself
 * (the wallet's chart, the streak's months) moves that instead, never both.
 */
export function StatsSheet({ open, onClose, wallet, multiplier, perfectRun, missed }: {
    open: StatsPage | null;
    onClose: () => void;
    wallet: Wallet;
    multiplier: number;
    perfectRun: number;
    missed: Missed;
}) {
    const t = useTokens();
    const { width } = useWindowDimensions();
    const { selectionFeedback } = useHaptics();
    const [page, setPage] = useState<StatsPage>(open ?? 'wallet');
    const [info, setInfo] = useState(false);
    // Opened again: on the one tapped.
    const [openedAs, setOpenedAs] = useState(open);
    if (open !== openedAs) { setOpenedAs(open); if (open) setPage(open); }
    const position = useSharedValue(PAGES.indexOf(open ?? 'wallet'));
    // Asked for another page while open (a link): the pages move there too, not only the title.
    const scroller = useAnimatedRef<Animated.ScrollView>();
    useEffect(() => {
        if (!open) return;
        position.set(PAGES.indexOf(open));
        scroller.current?.scrollTo({ x: PAGES.indexOf(open) * width, animated: false });
    }, [open, position, scroller, width]);

    const pager = useMemo(() => Gesture.Native(), []);
    const settle = (index: number) => {
        const next = PAGES[Math.max(0, Math.min(PAGES.length - 1, index))];
        if (next !== page) { selectionFeedback(); setPage(next); setInfo(false); }
    };
    const onScroll = useAnimatedScrollHandler(event => {
        position.set(event.contentOffset.x / Math.max(1, width));
    });

    return (
        <VoidModal visible={!!open} onClose={onClose}>
            <ModalHeader title={TITLE[page]}
                onAction={page === 'wallet' ? () => setInfo(true) : undefined} actionIcon="information-circle-outline" actionLabel="How Shards work" />
            {/* Which of the three, and that there are three. */}
            <View style={styles.dots} importantForAccessibility="no-hide-descendants">
                {PAGES.map((id, index) => <Dot key={id} index={index} position={position} color={t.color.accent} />)}
            </View>
            <PagerGesture.Provider value={pager}>
                <GestureDetector gesture={pager}>
                    <Animated.ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.flex}
                        contentOffset={{ x: PAGES.indexOf(open ?? 'wallet') * width, y: 0 }}
                        onScroll={onScroll} scrollEventThrottle={16}
                        onMomentumScrollEnd={event => settle(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)))}>
                        <View style={{ width }} accessibilityElementsHidden={page !== 'wallet'} importantForAccessibility={page === 'wallet' ? 'auto' : 'no-hide-descendants'}>
                            <WalletView wallet={wallet} multiplier={multiplier} perfectRun={perfectRun} active={!!open && page === 'wallet'} info={info} onInfo={setInfo} />
                        </View>
                        <View style={{ width }} accessibilityElementsHidden={page !== 'streak'} importantForAccessibility={page === 'streak' ? 'auto' : 'no-hide-descendants'}>
                            <StreakView />
                        </View>
                        <View style={{ width }} accessibilityElementsHidden={page !== 'missed'} importantForAccessibility={page === 'missed' ? 'auto' : 'no-hide-descendants'}>
                            <MissedView missed={missed} active={!!open && page === 'missed'} onLeave={onClose} />
                        </View>
                    </Animated.ScrollView>
                </GestureDetector>
            </PagerGesture.Provider>
        </VoidModal>
    );
}

/** One page's dot: it widens and lights as its page comes in, following the finger. */
function Dot({ index, position, color }: { index: number; position: ReturnType<typeof useSharedValue<number>>; color: string }) {
    const style = useAnimatedStyle(() => {
        const near = interpolate(Math.abs(position.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP);
        return { width: Spacing.sm + near * Spacing.md, opacity: 0.3 + near * 0.7 };
    });
    return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, paddingBottom: Spacing.sm },
    dot: { height: Spacing.xs + 2, borderRadius: Radius.pill },
});

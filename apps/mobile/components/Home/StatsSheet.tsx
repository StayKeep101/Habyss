import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { ModalHeader, VoidModal } from '@/components/ui';
import { PagerGesture } from '@/components/ui/PagerGesture';
import { useHaptics } from '@/hooks/useHaptics';
import { WalletView } from '@/components/Shards/ShardsWallet';
import { StreakView, StreakWhosePill, useStreakWhose } from '@/components/Streak/StreakView';
import { MissedView } from '@/components/Home/MissedModal';
import type { Wallet } from '@/hooks/useWallet';
import type { Missed } from '@/lib/missed';

export type StatsPage = 'wallet' | 'streak' | 'missed';
const PAGES: StatsPage[] = ['wallet', 'streak', 'missed'];
const TITLE: Record<StatsPage, string> = { wallet: 'Wallet', streak: 'Streak', missed: 'Missed' };

/**
 * Home's three stats in one sheet: Wallet, Streak and Missed, side by side.
 * It opens on the one you tapped; swipe left or right for the others (the
 * title follows). A swipe on something that moves sideways itself
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
    const { width } = useWindowDimensions();
    const { selectionFeedback } = useHaptics();
    const [page, setPage] = useState<StatsPage>(open ?? 'wallet');
    const [info, setInfo] = useState(false);
    const whose = useStreakWhose();
    // Opened again: on the one tapped.
    const [openedAs, setOpenedAs] = useState(open);
    if (open !== openedAs) { setOpenedAs(open); if (open) setPage(open); }
    // Asked for another page while open (a link): the pages move there too, not only the title.
    const scroller = useAnimatedRef<Animated.ScrollView>();
    useEffect(() => {
        if (!open) return;
        scroller.current?.scrollTo({ x: PAGES.indexOf(open) * width, animated: false });
    }, [open, scroller, width]);

    const pager = useMemo(() => Gesture.Native(), []);
    const settle = (index: number) => {
        const next = PAGES[Math.max(0, Math.min(PAGES.length - 1, index))];
        if (next !== page) { selectionFeedback(); setPage(next); setInfo(false); }
    };

    return (
        <VoidModal visible={!!open} onClose={onClose} onDismiss={onClose}>
            {/* The title follows the page; Streak has whose streak beside it, Wallet the ⓘ. */}
            <ModalHeader title={TITLE[page]} align={page === 'streak' ? 'start' : 'center'}
                rightSlot={page === 'streak' ? <StreakWhosePill whose={whose} /> : undefined}
                onAction={page === 'wallet' ? () => setInfo(true) : undefined} actionIcon="information-circle-outline" actionLabel="How Shards work" />
            <PagerGesture.Provider value={pager}>
                <GestureDetector gesture={pager}>
                    <Animated.ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.flex}
                        contentOffset={{ x: PAGES.indexOf(open ?? 'wallet') * width, y: 0 }}
                        onMomentumScrollEnd={event => settle(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)))}>
                        <View style={{ width }} accessibilityElementsHidden={page !== 'wallet'} importantForAccessibility={page === 'wallet' ? 'auto' : 'no-hide-descendants'}>
                            <WalletView wallet={wallet} multiplier={multiplier} perfectRun={perfectRun} active={!!open && page === 'wallet'} info={info} onInfo={setInfo} />
                        </View>
                        <View style={{ width }} accessibilityElementsHidden={page !== 'streak'} importantForAccessibility={page === 'streak' ? 'auto' : 'no-hide-descendants'}>
                            <StreakView whose={whose} />
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

const styles = StyleSheet.create({
    flex: { flex: 1 },
});

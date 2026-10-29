import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { AppIcon, Confetti, Overlay, Text } from '@/components/ui';
import { useAccess } from '@/hooks/useAccess';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Paywall } from '@/components/Paywall/Paywall';
import { Control, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';

/** How long the commitment is held on screen before the app comes back. */
const COMMITTED_MS = 2400;

/**
 * Over the whole app while it is not open to you: before the 14-day
 * challenge starts (it says what happens after it), and once it has ended,
 * everything, until Habyss is bought. Never when there is no way to pay
 * (lib/access.ts). The moment it is bought, a short beat says so before the
 * app comes back.
 */
export function AccessGate() {
    const { access } = useAccess();
    const [committed, setCommitted] = useState(false);
    const before = useRef(access.kind);
    useEffect(() => {
        const was = before.current;
        before.current = access.kind;
        if (access.kind !== 'owned' || was === 'owned' || was === 'loading') return;
        const shown = setTimeout(() => setCommitted(true), 0);
        const gone = setTimeout(() => setCommitted(false), COMMITTED_MS);
        return () => { clearTimeout(shown); clearTimeout(gone); };
    }, [access.kind]);

    if (committed) return <Committed />;
    if (access.kind === 'not_started') return <Paywall mode="start" />;
    if (access.kind === 'ended') return <Paywall mode="ended" />;
    return null;
}

/** Bought: the lock opens, one line, confetti once, then the app. */
function Committed() {
    const t = useTokens();
    const { successFeedback } = useHaptics();
    useEffect(() => { successFeedback(); }, [successFeedback]);
    return (
        <Overlay>
            <Animated.View entering={FadeIn.duration(DURATION.base)} exiting={FadeOut.duration(DURATION.reward)}
                style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: t.color.background }]}
                accessible accessibilityLiveRegion="assertive" accessibilityLabel="You're in. Habyss is yours for life.">
                <Animated.View entering={ZoomIn.duration(DURATION.reward).easing(EASE.land)} style={[styles.badge, { backgroundColor: t.color.accent }]}>
                    <AppIcon name="lock-open" filled size={Control.hitTarget} color={t.color.onAccent} />
                </Animated.View>
                <Animated.View entering={FadeIn.delay(DURATION.base).duration(DURATION.reward)} style={styles.words}>
                    <Text variant="screenTitle" align="center">You’re in.</Text>
                    <Text variant="body" tone="muted" align="center">Habyss is yours for life. Now the system does the work.</Text>
                </Animated.View>
                <Confetti colors={[t.color.accent, t.color.success, t.color.textPrimary]} />
            </Animated.View>
        </Overlay>
    );
}

const styles = StyleSheet.create({
    center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.xl },
    badge: { width: Control.hitTarget * 2.2, height: Control.hitTarget * 2.2, borderRadius: Control.hitTarget * 1.1, alignItems: 'center', justifyContent: 'center' },
    words: { gap: Spacing.sm },
});

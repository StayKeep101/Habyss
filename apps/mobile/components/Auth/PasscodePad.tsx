import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/ui';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { PASSCODE_LENGTH } from '@/lib/appPasscode';
import { DURATION, EASE, timingFor } from '@/theme/motion';
import { Control, Spacing } from '@/theme/designSystem';

const KEY = Control.height + Spacing.xl;
const DOT = Spacing.md;
const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
const NUDGE = timingFor(DURATION.quick, EASE.move);

/**
 * Habyss's passcode keypad: the mark, a short title, four dots, and round
 * matte keys. Bottom left Face ID (when offered), bottom right delete. A wrong
 * code turns the dots red and they slide once, then clear. Used to unlock
 * (BiometricGuard) and to set a passcode (Privacy & security).
 *
 * `onCode` gets the four digits; it answers whether they were right (false:
 * show wrong and clear). `message` replaces the subtitle (a wait, a step).
 */
export function PasscodePad({ title, subtitle, message, onCode, onFaceId, footer }: {
    title: string;
    subtitle?: string;
    message?: string | null;
    onCode: (code: string) => Promise<boolean>;
    onFaceId?: () => void;
    footer?: React.ReactNode;
}) {
    const t = useTokens();
    const { lightFeedback, errorFeedback } = useHaptics();
    const [code, setCode] = useState('');
    const [wrong, setWrong] = useState(false);
    const [checking, setChecking] = useState(false);
    const slide = useSharedValue(0);
    const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.get() }] }));

    useEffect(() => {
        if (code.length < PASSCODE_LENGTH || checking) return;
        setChecking(true);
        void onCode(code).then(ok => {
            if (ok) return;
            errorFeedback();
            setWrong(true);
            slide.set(withSequence(withTiming(-Spacing.md, NUDGE), withTiming(Spacing.md, NUDGE), withTiming(0, NUDGE)));
            setTimeout(() => { setCode(''); setWrong(false); }, 450);
        }).finally(() => setChecking(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    const press = (digit: string) => {
        if (checking || code.length >= PASSCODE_LENGTH) return;
        lightFeedback();
        setCode(current => current + digit);
    };
    const back = () => { if (code && !checking) { lightFeedback(); setCode(current => current.slice(0, -1)); } };

    const key = (digit: string) => (
        <Pressable key={digit} onPress={() => press(digit)} accessibilityRole="button" accessibilityLabel={digit}
            style={styles.key}>
            <MatteSurface radius={KEY / 2} level="control" style={styles.keyFace}>
                <Text variant="screenTitle" align="center">{digit}</Text>
            </MatteSurface>
        </Pressable>
    );
    const side = (icon: string, label: string, onPress?: () => void) => (
        <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}
            style={[styles.key, styles.keyFace]}>
            {onPress ? <AppIcon name={icon} size={Control.icon + Spacing.sm} color={t.color.textMuted} /> : null}
        </Pressable>
    );

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
                <Text variant="title" align="center" accessibilityRole="header">{title}</Text>
                <Text variant="bodySmall" tone={wrong ? 'danger' : 'muted'} align="center">{wrong ? 'Wrong passcode' : message ?? subtitle ?? ' '}</Text>
                <Animated.View style={[styles.dots, dotsStyle]} accessible accessibilityLabel={`${code.length} of ${PASSCODE_LENGTH} digits entered`}>
                    {Array.from({ length: PASSCODE_LENGTH }, (_, index) => (
                        <View key={index} style={[styles.dot, { borderColor: wrong ? t.color.danger : t.color.textMuted },
                            index < code.length && { backgroundColor: wrong ? t.color.danger : t.color.accent, borderColor: wrong ? t.color.danger : t.color.accent }]} />
                    ))}
                </Animated.View>
            </View>
            <View style={styles.pad}>
                {ROWS.map(row => <View key={row.join()} style={styles.row}>{row.map(key)}</View>)}
                <View style={styles.row}>
                    {side('scan', 'Use Face ID', onFaceId)}
                    {key('0')}
                    {side('backspace-outline', 'Delete', code ? back : undefined)}
                </View>
            </View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.section, paddingHorizontal: Spacing.xl },
    head: { alignItems: 'center', gap: Spacing.sm },
    mark: { width: Control.height, height: Control.height, marginBottom: Spacing.sm },
    dots: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.lg },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5 },
    pad: { gap: Spacing.lg },
    row: { flexDirection: 'row', gap: Spacing.xxl },
    key: { width: KEY, height: KEY },
    keyFace: { width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' },
    footer: { alignItems: 'center' },
});

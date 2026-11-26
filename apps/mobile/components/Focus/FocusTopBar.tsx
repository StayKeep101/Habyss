import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { IconButton } from '@/components/ui/IconButton';
import { MorphMenu, type MorphMenuHandle, type MorphMenuItem } from '@/components/ui/MorphMenu';
import { AnimatedCircle } from '@/components/ui/Motion';
import { FocusSettingsSheet, useFocusMusic } from '@/components/Focus/FocusSheets';
import { playFocusMusic, setFocusMusicOn, stopFocusMusic } from '@/lib/focusMusic';
import { useHaptics } from '@/hooks/useHaptics';
import { styles } from '@/styles/screens/focus.styles';

const HOLD_MS = 700;
const HOLD_SIZE = 44;
const HOLD_R = 20;
const HOLD_C = 2 * Math.PI * HOLD_R;
const WHITE = '#FFFFFF';
/** The music button when off: faded white, still 4.5:1 on the dark scene. */
const MUTED = 'rgba(255,255,255,0.55)';

/**
 * The top of every Focus page, the same whether it was opened from a habit, a
 * task, or the + (a step of the day): the × on the left, the music (on or off)
 * and the settings on the right, and the music playing while the clock runs.
 *
 * Ending takes a hold on the ×, so a stray touch never ends it: the ring round
 * it fills, then the × grows into the app's own small window with `endItems`.
 * A tap only says to hold. With nothing running, the × simply closes.
 */
export function FocusTopBar({ active, playing, endItems, onClose, onWake, style }: {
    /** Something is being focused on: the × asks for a hold and opens `endItems`. */
    active: boolean;
    /** The clock is running now: the chosen sound plays. */
    playing: boolean;
    endItems: MorphMenuItem[];
    onClose: () => void;
    /** Any touch here wakes the page (Focus dims its buttons when left alone). */
    onWake?: () => void;
    /** The bar's own style: Focus fades it when left alone. */
    style?: React.ComponentProps<typeof Animated.View>['style'];
}) {
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const endMenu = useRef<MorphMenuHandle>(null);
    const askEnd = () => {
        if (!active) { onClose(); return; }
        mediumFeedback();
        endMenu.current?.open();
    };
    const [holdHint, setHoldHint] = useState(false);
    const hold = useSharedValue(0);
    const holdRing = useAnimatedProps(() => ({ strokeDashoffset: HOLD_C * (1 - hold.get()) }));
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
    const tappedEnd = () => {
        onWake?.();
        selectionFeedback();
        setHoldHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHoldHint(false), 1800);
    };

    // Music, only here: the button turns it on or off; where it comes from is in the settings (lib/focusMusic.ts).
    const music = useFocusMusic();
    const [sheet, setSheet] = useState<'settings' | null>(null);
    // This step's own key: the music follows every step on screen, never just the last to speak.
    const musicKey = React.useRef({}).current;
    useEffect(() => { playFocusMusic(playing, musicKey); }, [music, playing, musicKey]);
    useEffect(() => () => stopFocusMusic(musicKey), [musicKey]);

    return (
        <>
            <Animated.View style={[styles.top, style]}>
                {active ? (
                    <View>
                        <MorphMenu menuRef={endMenu} icon="close" iconColor={WHITE} label="End focus" title="End focus?" titleIcon="timer" items={endItems} />
                        {/* Over the ×: a tap says to hold; holding fills the ring, then opens the menu. */}
                        <Pressable style={styles.holdLayer} onPress={tappedEnd} delayLongPress={HOLD_MS} onLongPress={() => { hold.set(0); askEnd(); }}
                            onPressIn={() => { hold.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear })); }}
                            onPressOut={() => { hold.set(withTiming(0, { duration: 150 })); }}
                            accessibilityRole="button" accessibilityLabel="End focus" accessibilityHint="Touch and hold to finish or exit"
                            onAccessibilityTap={askEnd}>
                            <Svg width={HOLD_SIZE} height={HOLD_SIZE} pointerEvents="none">
                                <AnimatedCircle cx={HOLD_SIZE / 2} cy={HOLD_SIZE / 2} r={HOLD_R} stroke={WHITE} strokeWidth={2.5} fill="none" strokeLinecap="round"
                                    strokeDasharray={`${HOLD_C} ${HOLD_C}`} animatedProps={holdRing} rotation={-90} origin={`${HOLD_SIZE / 2}, ${HOLD_SIZE / 2}`} />
                            </Svg>
                        </Pressable>
                        {holdHint ? <Text style={styles.holdHint}>Hold to end</Text> : null}
                    </View>
                ) : (
                    <IconButton icon="close" label="Close" onPress={onClose} size={18} color={WHITE} />
                )}
                <View style={styles.topRight}>
                    {/* Off is said by shape, not only colour: faded, with a slash through the notes. */}
                    <View style={styles.musicButton}>
                        <IconButton icon={music.on ? 'musical-notes' : 'musical-notes-outline'} label={music.on ? 'Music on. Turn off' : 'Music off. Turn on'}
                            onPress={() => { onWake?.(); setFocusMusicOn(!music.on); }} size={18} color={music.on ? WHITE : MUTED} />
                        {music.on ? null : <View pointerEvents="none" style={[styles.musicSlash, { backgroundColor: MUTED }]} />}
                    </View>
                    <IconButton icon="settings-outline" label="Focus settings" onPress={() => { onWake?.(); setSheet('settings'); }} size={18} color={WHITE} />
                </View>
            </Animated.View>
            <FocusSettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} />
        </>
    );
}

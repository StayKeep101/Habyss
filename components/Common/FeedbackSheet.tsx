import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { on } from '@/lib/appEvents';
import { sendFeedback } from '@/lib/feedback';

const MORPH = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));

/**
 * Telling us something, in one box.
 *
 * No name, no email, no category, no severity, no stars. Every one of those is
 * a question asked of somebody who is already doing you a favour, and every one
 * of them is a reason to close the app instead. What a report actually needs —
 * which screen, which build, which platform — is collected rather than typed.
 *
 * It never fails in front of anybody either. With no signal the message is kept
 * and sent on the next launch, and the sheet says thank you, because from where
 * the person is standing it *has* been sent: it is written down and it is
 * going. The only thing worse than a Send button that lies is one that loses
 * what you wrote.
 *
 * Mounted once at the root, raised by `show_feedback` from anywhere.
 */
export const FeedbackSheet: React.FC = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [visible, setVisible] = useState(false);
    const [screen, setScreen] = useState<string | undefined>();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const subscription = on('show_feedback', data => {
            setScreen(data?.screen);
            setMessage('');
            setSent(false);
            setVisible(true);
        });
        return () => subscription.remove();
    }, []);

    const close = () => {
        Keyboard.dismiss();
        setVisible(false);
    };

    const send = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        await sendFeedback(message, { screen, theme });
        setSending(false);
        successFeedback();
        setSent(true);
        Keyboard.dismiss();
        // Long enough to be read, short enough not to be in the way.
        setTimeout(() => setVisible(false), 1400);
    };

    return (
        <ComposerModal visible={visible} onClose={close}>
            <Animated.View layout={MORPH} style={[styles.sheet, { backgroundColor: tone.fill }]}>
                {sent ? (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.thanks}>
                        <Ionicons name="checkmark-circle" size={s(30)} color={colors.success} />
                        <Text style={[styles.thanksText, { color: colors.textPrimary }]}>Got it. Thank you.</Text>
                    </Animated.View>
                ) : (
                    <>
                        <View style={styles.head}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>Tell us anything</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => { lightFeedback(); close(); }} hitSlop={10}>
                                <Ionicons name="close" size={s(20)} color={colors.textTertiary} />
                            </Pressable>
                        </View>

                        <MatteInput
                            autoFocus
                            multiline
                            value={message}
                            onChangeText={setMessage}
                            placeholder="What is broken, missing, or annoying?"
                            placeholderTextColor={colors.textTertiary}
                            maxLength={2000}
                            accessibilityLabel="Your feedback"
                            style={[styles.input, { color: colors.textPrimary, backgroundColor: tone.raised }]}
                        />

                        <View style={styles.foot}>
                            <Text style={[styles.note, { color: colors.textTertiary }]}>
                                {screen ? `Sent with the screen you are on and your app version.` : 'Sent with your app version.'}
                            </Text>
                            <IconButton icon="arrow-up" label="Send feedback" onPress={() => void send()} loading={sending}
                                disabled={!message.trim()} diameter={s(46)} size={s(18)} color={message.trim() ? accent : colors.textTertiary} />
                        </View>
                    </>
                )}
            </Animated.View>
        </ComposerModal>
    );
};

const styles = StyleSheet.create({
    sheet: { padding: s(18), paddingBottom: vs(14), gap: vs(12), borderTopLeftRadius: s(24), borderTopRightRadius: s(24) },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: ms(18), fontFamily: FontFamily.bold, letterSpacing: -0.3 },
    input: {
        minHeight: vs(120), borderRadius: s(16), padding: s(14),
        fontSize: ms(15), lineHeight: ms(21), fontFamily: FontFamily.regular, textAlignVertical: 'top',
    },
    foot: { flexDirection: 'row', alignItems: 'center', gap: s(12) },
    note: { flex: 1, fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    send: { width: s(46), height: s(46), borderRadius: s(23), alignItems: 'center', justifyContent: 'center' },
    thanks: { alignItems: 'center', gap: vs(10), paddingVertical: vs(26) },
    thanksText: { fontSize: ms(16), fontFamily: FontFamily.semibold },
});

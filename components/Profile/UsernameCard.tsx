import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/ui/VoidCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppTextField } from '@/components/ui/AppTextField';
import { MatteInput } from '@/components/ui/MatteInput';
import { IconButton } from '@/components/ui/IconButton';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { setMyUsername } from '@/lib/friendsService';

/**
 * Your @username: unique, made for you when the account was created, and how
 * friends find and add you. Friends see your display name; the @username sits
 * under it as a pill — tap it to change it (once every 30 days, which the
 * server enforces). The loud "claim it" card only appears in the rare case an
 * account has none.
 */
export function UsernamePill({ username, onEdit }: { username: string; onEdit: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    return (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Your username, @${username}. Tap to change`} style={styles.pillWrap}>
            <MatteSurface radius={Radius.pill} level="control" style={styles.pill}>
                <AppIcon name="at" size={14} color={primary} />
                <Text style={[styles.pillText, { color: colors.textPrimary }]}>{username}</Text>
                <AppIcon name="pencil" size={12} color={colors.textTertiary} />
            </MatteSurface>
        </Pressable>
    );
}

/**
 * Changing your @username, in place of the pill: the same shape, now a field,
 * with a tick to save and a cross to cancel. The error, if any, under it.
 */
export function UsernameInline({ current, onSaved, onCancel }: { current: string; onSaved: (username: string) => void; onCancel: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { successFeedback } = useHaptics();
    const [value, setValue] = useState(current);
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);

    const save = async () => {
        const wanted = value.trim().replace(/^@/, '').toLowerCase();
        if (!wanted || wanted === current) { onCancel(); return; }
        setSaving(true);
        const result = await setMyUsername(wanted);
        setSaving(false);
        if (!result.ok) { setError(result.error); return; }
        successFeedback();
        onSaved(wanted);
    };

    return (
        <Animated.View entering={FadeIn.duration(150)} style={styles.inlineWrap}>
            <MatteSurface radius={Radius.pill} level="control" edge={error ? colors.error : undefined} style={styles.inline}>
                <AppIcon name="at" size={14} color={primary} />
                <MatteInput
                    bare
                    autoFocus
                    value={value}
                    onChangeText={next => { setValue(next); setError(undefined); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={21}
                    returnKeyType="done"
                    onSubmitEditing={() => void save()}
                    style={[styles.inlineInput, { color: colors.textPrimary }]}
                    accessibilityLabel="Your username"
                />
                <IconButton icon="close" label="Cancel" onPress={onCancel} diameter={26} size={14} color={colors.textTertiary} />
                <IconButton icon="checkmark" label="Save username" onPress={() => void save()} loading={saving} diameter={26} size={14} color={primary} />
            </MatteSurface>
            {error ? <Text style={[styles.inlineError, { color: colors.error }]}>{error}</Text> : null}
        </Animated.View>
    );
}

export function UsernameCard({ current, signedIn, onSaved, onCancel, onSignIn, flush }: {
    /** The username being changed, or null when there is none yet. */
    current: string | null;
    signedIn: boolean;
    onSaved: (username: string) => void;
    onCancel?: () => void;
    onSignIn: () => void;
    /** Inside a block that already has its own side margins. */
    flush?: boolean;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { buttonColors, primary } = useAccentGradient();
    const { successFeedback } = useHaptics();
    const [value, setValue] = useState(current ?? '');
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);

    const save = async () => {
        const wanted = value.trim().replace(/^@/, '').toLowerCase();
        if (!wanted || wanted === current) { onCancel?.(); return; }
        setSaving(true);
        const result = await setMyUsername(wanted);
        setSaving(false);
        if (!result.ok) { setError(result.error); return; }
        successFeedback();
        onSaved(wanted);
    };

    return (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(220)} style={flush ? styles.flush : styles.wrap}>
            <VoidCard style={styles.card}>
                {/* An accent edge across the top: the one card on the page that asks for something. */}
                {current === null ? <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.edge} /> : null}
                <View style={styles.body}>
                    <View style={styles.head}>
                        <View style={[styles.badge, { backgroundColor: primary }]}>
                            <AppIcon name="at" size={20} color={colors.background} />
                        </View>
                        <View style={styles.headText}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{current === null ? 'Claim your username' : 'Change your username'}</Text>
                            <Text style={[styles.sub, { color: colors.textSecondary }]}>
                                {current === null ? 'It’s how friends find and add you.' : 'Friends see your name; this is how they find you. Once every 30 days.'}
                            </Text>
                        </View>
                    </View>
                    {signedIn ? (
                        <>
                            <AppTextField
                                label="Username"
                                value={value}
                                onChangeText={next => { setValue(next); setError(undefined); }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={21}
                                leadingIcon="at"
                                placeholder="yourname"
                                returnKeyType="done"
                                onSubmitEditing={() => void save()}
                                error={error}
                                accessibilityLabel="Your username"
                            />
                            <View style={styles.actions}>
                                {onCancel ? <AppButton label="Cancel" variant="ghost" onPress={onCancel} style={styles.flex} /> : null}
                                <AppButton label={current === null ? 'Claim it' : 'Save'} onPress={() => void save()} loading={saving}
                                    disabled={!value.trim()} style={styles.flex} />
                            </View>
                        </>
                    ) : (
                        <AppButton label="Sign in to claim it" icon="person-circle-outline" onPress={onSignIn} />
                    )}
                </View>
            </VoidCard>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    pillWrap: { alignSelf: 'center', marginTop: Spacing.xs },
    pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
    pillText: { fontFamily: FontFamily.semibold, fontSize: 14 },
    inlineWrap: { alignSelf: 'center', alignItems: 'center', marginTop: Spacing.xs, gap: Spacing.xs },
    inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingLeft: Spacing.md, paddingRight: Spacing.xs, paddingVertical: 2, minWidth: 200 },
    inlineInput: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 14, paddingVertical: Spacing.xs + 2 },
    inlineError: { fontFamily: FontFamily.regular, fontSize: 12 },
    wrap: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg },
    flush: { alignSelf: 'stretch', marginTop: Spacing.md },
    card: { overflow: 'hidden' },
    edge: { height: 3 },
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    badge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    headText: { flex: 1, gap: 2 },
    title: { fontFamily: FontFamily.bold, fontSize: 17, lineHeight: 22 },
    sub: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: Spacing.sm },
    flex: { flex: 1 },
});

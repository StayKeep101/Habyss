import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppleAuthButton } from './AppleAuthButton';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { isAppleSignInAvailable, isGoogleSignInAvailable, signInWithApple, signInWithGoogle } from '@/lib/socialSignIn';
import type { SyncReport } from '@/lib/cloudSync';

interface Props {
    /** Runs after the account is linked and the first sync has finished. */
    onSignedIn: (report: SyncReport) => void;
    /** Shown under the two buttons when the caller can handle email sign-in. */
    onEmail?: () => void;
    emailLabel?: string;
}

/**
 * The same two buttons everywhere Habyss offers an account: onboarding, the
 * Account screen and the Friends tab. Apple opens its own sheet, which is one
 * tap and Face ID; Google opens Google's page in a secure in-app browser.
 *
 * Buttons only appear when this build and this phone can actually use them, so
 * a button is never shown that would fail when tapped.
 */
export const SignInOptions: React.FC<Props> = ({ onSignedIn, onEmail, emailLabel = 'Continue with email' }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [appleAvailable, setAppleAvailable] = useState(false);
    const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { isAppleSignInAvailable().then(setAppleAvailable); }, []);

    const run = async (provider: 'apple' | 'google') => {
        if (busy) return;
        lightFeedback();
        setBusy(provider);
        setError(null);
        try {
            const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
            if (!result.ok) {
                if (!('cancelled' in result)) setError(result.error);
                return;
            }
            successFeedback();
            onSignedIn(result.value);
        } catch {
            setError('Sign-in could not finish. Check your connection and try again.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <View style={styles.wrap}>
            {appleAvailable ? (
                <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy && busy !== 'apple' ? 0.5 : 1 }}>
                    <AppleAuthButton
                        disabled={!!busy}
                        onPress={() => run('apple')}
                    />
                </View>
            ) : null}

            {isGoogleSignInAvailable() ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Google"
                    disabled={!!busy}
                    onPress={() => run('google')}
                    style={[styles.button, styles.outline, {
                        borderColor: colors.border,
                        backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                        opacity: busy && busy !== 'google' ? 0.5 : 1,
                    }]}
                >
                    {busy === 'google' ? <ActivityIndicator color={colors.textPrimary} /> : (
                        <>
                            <Ionicons name="logo-google" size={17} color={colors.textPrimary} />
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Continue with Google</Text>
                        </>
                    )}
                </TouchableOpacity>
            ) : null}

            {busy === 'apple' ? <ActivityIndicator color={accent} /> : null}

            {onEmail ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    disabled={!!busy}
                    onPress={() => { lightFeedback(); onEmail(); }}
                    style={[styles.button, styles.outline, { borderColor: colors.border }]}
                >
                    <Ionicons name="mail-outline" size={17} color={colors.textPrimary} />
                    <Text style={[styles.label, { color: colors.textPrimary }]}>{emailLabel}</Text>
                </TouchableOpacity>
            ) : null}

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { alignSelf: 'stretch', gap: 10 },
    button: { height: 54, width: '100%', alignSelf: 'stretch' },
    outline: { borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    label: { fontSize: 16, fontFamily: FontFamily.medium },
    error: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular, textAlign: 'center' },
});

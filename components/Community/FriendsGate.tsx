import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { FontFamily } from '@/theme/designSystem';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useRouter } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/ui/VoidCard';
import { setMyUsername, USERNAME_RULE } from '@/lib/friendsService';
import { SignInOptions } from '@/components/Auth/SignInOptions';

interface Props {
    /** Signed in, but friends cannot find them until they pick a username. */
    needsUsername: boolean;
    onReady: () => void;
}

/**
 * What the Friends tab shows before friends are possible.
 *
 * Signed out: friends are other accounts, so there is nothing to show until
 * the user has one. Signed in without a username: nobody could find them, so
 * they choose one first. Either way the tab explains itself instead of showing
 * an empty list that looks broken.
 */
export const FriendsGate: React.FC<Props> = ({ needsUsername, onReady }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const valid = USERNAME_RULE.test(username.trim().toLowerCase());

    const save = async () => {
        if (!valid || saving) return;
        lightFeedback();
        setSaving(true);
        setError(null);
        const result = await setMyUsername(username);
        setSaving(false);
        if (!result.ok) { setError(result.error); return; }
        successFeedback();
        onReady();
    };

    return (
        <VoidCard style={styles.card}>
            <IconTile icon={needsUsername ? 'at' : 'people'} color={accent} size={56} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                {needsUsername ? 'Pick a username' : 'Do it with friends'}
            </Text>

            {needsUsername ? (
                <>
                    <View style={{ alignSelf: 'stretch' }}><AppTextField label="Username" error={error ?? undefined}
                        value={username}
                        onChangeText={text => { setUsername(text.replace(/\s/g, '')); setError(null); }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        placeholder="yourname"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Username"
                        returnKeyType="done"
                        onSubmitEditing={save}
                    /></View>
                    <AppButton label="Save username" onPress={save} disabled={!valid} loading={saving} />
                </>
            ) : (
                // The same buttons as onboarding, so signing in is one tap here too.
                <SignInOptions
                    onSignedIn={onReady}
                    emailLabel="Sign in with email"
                />
            )}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    card: { padding: 22, alignItems: 'center', gap: 10, marginTop: 12 },
    icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    title: { fontSize: 20, fontFamily: FontFamily.semibold, textAlign: 'center' },
    body: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlign: 'center' },
    input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: FontFamily.regular, marginTop: 6 },
    error: { alignSelf: 'stretch', fontSize: 12, fontFamily: FontFamily.regular },
    button: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 6 },
    buttonText: { fontSize: 15, fontFamily: FontFamily.semibold },
});

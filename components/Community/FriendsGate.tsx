import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/Layout/VoidCard';
import { setMyUsername, USERNAME_RULE } from '@/lib/friendsService';

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
            <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
                <Ionicons name={needsUsername ? 'at' : 'people'} size={26} color={accent} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                {needsUsername ? 'Pick a username' : 'Do it with friends'}
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
                {needsUsername
                    ? 'Friends find you by it. They see how consistent you are, never your habits unless you share one.'
                    : 'Sign in to add friends, see each other’s streaks and share a habit or goal. It also backs up your data.'}
            </Text>

            {needsUsername ? (
                <>
                    <TextInput
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
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: error ? colors.error : colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />
                    {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !valid }}
                        disabled={!valid || saving}
                        onPress={save}
                        style={[styles.button, { backgroundColor: valid ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }]}
                    >
                        {saving ? <ActivityIndicator color="#000" /> : (
                            <Text style={[styles.buttonText, { color: valid ? '#000' : colors.textTertiary }]}>Save username</Text>
                        )}
                    </TouchableOpacity>
                </>
            ) : (
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => { lightFeedback(); router.push('/(root)/account'); }}
                    style={[styles.button, { backgroundColor: accent }]}
                >
                    <Text style={[styles.buttonText, { color: '#000' }]}>Sign in</Text>
                </TouchableOpacity>
            )}
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    card: { padding: 22, alignItems: 'center', gap: 10, marginTop: 12 },
    icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    title: { fontSize: 20, fontFamily: 'Lexend_600SemiBold', textAlign: 'center' },
    body: { fontSize: 14, lineHeight: 20, fontFamily: 'Lexend_400Regular', textAlign: 'center' },
    input: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, fontFamily: 'Lexend_400Regular', marginTop: 6 },
    error: { alignSelf: 'stretch', fontSize: 12, fontFamily: 'Lexend_400Regular' },
    button: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 6 },
    buttonText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
});

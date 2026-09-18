import React, { useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { currentAccount } from '@/lib/account';
import { addFriendByUsername, getMyUsername, usernameFrom } from '@/lib/friendsService';

type State =
    | { kind: 'loading' }
    | { kind: 'signed_out' }
    | { kind: 'needs_username' }
    | { kind: 'ready' }
    | { kind: 'sending' }
    | { kind: 'done'; message: string }
    | { kind: 'error'; message: string };

/**
 * Where an invite link lands: habyss://add-friend?u=<username>.
 *
 * Nothing is sent until the user taps Add, so opening a link never creates a
 * friend request on its own.
 */
export default function AddFriendScreen() {
    const { u } = useLocalSearchParams<{ u?: string }>();
    const username = usernameFrom(typeof u === 'string' ? u : '');
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();
    const [state, setState] = useState<State>({ kind: 'loading' });

    useEffect(() => {
        (async () => {
            if (!username) return setState({ kind: 'error', message: 'This invite link is broken.' });
            if (!(await currentAccount())) return setState({ kind: 'signed_out' });
            if (!(await getMyUsername())) return setState({ kind: 'needs_username' });
            setState({ kind: 'ready' });
        })();
    }, [username]);

    const add = async () => {
        if (!username) return;
        lightFeedback();
        setState({ kind: 'sending' });
        const result = await addFriendByUsername(username);
        if (!result.ok) return setState({ kind: 'error', message: result.error });
        successFeedback();
        DeviceEventEmitter.emit('social_state_updated');
        setState({
            kind: 'done',
            message: result.nowFriends
                ? `You and @${result.username} are now friends.`
                : `Request sent. @${result.username} will see it next time they open Habyss.`,
        });
    };

    const close = () => (router.canGoBack() ? router.back() : router.replace('/(root)/(tabs)/community'));

    const button = (label: string, onPress: () => void) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: accent }]}>
            <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <VoidShell>
            <SafeAreaView style={styles.safe}>
                <TouchableOpacity accessibilityLabel="Close" onPress={close} style={styles.close}>
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <VoidCard style={styles.card}>
                    <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
                        <Ionicons name="person-add" size={26} color={accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        {username ? `@${username}` : 'Invite'}
                    </Text>

                    {state.kind === 'loading' || state.kind === 'sending' ? (
                        <ActivityIndicator color={accent} />
                    ) : state.kind === 'signed_out' ? (
                        <>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>Sign in to add friends.</Text>
                            {button('Sign in', () => router.push('/(root)/account'))}
                        </>
                    ) : state.kind === 'needs_username' ? (
                        <>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>Pick your own username first, in the Friends tab.</Text>
                            {button('Open Friends', () => router.replace('/(root)/(tabs)/community'))}
                        </>
                    ) : state.kind === 'ready' ? (
                        <>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Friends see each other’s streaks and daily progress. Habits stay private unless you share one.
                            </Text>
                            {button('Add friend', add)}
                        </>
                    ) : (
                        <>
                            <Text style={[styles.body, { color: state.kind === 'error' ? colors.error : colors.textSecondary }]}>
                                {state.message}
                            </Text>
                            {button('Done', close)}
                        </>
                    )}
                </VoidCard>
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
    close: { position: 'absolute', top: 60, right: 16, padding: 8, zIndex: 1 },
    card: { padding: 22, alignItems: 'center', gap: 12 },
    icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 22, fontFamily: 'Lexend_600SemiBold' },
    body: { fontSize: 14, lineHeight: 20, fontFamily: 'Lexend_400Regular', textAlign: 'center' },
    button: { alignSelf: 'stretch', paddingVertical: 15, borderRadius: 999, alignItems: 'center', marginTop: 4 },
    buttonText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold', color: '#000' },
});

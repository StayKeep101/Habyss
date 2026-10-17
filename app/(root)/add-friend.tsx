import { AppButton } from '@/components/ui/AppButton';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { FontFamily } from '@/theme/designSystem';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { currentAccount } from '@/lib/account';
import { addFriendByUsername, getMyUsername, usernameFrom } from '@/lib/friendsService';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/add-friend.styles';

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
            const mine = await getMyUsername().catch(() => undefined);
            if (mine === undefined) return setState({ kind: 'error', message: 'No connection. Try again when you are online.' });
            if (!mine) return setState({ kind: 'needs_username' });
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
        emit('social_state_updated');
        setState({
            kind: 'done',
            message: result.nowFriends
                ? `You and @${result.username} are now friends.`
                : `Request sent. @${result.username} will see it next time they open Habyss.`,
        });
    };

    const close = () => (router.canGoBack() ? router.back() : router.replace('/(root)/(tabs)/community'));

    const button = (label: string, onPress: () => void) => (
        <AppButton label={label} onPress={onPress} />
    );

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }}>
                <ModalHeader title="Add friend" onBack={close} backIcon="close" />
                <View style={styles.safe}><VoidCard style={styles.card}>
                    <IconTile icon="person-add" color={accent} size={56} />
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
                </VoidCard></View>
            </SafeAreaView>
        </VoidShell>
    );
}

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { styles } from '@/styles/screens/blocked.styles';

const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/**
 * Who you have blocked.
 *
 * A block has to be undoable somewhere, and it cannot be on their card — that
 * card is the thing a block makes disappear. So it is a list of its own, which
 * is also the honest answer to "who have I blocked", a question nobody can
 * answer from memory a year later.
 */
export default function BlockedScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const [people, setPeople] = useState<Friend[] | null>(null);

    const load = useCallback(() => {
        FriendsService.blockedUsers().then(setPeople).catch(() => setPeople([]));
    }, []);
    useEffect(load, [load]);

    const unblock = (person: Friend) => {
        Alert.alert(`Unblock ${person.username}?`, 'They will be able to send you a friend request again.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unblock', onPress: async () => {
                    lightFeedback();
                    if (await FriendsService.unblockUser(person.userId || person.id)) {
                        setPeople(current => (current ?? []).filter(item => item.id !== person.id));
                    } else {
                        Alert.alert('Could not unblock them', 'Please try again.');
                    }
                },
            },
        ]);
    };

    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };

    return (
        <SheetScreen title="Blocked accounts" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {people === null ? (
                    <ActivityIndicator color={primary} style={{ marginTop: vs(40) }} />
                ) : people.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>
                        You have not blocked anybody. If you do, they will be here.
                    </Text>
                ) : (
                    <Animated.View layout={MORPH} style={styles.list}>
                        {people.map(person => (
                            <Animated.View key={person.id} entering={FadeIn.duration(180)} layout={MORPH}>
                                <VoidCard {...surface} style={[styles.row, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                                    <View style={[styles.avatar, { backgroundColor: primary + '18' }]}>
                                        {person.avatarUrl ? (
                                            <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                                        ) : (
                                            <Text style={[styles.initial, { color: primary }]}>
                                                {person.username.slice(0, 1).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{person.username}</Text>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Unblock ${person.username}`}
                                        onPress={() => unblock(person)}
                                        style={[styles.action, { borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.actionText, { color: colors.textSecondary }]}>Unblock</Text>
                                    </Pressable>
                                </VoidCard>
                            </Animated.View>
                        ))}
                    </Animated.View>
                )}

                <View style={styles.note}>
                    <Ionicons name="information-circle-outline" size={s(13)} color={colors.textTertiary} />
                    <Text style={[styles.noteText, { color: colors.textTertiary }]}>
                        A blocked account cannot see your day, react to it, write to you, or send you a
                        friend request. The block is kept on the server, not just hidden here.
                    </Text>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/context/AccentContext';
import { FriendsService, Friend } from '@/lib/friendsService';
import { VoidSheet } from '@/components/ui/VoidSheet';

interface ShareParticipantsSheetProps {
    visible: boolean;
    title: string;
    subtitle: string;
    /** Ids currently participating. Resolved each time the sheet opens. */
    loadShared: () => Promise<string[]>;
    /** Persist the change. Must resolve only once the work has succeeded. */
    applyChanges: (added: string[], removed: string[]) => Promise<void>;
    onClose: () => void;
}

/**
 * One participant picker shared by the goal and habit sheets.
 *
 * A bottom sheet, not a page sheet. It used to take the whole screen to ask
 * which of two friends to include, leaving most of it black and hiding the
 * habit being shared — so a small question looked enormous. The thing you were
 * looking at stays visible above it now.
 *
 * The explanatory paragraph is gone. It read "Everything stays on this device
 * — nobody is sent an invitation", which stopped being true the moment sharing
 * became an offer somebody accepts or declines; and a list of names with tick
 * boxes does not need to be explained in three lines anyway.
 *
 * Saving waits for the work to finish before reporting success, so a failure is
 * visible instead of silently dropped.
 */
export const ShareParticipantsSheet: React.FC<ShareParticipantsSheetProps> = ({
    visible, title, subtitle, loadShared, applyChanges, onClose,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { lightFeedback, successFeedback } = useHaptics();
    const { primary: accentColor } = useAccentGradient();

    const [friends, setFriends] = useState<Friend[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [initial, setInitial] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [friendsList, sharedIds] = await Promise.all([
                    FriendsService.getFriends(),
                    loadShared(),
                ]);
                if (cancelled) return;
                setFriends(friendsList);
                setSelected(sharedIds);
                setInitial(sharedIds);
            } catch {
                if (!cancelled) setError('Could not load your people. Close and try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
        // loadShared is recreated per render by callers; visible is the real trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const toggle = useCallback((friendId: string) => {
        lightFeedback();
        setError(null);
        setSelected(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
    }, [lightFeedback]);

    const added = selected.filter(id => !initial.includes(id));
    const removed = initial.filter(id => !selected.includes(id));
    const hasChanges = added.length > 0 || removed.length > 0;

    const handleSave = async () => {
        if (saving || !hasChanges) { onClose(); return; }
        setSaving(true);
        setError(null);
        try {
            await applyChanges(added, removed);
            successFeedback();
            onClose();
        } catch {
            // Stay open so the selection is not lost.
            setError('Could not save that change. Your selection is still here.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <VoidSheet visible={visible} onClose={onClose} title={title} caption={subtitle}
            footer={
                <View style={styles.footer}>
                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        style={{ opacity: saving ? 0.7 : 1 }}
                    >
                        <MatteSurface radius={999} level="control" style={styles.saveButton}>
                        {saving ? (
                            <ActivityIndicator color={colors.textPrimary} size="small" />
                        ) : (
                            <Text style={[styles.saveText, { color: hasChanges ? colors.textPrimary : colors.textSecondary }]}>
                                {/* Says what will happen, and how many times. A
                                    share is an invitation now, so "Save" was
                                    understating what the button does. */}
                                {hasChanges
                                    ? (added.length > 0
                                        ? `Invite ${added.length === 1 ? '1 person' : `${added.length} people`}`
                                        : 'Save changes')
                                    : 'Done'}
                            </Text>
                        )}
                        </MatteSurface>
                    </TouchableOpacity>
                </View>
            }
        >
            {loading ? (
                <ActivityIndicator color={accentColor} style={{ marginVertical: vs(28) }} />
            ) : friends.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={ms(32)} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textPrimary }]}>Nobody added yet</Text>
                    <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                        Add people in Community, then come back.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                    {friends.map(friend => {
                        const isSelected = selected.includes(friend.id);
                        // The name they chose, with the handle under it only
                        // when the two differ — repeating "pen / @pen" is a row
                        // that says one thing twice.
                        const name = friend.displayName || friend.username;
                        return (
                            <TouchableOpacity
                                key={friend.id}
                                activeOpacity={0.85}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isSelected }}
                                accessibilityLabel={name}
                                onPress={() => toggle(friend.id)}
                            >
                                <MatteSurface radius={s(14)} level="control" elevation="none" style={styles.row}>
                                <View style={[styles.avatar, { backgroundColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)' }]}>
                                    {friend.avatarUrl ? (
                                        <Image source={{ uri: friend.avatarUrl }} style={styles.photo} />
                                    ) : (
                                        <Text style={{ fontSize: ms(14), color: colors.textSecondary, fontFamily: FontFamily.semibold }}>
                                            {name[0]?.toUpperCase()}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.who}>
                                    <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
                                    {friend.displayName && friend.displayName !== friend.username ? (
                                        <Text numberOfLines={1} style={[styles.handle, { color: colors.textTertiary }]}>
                                            {`@${friend.username}`}
                                        </Text>
                                    ) : null}
                                </View>
                                <Ionicons
                                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={ms(21)}
                                    color={isSelected ? colors.textPrimary : colors.textTertiary}
                                />
                                </MatteSurface>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </VoidSheet>
    );
};

const styles = StyleSheet.create({
    emptyState: { alignItems: 'center', paddingVertical: vs(22), paddingHorizontal: s(36), gap: vs(4) },
    emptyText: { fontSize: ms(15), marginTop: vs(4), fontFamily: FontFamily.semibold },
    emptySubtext: { fontSize: ms(12), lineHeight: ms(17), textAlign: 'center', fontFamily: FontFamily.regular },
    list: { paddingHorizontal: s(18), paddingTop: vs(4), paddingBottom: vs(8), gap: vs(7) },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: s(11),
        paddingVertical: vs(9), paddingHorizontal: s(12),

    },
    avatar: { width: s(36), height: s(36), borderRadius: s(18), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    who: { flex: 1 },
    name: { fontSize: ms(15), fontFamily: FontFamily.medium },
    handle: { fontSize: ms(11), fontFamily: FontFamily.regular },
    error: {
        flexDirection: 'row', alignItems: 'center', gap: s(7),
        marginBottom: vs(8), paddingVertical: vs(8), paddingHorizontal: s(11),
        borderRadius: s(12), borderWidth: 1,
    },
    errorText: { flex: 1, fontSize: ms(12), lineHeight: ms(16), fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: s(18), paddingTop: vs(6) },
    saveButton: { paddingVertical: vs(13), borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: ms(15), fontFamily: FontFamily.semibold },
});

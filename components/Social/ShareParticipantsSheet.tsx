import { FontFamily } from '@/constants/DesignSystem';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend } from '@/lib/friendsService';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';

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
 * Participants live in Habyss on this device: FriendsService is local state, so
 * the copy deliberately avoids implying an invitation is delivered to someone
 * else. Saving waits for the work to finish before reporting success, so a
 * failure is visible instead of silently dropped.
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
        <VoidModal visible={visible} onClose={onClose}>
            <View style={{ flex: 1 }}>
                <ModalHeader title={title} subtitle={subtitle.toUpperCase()} onBack={onClose} />

                <Text style={[styles.description, { color: colors.textSecondary }]}>
                    Choose who appears alongside you in Habyss. Everything stays on this device — nobody is sent an invitation.
                </Text>

                {loading ? (
                    <ActivityIndicator color={accentColor} style={{ marginVertical: 40 }} />
                ) : friends.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textPrimary }]}>Nobody added yet</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                            Add people from the Community tab, then come back to include them here.
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                    >
                        {friends.map(friend => {
                            const isSelected = selected.includes(friend.id);
                            return (
                                <TouchableOpacity
                                    key={friend.id}
                                    activeOpacity={0.85}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: isSelected }}
                                    onPress={() => toggle(friend.id)}
                                    style={[
                                        styles.row,
                                        {
                                            backgroundColor: isSelected ? accentColor + '14' : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                                            borderColor: isSelected ? accentColor + '66' : 'transparent',
                                        },
                                    ]}
                                >
                                    <View style={[styles.avatar, { backgroundColor: isSelected ? accentColor : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)') }]}>
                                        <Text style={{ fontSize: 15, color: isSelected ? '#000' : colors.textSecondary, fontFamily: FontFamily.semibold }}>
                                            {friend.username[0]?.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {friend.username}
                                    </Text>
                                    <Ionicons
                                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={22}
                                        color={isSelected ? accentColor : colors.textTertiary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {error ? (
                    <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                    </View>
                ) : null}

                <View style={styles.footer}>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                        style={[
                            styles.saveButton,
                            {
                                backgroundColor: hasChanges ? accentColor : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'),
                                opacity: saving ? 0.7 : 1,
                            },
                        ]}
                    >
                        {saving ? (
                            <ActivityIndicator color={hasChanges ? '#000' : colors.textSecondary} size="small" />
                        ) : (
                            <Text style={[styles.saveText, { color: hasChanges ? '#000' : colors.textSecondary }]}>
                                {hasChanges ? 'Save changes' : 'Done'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    description: {
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        fontFamily: FontFamily.regular,
        paddingHorizontal: 28,
        marginBottom: 14,
    },
    emptyState: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 40, gap: 6 },
    emptyText: { fontSize: 15, marginTop: 6, fontFamily: FontFamily.semibold },
    emptySubtext: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: FontFamily.regular },
    list: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    name: { flex: 1, fontSize: 15, fontFamily: FontFamily.medium },
    error: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginBottom: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 4 },
    saveButton: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});

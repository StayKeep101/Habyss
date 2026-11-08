import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text as RNText, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { AppIcon, Avatar, IconButton, MatteInput, MatteSurface, SegmentBar, Text, VoidSheet } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { textOn } from '@/theme/tokens';
import { Control, Radius, Spacing } from '@/theme/designSystem';
import { DURATION, EASE } from '@/theme/motion';
import { maskObjectionable } from '@/lib/contentFilter';
import { FriendsService, type Friend } from '@/lib/friendsService';
import {
    COMMENT_EMOJI, MAX_COMMENT, deleteComment, editComment, insertMention, listenToComments, loadThread, mentionAt, postComment,
    reactToComment, splitMentions, threadsOf, withMyEmoji, type Comment, type CommentEmoji,
} from '@/lib/comments';

/** Said in one tap: the replies people reach for most. */
/** Small controls under a comment reach 44 pt this way (an 18 pt line plus this above and below). */
const REACH = { top: Spacing.md + Spacing.xs / 2, bottom: Spacing.md + Spacing.xs / 2, left: Spacing.sm, right: Spacing.sm };
/** A 28 pt emoji chip reaches 44 pt. */
const CHIP_REACH = Spacing.sm;

const QUICK = ['🔥 Let’s go', 'Proud of you', 'How?!', 'Again tomorrow?', 'Teach me'];
const MOVE = LinearTransition.duration(DURATION.base).easing(EASE.move).reduceMotion(ReduceMotion.System);

const ago = (iso: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

export interface CommentTarget {
    toUser: string;
    day: string;
    /** Whose day it is, as the card says it: "You", "Ana". */
    name: string;
    done: number;
    total: number;
    /** It is your own day: you may remove anything said on it. */
    mine: boolean;
    /** Opened to write: the keyboard comes up with the sheet. */
    focus?: boolean;
}

/** A comment's words, with @mentions in cobalt. */
function Body({ comment }: { comment: Comment }) {
    const t = useTokens();
    const body = comment.mine ? comment.body : maskObjectionable(comment.body);
    return (
        <RNText style={[t.type.body, { color: t.color.textPrimary }]}>
            {splitMentions(body).map((part, index) => (
                <RNText key={index} style={part.mention ? { color: t.color.cobalt } : undefined}>{part.text}</RNText>
            ))}
        </RNText>
    );
}

/**
 * One comment: face, name, when, the words; under them Reply, its emoji
 * reactions and a way to add yours. A long press opens what you can do with
 * it, in place (no second sheet over this one): edit or remove your own, or
 * report or block someone else. The owner of the day may remove anything.
 */
function Row({ comment, reply, canRemove, open, onToggle, onReply, onEdit, onRemove, onReport, onBlock, onReact }: {
    comment: Comment; reply?: boolean; canRemove: boolean; open: boolean; onToggle: () => void; onReply: () => void;
    onEdit: () => void; onRemove: () => void; onReport: () => void; onBlock: () => void; onReact: (emoji: CommentEmoji | null) => void;
}) {
    const t = useTokens();
    const [picking, setPicking] = useState(false);
    const shown = COMMENT_EMOJI.filter(emoji => (comment.reactions[emoji] ?? 0) > 0);
    const chip = (emoji: CommentEmoji, count?: number) => {
        const on = comment.myReaction === emoji;
        return (
            <Pressable key={emoji} hitSlop={CHIP_REACH} onPress={() => { setPicking(false); onReact(on ? null : emoji); }}
                accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${emoji}${count ? ` ${count}` : ''}`}>
                <MatteSurface radius={Radius.pill} level="control" style={[styles.chip, on && { backgroundColor: t.color.cobalt }]}>
                    <RNText style={t.type.bodySmall}>{emoji}</RNText>
                    {count ? <RNText style={[t.type.caption, styles.numeric, { color: on ? textOn(t.color.cobalt) : t.color.textMuted }]}>{count}</RNText> : null}
                </MatteSurface>
            </Pressable>
        );
    };
    const action = (label: string, icon: string, run: () => void, danger?: boolean) => (
        <Pressable key={label} onPress={run} hitSlop={REACH} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
            <AppIcon name={icon} size={Spacing.lg} color={danger ? t.color.danger : t.color.textMuted} />
            <Text variant="bodySmall" tone={danger ? 'danger' : 'muted'}>{label}</Text>
        </Pressable>
    );
    return (
        <Animated.View layout={MOVE} entering={FadeIn.duration(DURATION.base).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(DURATION.exit).reduceMotion(ReduceMotion.System)} style={[styles.row, reply && styles.reply]}>
            <Avatar name={comment.authorName} uri={comment.authorAvatar} size={reply ? Spacing.xxl + Spacing.xs : Control.hitTarget - Spacing.sm} />
            <View style={styles.grow}>
                <Pressable onLongPress={onToggle} delayLongPress={350} accessibilityHint="Double-tap and hold for more"
                    accessibilityActions={[{ name: 'more', label: 'More' }]} onAccessibilityAction={onToggle}>
                    <View style={styles.meta}>
                        <Text variant="bodySmall" numberOfLines={1}>{comment.authorName}</Text>
                        <Text variant="caption" tone="muted">{`${ago(comment.createdAt)}${comment.editedAt ? ' · edited' : ''}`}</Text>
                    </View>
                    <Body comment={comment} />
                </Pressable>
                <View style={styles.under}>
                    {reply ? null : (
                        <Pressable onPress={onReply} hitSlop={REACH} accessibilityRole="button" accessibilityLabel={`Reply to ${comment.authorName}`}>
                            <Text variant="caption" tone="muted">Reply</Text>
                        </Pressable>
                    )}
                    {shown.map(emoji => chip(emoji, comment.reactions[emoji]))}
                    <Pressable onPress={() => setPicking(value => !value)} hitSlop={REACH} accessibilityRole="button"
                        accessibilityLabel={picking ? 'Close reactions' : 'React'}>
                        <AppIcon name={picking ? 'close-circle' : 'happy'} size={Spacing.lg + 2} color={t.color.textSubtle} />
                    </Pressable>
                </View>
                {picking ? (
                    <Animated.View entering={FadeIn.duration(DURATION.quick).reduceMotion(ReduceMotion.System)} style={styles.picker}>
                        {COMMENT_EMOJI.map(emoji => chip(emoji))}
                    </Animated.View>
                ) : null}
                {open ? (
                    <Animated.View entering={FadeIn.duration(DURATION.quick).reduceMotion(ReduceMotion.System)} style={styles.actions}>
                        {comment.mine ? action('Edit', 'create', onEdit) : null}
                        {comment.mine || canRemove ? action('Remove', 'trash', onRemove, true) : null}
                        {comment.mine ? null : action('Report', 'flag', onReport)}
                        {comment.mine ? null : action('Block', 'hand-left', onBlock, true)}
                    </Animated.View>
                ) : null}
            </View>
        </Animated.View>
    );
}

/**
 * The conversation under a day: what it is about at the top (whose day, how
 * much got done), the threads, and a composer pinned above the keyboard with
 * one-tap replies, @mentions of friends who can see the day, a reply or edit
 * banner, and send. Live while it is open: friends' replies arrive on their own.
 */
export function CommentSheet({ target, onClose, onChanged }: { target: CommentTarget | null; onClose: () => void; onChanged: () => void }) {
    const t = useTokens();
    const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [text, setText] = useState('');
    const [cursor, setCursor] = useState(0);
    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [editing, setEditing] = useState<Comment | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [friends, setFriends] = useState<Friend[]>([]);
    const input = useRef<React.ElementRef<typeof MatteInput>>(null);

    const load = useCallback(() => {
        if (!target) return;
        loadThread(target.toUser, target.day)
            .then(list => { setComments(list); setFailed(false); })
            .catch(() => { setFailed(true); setComments(current => current ?? []); });
    }, [target]);

    // A new day opened: start clean, load it, listen for friends' replies.
    const [shownFor, setShownFor] = useState<CommentTarget | null>(null);
    if (target !== shownFor) {
        setShownFor(target);
        setComments(null); setText(''); setReplyTo(null); setEditing(null); setOpen(null);
    }
    useEffect(() => {
        if (!target) return;
        load();
        FriendsService.getFriends().then(setFriends).catch(() => setFriends([]));
        let pending: ReturnType<typeof setTimeout> | null = null;
        const stop = listenToComments(() => {
            if (pending) clearTimeout(pending);
            pending = setTimeout(() => { pending = null; load(); }, 400);
        });
        return () => { stop(); if (pending) clearTimeout(pending); };
    }, [target, load]);

    // Opened from the message icon: ready to type as the sheet arrives.
    useEffect(() => {
        if (!target?.focus) return;
        const timer = setTimeout(() => input.current?.focus(), DURATION.tap);
        return () => clearTimeout(timer);
    }, [target]);

    const threads = useMemo(() => threadsOf(comments ?? []), [comments]);
    const mention = mentionAt(text, cursor);
    const suggestions = mention ? friends.filter(friend => {
        const query = mention.query.toLowerCase();
        return friend.username.toLowerCase().startsWith(query) || (friend.displayName ?? '').toLowerCase().startsWith(query);
    }).slice(0, 4) : [];

    const fail = (error: unknown) => Alert.alert('That didn’t go through', error instanceof Error ? error.message : 'Try again in a moment.');
    const update = (id: string, change: (comment: Comment) => Comment | null) => setComments(current => (current ?? []).flatMap(comment => {
        if (comment.id !== id) return [comment];
        const next = change(comment);
        return next ? [next] : [];
    }));

    const send = async (words = text) => {
        if (!target || sending || !words.trim()) return;
        setSending(true);
        try {
            if (editing) {
                await editComment(editing.id, words);
                update(editing.id, comment => ({ ...comment, body: words.trim(), editedAt: new Date().toISOString() }));
            } else {
                const made = await postComment(target.toUser, target.day, words, replyTo?.parentId ?? replyTo?.id ?? null);
                setComments(current => [...(current ?? []), made]);
            }
            successFeedback();
            setText(''); setReplyTo(null); setEditing(null);
            onChanged();
        } catch (error) { fail(error); }
        finally { setSending(false); }
    };

    const react = (comment: Comment, emoji: CommentEmoji | null) => {
        selectionFeedback();
        update(comment.id, item => withMyEmoji(item, emoji));
        reactToComment(comment.id, emoji).then(onChanged).catch(error => { update(comment.id, () => comment); fail(error); });
    };
    const remove = (comment: Comment) => {
        lightFeedback();
        setOpen(null);
        const before = comments;
        setComments(current => (current ?? []).filter(item => item.id !== comment.id && item.parentId !== comment.id));
        deleteComment(comment.id).then(onChanged).catch(error => { setComments(before); fail(error); });
    };
    const report = (comment: Comment) => {
        setOpen(null);
        const file = (reason: string) => void FriendsService.reportContent({ userId: comment.author, kind: 'comment', reason, reference: `comment:${comment.id}` })
            .then(ok => Alert.alert(ok ? 'Reported' : 'Could not send that', ok ? 'Thank you. Somebody will read it.' : 'Please try again.'));
        Alert.alert(`Report ${comment.authorName}'s comment`, 'What is wrong?', [
            { text: 'Offensive words', onPress: () => file('offensive') },
            { text: 'Spam', onPress: () => file('spam') },
            { text: 'Something else', onPress: () => file('other') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };
    const block = (comment: Comment) => {
        setOpen(null);
        Alert.alert(`Block ${comment.authorName}?`, 'They are removed from your friends and can no longer see your days or write to you.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Block', style: 'destructive', onPress: () => void FriendsService.blockUser(comment.author).then(ok => { if (ok) { load(); onChanged(); } }) },
        ]);
    };

    const row = (comment: Comment, reply = false) => (
        <Row key={comment.id} comment={comment} reply={reply} canRemove={!!target?.mine} open={open === comment.id}
            onToggle={() => { selectionFeedback(); setOpen(current => (current === comment.id ? null : comment.id)); }}
            onReply={() => { selectionFeedback(); setEditing(null); setReplyTo(comment); input.current?.focus(); }}
            onEdit={() => { setOpen(null); setReplyTo(null); setEditing(comment); setText(comment.body); input.current?.focus(); }}
            onRemove={() => remove(comment)} onReport={() => report(comment)} onBlock={() => block(comment)}
            onReact={emoji => react(comment, emoji)} />
    );

    const banner = editing ? 'Editing your comment' : replyTo ? `Replying to ${replyTo.authorName}` : null;
    return (
        <VoidSheet visible={!!target} onClose={onClose} title="Comments" caption={target ? `${target.mine ? 'Your' : `${target.name}’s`} day` : undefined}
            maxShare={0.88} scrollable
            footer={target ? (
                <View style={styles.composer}>
                    {suggestions.length ? (
                        <View style={styles.suggestions}>
                            {suggestions.map(friend => (
                                <Pressable key={friend.userId} style={styles.suggestion} accessibilityRole="button" accessibilityLabel={`Mention ${friend.displayName ?? friend.username}`}
                                    onPress={() => {
                                        if (!mention) return;
                                        selectionFeedback();
                                        const next = insertMention(text, mention.start, cursor, friend.username);
                                        setText(next.text); setCursor(next.cursor);
                                    }}>
                                    <Avatar name={friend.displayName ?? friend.username} uri={friend.avatarUrl} size={Spacing.xxl + Spacing.xs} />
                                    <Text variant="bodySmall" grow numberOfLines={1}>{friend.displayName ?? friend.username}</Text>
                                    <Text variant="caption" tone="muted">{`@${friend.username}`}</Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null}
                    {banner ? (
                        <View style={styles.banner}>
                            <Text variant="caption" tone="muted" grow>{banner}</Text>
                            <Pressable hitSlop={Spacing.md} accessibilityRole="button" accessibilityLabel="Cancel"
                                onPress={() => { setReplyTo(null); if (editing) setText(''); setEditing(null); }}>
                                <AppIcon name="close" size={Spacing.lg} color={t.color.textMuted} />
                            </Pressable>
                        </View>
                    ) : !text ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quick}>
                            {QUICK.map(words => (
                                <Pressable key={words} onPress={() => void send(words)} accessibilityRole="button" accessibilityLabel={`Send: ${words}`}>
                                    <MatteSurface radius={Radius.pill} level="control" style={styles.quickChip}>
                                        <Text variant="bodySmall">{words}</Text>
                                    </MatteSurface>
                                </Pressable>
                            ))}
                        </ScrollView>
                    ) : null}
                    <View style={styles.inputRow}>
                        <View style={styles.grow}>
                            <MatteInput ref={input} value={text} onChangeText={setText} multiline maxLength={MAX_COMMENT}
                                onSelectionChange={event => setCursor(event.nativeEvent.selection.end)}
                                placeholder={replyTo ? `Reply to ${replyTo.authorName}` : 'Say something'} accessibilityLabel="Comment" />
                        </View>
                        <IconButton icon="arrow-up" label={editing ? 'Save edit' : 'Send'} loading={sending} disabled={!text.trim()}
                            color={text.trim() ? t.color.cobalt : t.color.textSubtle} onPress={() => void send()} />
                    </View>
                    {text.length > MAX_COMMENT - 60 ? <Text variant="caption" tone="muted" align="right">{`${MAX_COMMENT - text.length} left`}</Text> : null}
                </View>
            ) : undefined}>
            <View style={styles.body}>
                {target && target.total ? (
                    <View style={styles.context} accessible accessibilityLabel={`${target.done} of ${target.total} done`}>
                        <SegmentBar done={target.done} total={target.total} />
                        <Text variant="caption" tone="muted">{`${target.done} of ${target.total} done`}</Text>
                    </View>
                ) : null}
                {comments === null ? null : failed && !comments.length ? (
                    <Text variant="bodySmall" tone="muted" align="center">Couldn’t load the comments. Pull the feed to try again.</Text>
                ) : !threads.length ? (
                    <View style={styles.empty}>
                        <AppIcon name="chatbubbles" size={Control.hitTarget - Spacing.md} color={t.color.textSubtle} />
                        <Text variant="body" tone="muted" align="center">Be the first to say something.</Text>
                    </View>
                ) : threads.map(thread => (
                    <View key={thread.comment.id} style={styles.thread}>
                        {row(thread.comment)}
                        {thread.replies.map(reply => row(reply, true))}
                    </View>
                ))}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    // The sheet pads the sides itself.
    body: { paddingBottom: Spacing.lg, gap: Spacing.lg },
    context: { gap: Spacing.xs },
    thread: { gap: Spacing.md },
    row: { flexDirection: 'row', gap: Spacing.md },
    reply: { marginLeft: Control.hitTarget },
    grow: { flex: 1 },
    meta: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    under: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, minHeight: Spacing.xxl + Spacing.xs },
    numeric: { fontVariant: ['tabular-nums'] },
    picker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing.sm },
    action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: Spacing.xxl },
    empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.section },
    composer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.sm },
    suggestions: { gap: Spacing.xs },
    suggestion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Control.hitTarget },
    banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    quick: { gap: Spacing.sm },
    quickChip: { paddingHorizontal: Spacing.md, minHeight: Control.hitTarget - Spacing.xs, justifyContent: 'center' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
});

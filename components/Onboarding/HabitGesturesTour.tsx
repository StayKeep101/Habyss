import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, RectButton, Swipeable } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Teaches the habit card gestures by letting the user perform them.
 *
 * The card below is a practice card: it uses the same Swipeable configuration
 * and the same long-press-then-drag gesture as the real one, so the muscle
 * memory transfers, but nothing it does is recorded. A tour that quietly logged
 * a completion would start the user's history with something they did not do.
 *
 * Only gestures that actually exist are taught, and each one says where it
 * works. Swipe and tap work on the Roadmap tab and inside a goal; dragging and
 * the focus button are wired on Roadmap only.
 */

export type GestureId = 'complete' | 'actions' | 'open' | 'move';

interface Lesson {
    id: GestureId;
    title: string;
    detail: string;
    icon: string;
}

const LESSONS: Lesson[] = [
    { id: 'complete', title: 'Swipe right to complete', detail: 'Swipe back the other way to undo it.', icon: 'checkmark-circle-outline' },
    { id: 'actions', title: 'Swipe left for edit and delete', detail: 'The quickest way to change a target or remove a habit.', icon: 'options-outline' },
    { id: 'open', title: 'Tap to open it', detail: 'Full history, streak and settings for that habit.', icon: 'open-outline' },
    { id: 'move', title: 'Hold, then drag to move it', detail: 'Reorder your day, or drop a habit into another goal. Roadmap tab.', icon: 'move-outline' },
];

interface Props {
    /** The user's habit name, so the practice card feels like theirs. */
    habitName: string;
    targetLabel: string;
    icon?: string;
    onDone: () => void;
    doneLabel?: string;
}

const ACTION_WIDTH = 64;

export const HabitGesturesTour: React.FC<Props> = ({
    habitName, targetLabel, icon = 'ellipse-outline', onDone, doneLabel = 'Done',
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();

    const swipeableRef = useRef<Swipeable>(null);
    const [learned, setLearned] = useState<GestureId[]>([]);
    // Practice only: this never reaches the database.
    const [practiceComplete, setPracticeComplete] = useState(false);
    const [dragging, setDragging] = useState(false);

    const learn = useCallback((id: GestureId) => {
        setLearned(current => {
            if (current.includes(id)) return current;
            successFeedback();
            return [...current, id];
        });
    }, [successFeedback]);

    const remaining = LESSONS.length - learned.length;

    const dragGesture = useMemo(() => Gesture.Pan()
        .activateAfterLongPress(250)
        .onStart(() => { setDragging(true); })
        .onFinalize(() => { setDragging(false); })
        .runOnJS(true), []);

    // Learning 'move' is driven from the gesture callbacks above via state.
    React.useEffect(() => {
        if (dragging) learn('move');
    }, [dragging, learn]);

    const renderLeftActions = () => (
        <RectButton
            style={[styles.leftAction, { backgroundColor: practiceComplete ? colors.surfaceSecondary : '#10B981' }]}
            onPress={() => {
                setPracticeComplete(value => !value);
                swipeableRef.current?.close();
            }}
        >
            <Ionicons name={practiceComplete ? 'close-circle-outline' : 'checkmark-circle-outline'} size={26} color="white" />
        </RectButton>
    );

    const renderRightActions = () => (
        <View style={styles.rightActions}>
            <View style={[styles.rightAction, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="pencil" size={20} color="white" />
            </View>
            <View style={[styles.rightAction, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="trash" size={20} color="white" />
            </View>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Try it on this card</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
                Your habit cards do more than tick off. Give each one a go — this card is for practice, so nothing here is saved.
            </Text>

            <View style={styles.badgeRow}>
                <View style={[styles.badge, { borderColor: accent + '55', backgroundColor: accent + '12' }]}>
                    <Text style={[styles.badgeText, { color: accent }]}>PRACTICE — NOTHING IS SAVED</Text>
                </View>
            </View>

            <GestureDetector gesture={dragGesture}>
                <View style={[styles.dragWrap, dragging && styles.dragging]}>
                    <Swipeable
                        ref={swipeableRef}
                        renderLeftActions={renderLeftActions}
                        renderRightActions={renderRightActions}
                        leftThreshold={30}
                        rightThreshold={35}
                        overshootLeft={false}
                        overshootRight={false}
                        overshootFriction={4}
                        friction={2}
                        onSwipeableWillOpen={(direction: 'left' | 'right') => {
                            lightFeedback();
                            learn(direction === 'left' ? 'complete' : 'actions');
                        }}
                    >
                        <TouchableOpacity
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Practice card for ${habitName}. Swipe, tap or hold to try the gestures.`}
                            onPress={() => { selectionFeedback(); learn('open'); }}
                            style={[styles.card, {
                                backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.05)',
                                borderColor: colors.border,
                            }]}
                        >
                            <View style={[styles.cardIcon, { backgroundColor: accent + '22' }]}>
                                <Ionicons name={icon as any} size={20} color={accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{habitName}</Text>
                                <Text style={[styles.cardSub, { color: colors.textTertiary }]} numberOfLines={1}>{targetLabel}</Text>
                            </View>
                            <Ionicons
                                name={practiceComplete ? 'checkmark-circle' : 'ellipse-outline'}
                                size={26}
                                color={practiceComplete ? '#10B981' : colors.textTertiary}
                            />
                        </TouchableOpacity>
                    </Swipeable>
                </View>
            </GestureDetector>

            <View style={styles.lessons}>
                {LESSONS.map(lesson => {
                    const done = learned.includes(lesson.id);
                    return (
                        <View
                            key={lesson.id}
                            accessibilityRole="text"
                            accessibilityLabel={`${lesson.title}. ${done ? 'Tried' : 'Not tried yet'}`}
                            style={[styles.lesson, {
                                backgroundColor: done ? accent + '12' : (isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)'),
                                borderColor: done ? accent + '55' : 'transparent',
                            }]}
                        >
                            <Ionicons
                                name={(done ? 'checkmark-circle' : lesson.icon) as any}
                                size={20}
                                color={done ? accent : colors.textSecondary}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.lessonTitle, { color: colors.textPrimary }]}>{lesson.title}</Text>
                                <Text style={[styles.lessonDetail, { color: colors.textTertiary }]}>{lesson.detail}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                Swiping and tapping work on the Roadmap tab and inside a goal. Dragging and the focus timer are on Roadmap.
            </Text>

            <TouchableOpacity
                accessibilityRole="button"
                onPress={() => { lightFeedback(); onDone(); }}
                style={[styles.primaryBtn, { backgroundColor: accent }]}
            >
                <Text style={styles.primaryText}>
                    {remaining === 0 ? doneLabel : `${doneLabel} — ${remaining} left to try`}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
    heading: { fontSize: 22, fontFamily: 'Lexend_600SemiBold', marginTop: 4 },
    sub: { fontSize: 14, lineHeight: 20, fontFamily: 'Lexend_400Regular' },
    badgeRow: { flexDirection: 'row', marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
    badgeText: { fontSize: 9, letterSpacing: 1.2, fontFamily: 'Lexend_600SemiBold' },
    dragWrap: { borderRadius: 16, overflow: 'hidden' },
    dragging: { opacity: 0.85, transform: [{ scale: 1.02 }] },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderRadius: 16 },
    cardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    cardSub: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    leftAction: { width: ACTION_WIDTH, justifyContent: 'center', alignItems: 'center' },
    rightActions: { flexDirection: 'row' },
    rightAction: { width: ACTION_WIDTH, justifyContent: 'center', alignItems: 'center' },
    lessons: { gap: 8, marginTop: 4 },
    lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1 },
    lessonTitle: { fontSize: 14, fontFamily: 'Lexend_500Medium' },
    lessonDetail: { fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    footnote: { fontSize: 11, lineHeight: 16, fontFamily: 'Lexend_400Regular' },
    primaryBtn: { paddingVertical: 16, borderRadius: 999, alignItems: 'center', marginTop: 4 },
    primaryText: { color: '#000', fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
});

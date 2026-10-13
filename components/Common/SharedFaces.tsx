import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, surfaceFor } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import type { Participant } from '@/lib/shared';

/**
 * Everybody on a shared habit, and who has done their half.
 *
 * Overlapping, smallest possible, and always on the row rather than behind a
 * tap — the entire point of sharing something is that you can see at a glance
 * who is still holding it up. A face with a ring has done it; a face without
 * has not, and is the reason the row is not finished.
 *
 * Deliberately not a count. "3 people" tells you nothing you can act on;
 * a face you recognise tells you whom to message.
 *
 * Somebody you have invited and who has not answered is here too, dimmed and
 * with a dotted ring. They are not part of the rule — an unanswered invitation
 * cannot hold a habit up — but leaving them off would mean a habit you had just
 * shared looked exactly like one you had not.
 */
export const SharedFaces: React.FC<{
    people: Participant[];
    /** The colour a face is ringed with once that person is done. */
    tint: string;
    size?: number;
    /** How many to draw before the rest become "+2". */
    limit?: number;
}> = ({ people, tint, size = 22, limit = 4 }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);

    if (people.length < 2) return null;
    const shown = people.slice(0, limit);
    const extra = people.length - shown.length;

    return (
        <View
            style={styles.row}
            accessible
            accessibilityLabel={label(people)}
        >
            {shown.map((person, index) => (
                <View
                    key={person.userId}
                    style={[styles.face, {
                        width: size, height: size, borderRadius: size / 2,
                        marginLeft: index === 0 ? 0 : -size / 3,
                        backgroundColor: tone.raised,
                        // The page's own colour behind each one, so overlapping
                        // faces stay separate instead of becoming a smear.
                        borderColor: person.pending ? colors.textTertiary : person.done ? tint : colors.background,
                        borderStyle: person.pending ? 'dotted' : 'solid',
                        zIndex: shown.length - index,
                        // Three steps, not two: done, on it, and not yet
                        // answered — which is fainter than either.
                        opacity: person.pending ? 0.38 : person.done ? 1 : 0.55,
                    }]}
                >
                    {person.avatarUrl ? (
                        <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                    ) : (
                        <Text style={[styles.initial, { color: colors.textSecondary, fontSize: size * 0.42 }]}>
                            {person.username.slice(0, 1).toUpperCase()}
                        </Text>
                    )}
                    {person.done ? (
                        <View style={[styles.tick, { backgroundColor: tint, width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 }]}>
                            <Ionicons name="checkmark" size={size * 0.28} color="#fff" />
                        </View>
                    ) : null}
                </View>
            ))}
            {extra > 0 ? (
                <View style={[styles.face, styles.more, {
                    width: size, height: size, borderRadius: size / 2,
                    marginLeft: -size / 3, backgroundColor: tone.raised, borderColor: colors.background,
                }]}>
                    <Text style={[styles.initial, { color: colors.textTertiary, fontSize: size * 0.36 }]}>{`+${extra}`}</Text>
                </View>
            ) : null}
        </View>
    );
};

/** What a screen reader is told, which a row of overlapping circles cannot say. */
function label(people: Participant[]): string {
    const agreed = people.filter(person => !person.pending);
    const invited = people.length - agreed.length;
    const done = `${agreed.filter(person => person.done).length} of ${agreed.length} done`;
    return invited > 0 ? `${done}, ${invited} invited` : done;
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    face: { borderWidth: 1.5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%' },
    initial: { fontFamily: FontFamily.bold },
    tick: { position: 'absolute', right: -1, bottom: -1, alignItems: 'center', justifyContent: 'center' },
    more: { alignItems: 'center', justifyContent: 'center' },
});

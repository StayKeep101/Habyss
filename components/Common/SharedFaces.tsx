import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
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
    /** Only the others on it, not you: where it is already clearly yours (a habit's own page). */
    othersOnly?: boolean;
}> = ({ people: everyone, tint, size = 22, limit = 4, othersOnly }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);

    if (everyone.length < 2) return null;
    const people = othersOnly ? everyone.filter(person => !person.isYou) : everyone;
    if (!people.length) return null;
    const shown = people.slice(0, limit);
    const extra = people.length - shown.length;

    return (
        <View
            style={styles.row}
            accessible
            accessibilityLabel={othersOnly ? people.map(person => `${person.username}, ${person.pending ? 'invited' : person.done ? 'done today' : 'not done yet'}`).join('; ') : label(people)}
        >
            {shown.map((person, index) => {
                const ring = person.pending ? colors.textTertiary : person.done ? tint : tone.fill;
                const badge = Math.max(10, Math.round(size * 0.5));
                return (
                    // The outer box does not clip, so the tick can sit on the
                    // edge of the face rather than being cut off inside it.
                    <View key={person.userId} style={{
                        width: size, height: size,
                        marginLeft: index === 0 ? 0 : -Math.round(size * 0.3),
                        zIndex: shown.length - index,
                        opacity: person.pending ? 0.7 : 1,
                    }}>
                        <View style={[styles.face, {
                            width: size, height: size, borderRadius: size / 2,
                            backgroundColor: tone.raised,
                            // A ring in the card's own colour cuts each face out
                            // of the one behind it; done swaps it for the tint.
                            borderColor: ring,
                            borderStyle: person.pending ? 'dotted' : 'solid',
                        }]}>
                            {person.avatarUrl ? (
                                <Image source={{ uri: person.avatarUrl }} style={styles.photo} />
                            ) : (
                                <Text style={[styles.initial, { color: colors.textSecondary, fontSize: size * 0.42 }]}>
                                    {person.username.slice(0, 1).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        {person.done ? (
                            <View style={[styles.tick, {
                                width: badge, height: badge, borderRadius: badge / 2,
                                right: -badge * 0.3, bottom: -badge * 0.3,
                                backgroundColor: tint, borderColor: tone.fill,
                            }]}>
                                <Ionicons name="checkmark" size={badge * 0.62} color={colors.background} />
                            </View>
                        ) : null}
                    </View>
                );
            })}
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
    // Room on the right and below for the tick that hangs off the last face.
    row: { flexDirection: 'row', alignItems: 'center', paddingRight: 3, paddingBottom: 3 },
    face: { borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photo: { width: '100%', height: '100%', resizeMode: 'cover' },
    initial: { fontFamily: FontFamily.bold },
    tick: { position: 'absolute', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    more: { alignItems: 'center', justifyContent: 'center' },
});

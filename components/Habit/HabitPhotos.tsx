import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SectionTitle, Text } from '@/components/ui';
import { loadTickPhotos, onTickPhotos, photosOf, type TickPhoto } from '@/lib/tickPhotos';
import { Radius, Spacing } from '@/theme/designSystem';

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** The photos taken as this habit was ticked (lib/tickPhotos.ts), newest first. Nothing until there is one. */
export function HabitPhotos({ habitId }: { habitId: string }) {
    const [photos, setPhotos] = useState<{ day: string; photo: TickPhoto }[]>([]);
    useEffect(() => {
        const read = () => setPhotos(photosOf(habitId));
        void loadTickPhotos().then(read);
        return onTickPhotos(read);
    }, [habitId]);
    if (!photos.length) return null;
    return (
        <View>
            <SectionTitle first>Photos</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {photos.map(({ day, photo }) => (
                    <View key={day} style={styles.item}>
                        <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel={`Photo from ${dayLabel(day)}`} />
                        <Text variant="caption" tone="muted" align="center">{dayLabel(day)}</Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const SIZE = Spacing.section * 3.5;

const styles = StyleSheet.create({
    row: { gap: Spacing.sm },
    item: { gap: Spacing.xs },
    photo: { width: SIZE, height: SIZE * (4 / 3), borderRadius: Radius.small },
});

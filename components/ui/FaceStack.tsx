import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Avatar } from './Avatar';

export interface Face { userId: string; name: string; avatarUrl?: string }

/**
 * A few friends' faces, overlapping left to right, each in a ring: who is
 * focusing with you, on the focus page and on the timeline card of what you
 * are focusing on. A face fades in as it arrives. Draws nothing for no one.
 */
export function FaceStack({ faces, size = 28, ring, shown = 4 }: { faces: Face[]; size?: number; ring?: string; shown?: number }) {
    if (faces.length === 0) return null;
    const step = size - Math.round(size * 0.3);
    const count = Math.min(faces.length, shown);
    return (
        <View style={[styles.stack, { width: size + (count - 1) * step, height: size + 4 }]} accessible={false}>
            {faces.slice(0, shown).map((face, index) => (
                <Animated.View key={face.userId} entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
                    style={[styles.face, { left: index * step, zIndex: shown - index }]}>
                    <Avatar name={face.name} uri={face.avatarUrl} size={size} ring={ring} />
                </Animated.View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    stack: {},
    face: { position: 'absolute', top: 0 },
});

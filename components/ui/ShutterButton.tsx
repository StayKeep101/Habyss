import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '@/theme/colors';
import { Control, Spacing } from '@/theme/designSystem';

/** How wide the shutter is: the camera's own size, well past the 44 pt floor. */
const SIZE = Control.height + Spacing.lg;

/**
 * The camera's shutter, the one everyone knows: a white ring around a white
 * disc, over the photo itself. Pressed, the disc shrinks a little.
 */
export function ShutterButton({ onPress, busy, label = 'Take photo' }: { onPress: () => void; busy?: boolean; label?: string }) {
    const white = Colors.common.white;
    return (
        <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy }}
            style={[styles.ring, { borderColor: white }]}>
            {({ pressed }) => (
                <View style={[styles.disc, { backgroundColor: white, transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
                    {busy ? <ActivityIndicator color={Colors.common.black} /> : null}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: Spacing.xs, alignItems: 'center', justifyContent: 'center' },
    disc: { width: SIZE - Spacing.lg, height: SIZE - Spacing.lg, borderRadius: (SIZE - Spacing.lg) / 2, alignItems: 'center', justifyContent: 'center' },
});

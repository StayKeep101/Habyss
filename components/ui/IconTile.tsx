import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { textOn } from '@/theme/tokens';

/**
 * An icon on a solid tile of its colour, the way Phantom shows a coin: the
 * colour at full strength with a white (or black, whichever reads) filled
 * glyph on it. Faint tinted circles made every colour in the app look washed
 * out; this is what makes them pop.
 *
 * `shape` is a disc by default, or a rounded square for rows of items.
 */
export function IconTile({ icon, color, size = 36, shape = 'disc', muted, style }: {
    icon: string;
    color: string;
    size?: number;
    shape?: 'disc' | 'square';
    /** Done or inactive: the tile steps back to a soft tint. */
    muted?: boolean;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <View style={[{
            width: size, height: size, borderRadius: shape === 'disc' ? size / 2 : size * 0.3,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: muted ? color + '33' : color,
        }, style]}>
            <AppIcon filled name={icon} size={Math.round(size * 0.5)} color={muted ? color : textOn(color)} />
        </View>
    );
}

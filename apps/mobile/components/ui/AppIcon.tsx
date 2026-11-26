import React from 'react';
import { Image, Text, type ImageStyle, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Control } from '@/theme/designSystem';

export type IconName = keyof typeof Ionicons.glyphMap;
export type AppIconProps = Omit<React.ComponentProps<typeof Ionicons>, 'name'> & {
    name?: string;
    /** Draw the solid version ("book" for "book-outline") where Ionicons has one. */
    filled?: boolean;
};

/** Every glyph name there is: the icon picker's catalogue is built from it. */
export const ICON_NAMES = Object.keys(Ionicons.glyphMap ?? {}) as IconName[];

/** "book-outline" → "book", when that exists; anything else as it is. */
export function solidIcon(name: string): string {
    if (!name.endsWith('-outline')) return name;
    const solid = name.slice(0, -'-outline'.length);
    return Ionicons.glyphMap && Object.hasOwn(Ionicons.glyphMap, solid) ? solid : name;
}

/** All interface glyphs come from Ionicons, including legacy saved emoji choices. */
const legacyIcons: Record<string, IconName> = {
    '😊': 'happy-outline', '🙂': 'chatbubble-ellipses-outline', '👨': 'person-outline',
    '💪': 'barbell-outline', '🔥': 'flame-outline', '🎯': 'flag-outline',
    '📝': 'checkbox-outline', '⭐': 'star-outline', '✨': 'sparkles-outline',
    '🎉': 'sparkles-outline', '🚀': 'rocket-outline', '💯': 'ribbon-outline',
    '📚': 'book-outline', '💧': 'water-outline', '🏃': 'walk-outline',
    '🧘': 'leaf-outline', '💼': 'briefcase-outline', '🏆': 'trophy-outline',
};

/** A picture the user chose, held as a uri rather than a glyph name. */
export const isPhotoIcon = (name: string): boolean =>
    /^(file:|content:|ph:|assets-library:|data:image\/|https?:)/.test(name);

/**
 * A glyph the user typed, rather than one of ours.
 *
 * Anything non-ASCII and short that Ionicons does not know: an emoji, a Kanji,
 * a single letter in another script. The length cap is on code points, because
 * a flag or a family is several of them and still one glyph.
 */
export const isGlyphIcon = (name: string): boolean =>
    !Object.hasOwn(legacyIcons, name)
    && !(Ionicons.glyphMap && Object.hasOwn(Ionicons.glyphMap, name))
    && !/^[\x00-\x7F]*$/.test(name)
    && [...name].length <= 8;

/**
 * One icon, whatever the user chose it to be.
 *
 * Habits used to be limited to the collection, so "your own icon"
 * had nowhere to go. A saved icon can now be an Ionicons name, a picture from
 * the photo library, or a glyph typed in — and because every card, row and
 * chip in the app draws its icons through here, teaching this one component
 * about the other two is what makes them work everywhere.
 */
function Icon({ name = 'ellipse-outline', size = Control.icon, filled, ...props }: AppIconProps) {
    if (isPhotoIcon(name)) {
        // Rounded like the tiles it sits in, so a square photograph does not
        // look pasted on top of the interface.
        return <Image source={{ uri: name }} style={[
            { width: size, height: size, borderRadius: Number(size) * 0.28 },
            props.style as StyleProp<ImageStyle>,
        ]} accessibilityIgnoresInvertColors />;
    }
    if (isGlyphIcon(name)) {
        // No colour: a glyph carries its own, and tinting it would only grey it.
        return <Text allowFontScaling={false} style={[
            { fontSize: Number(size) * 0.92, lineHeight: Number(size) * 1.1, textAlign: 'center' },
            props.style as StyleProp<TextStyle>,
        ]}>{name}</Text>;
    }
    const named = legacyIcons[name] ?? name;
    const candidate = filled ? solidIcon(named) : named;
    const resolved = Ionicons.glyphMap && !Object.hasOwn(Ionicons.glyphMap, candidate)
        ? 'ellipse-outline' : candidate as IconName;
    return <Ionicons {...props} name={resolved} size={size} />;
}

// Preserve the name type used by existing icon pickers and configuration lists.
export const AppIcon = Object.assign(Icon, { glyphMap: Ionicons.glyphMap });

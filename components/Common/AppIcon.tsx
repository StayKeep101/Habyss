import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Control } from '@/constants/DesignSystem';

export type IconName = keyof typeof Ionicons.glyphMap;
export type AppIconProps = Omit<React.ComponentProps<typeof Ionicons>, 'name'> & { name?: string };

/** All interface glyphs come from Ionicons, including legacy saved emoji choices. */
const legacyIcons: Record<string, IconName> = {
    '😊': 'happy-outline', '🙂': 'chatbubble-ellipses-outline', '👨': 'person-outline',
    '💪': 'barbell-outline', '🔥': 'flame-outline', '🎯': 'flag-outline',
    '📝': 'checkbox-outline', '⭐': 'star-outline', '✨': 'sparkles-outline',
    '🎉': 'sparkles-outline', '🚀': 'rocket-outline', '💯': 'ribbon-outline',
    '📚': 'book-outline', '💧': 'water-outline', '🏃': 'walk-outline',
    '🧘': 'leaf-outline', '💼': 'briefcase-outline', '🏆': 'trophy-outline',
};

function Icon({ name = 'ellipse-outline', size = Control.icon, ...props }: AppIconProps) {
    const candidate = legacyIcons[name] ?? name;
    const resolved = Ionicons.glyphMap && !Object.hasOwn(Ionicons.glyphMap, candidate)
        ? 'ellipse-outline' : candidate as IconName;
    return <Ionicons {...props} name={resolved} size={size} />;
}

// Preserve the name type used by existing icon pickers and configuration lists.
export const AppIcon = Object.assign(Icon, { glyphMap: Ionicons.glyphMap });

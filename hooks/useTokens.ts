import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import {
    elevationFor, radius, rolesFor, space, textOn, tint, typeScale,
    type ColorRoles, type ElevationToken, type TintLevel,
} from '@/theme/tokens';

export interface Tokens {
    theme: string;
    /** The theme's roles, with the user's chosen accent in place of the default. */
    color: ColorRoles & {
        /** The accent, adjusted to stay readable as text on the background. */
        accentText: string;
        /** White or black, whichever reads on a solid accent fill. */
        onAccent: string;
    };
    /** A colour at one of the three tint strengths; the accent by default. */
    tint: (level: TintLevel, color?: string) => string;
    elevation: (level: ElevationToken) => object;
    space: typeof space;
    radius: typeof radius;
    type: typeof typeScale;
}

/** The design tokens for the current theme and accent. */
export function useTokens(): Tokens {
    const { theme } = useTheme();
    const { primary, foreground } = useAccentGradient();
    return useMemo(() => {
        const roles = rolesFor(theme);
        const accent = primary || roles.accent;
        return {
            theme,
            color: { ...roles, accent, accentText: foreground || accent, onAccent: textOn(accent) },
            tint: (level, color = accent) => tint(color, level),
            elevation: level => elevationFor(theme, level),
            space,
            radius,
            type: typeScale,
        };
    }, [theme, primary, foreground]);
}

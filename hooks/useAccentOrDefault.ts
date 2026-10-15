import { createContext, useContext, useMemo } from 'react';
import * as Accent from '@/context/AccentContext';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { readableAccent } from '@/lib/colorContrast';

type AccentValue = { accentGradient: { colors: readonly string[]; shadowColor?: string } } | undefined;
const NONE = createContext<AccentValue>(undefined);
const FALLBACK = ['#3A5A8C', '#8BADD6'];

/**
 * The accent for the building blocks that must render anywhere — the text
 * field — falling back to Habyss blue where no accent is provided (a bare
 * preview, a test that replaces the accent module).
 */
export function useAccentOrDefault(): { foreground: string } {
    const context = useContext((Accent.AccentContext as unknown as React.Context<AccentValue>) ?? NONE);
    const { theme } = useTheme();
    return useMemo(() => {
        const colors = context?.accentGradient.colors ?? FALLBACK;
        return { foreground: readableAccent(colors[0], (Colors[theme] ?? Colors.abyss).background) };
    }, [context, theme]);
}

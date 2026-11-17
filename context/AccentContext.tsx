import React, { createContext, useContext, useState, useEffect, useMemo, useSyncExternalStore, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { Colors, PALETTE } from '@/theme/colors';
import { DEFAULT_PALETTE, paletteFor } from '@/theme/palettes';
import { contrastRatio, mixHex, readableAccent } from '@/lib/colorContrast';
import { loadRankLook, shownRankLook, subscribeRankLook } from '@/lib/rankLook';
import { rankGradient } from '@/theme/rankLooks';

// Beautiful gradient presets for app accent
export const ACCENT_GRADIENTS = [
    { id: 'habyss', name: 'Habyss', colors: ['#4268FF', '#7098FF'], shadowColor: '#4F7BFF' }, // Habyss blue, at full strength
    { id: 'electric', name: 'Electric Blue', colors: ['#3B82F6', '#8B5CF6'], shadowColor: '#3B82F6' },
    { id: 'ocean', name: 'Ocean Wave', colors: ['#0EA5E9', '#06B6D4'], shadowColor: '#0EA5E9' },
    { id: 'sunset', name: 'Sunset', colors: ['#F97316', '#EC4899'], shadowColor: '#F97316' },
    { id: 'aurora', name: 'Aurora', colors: ['#10B981', '#3B82F6'], shadowColor: '#10B981' },
    { id: 'lavender', name: 'Lavender Dream', colors: ['#A855F7', '#EC4899'], shadowColor: '#A855F7' },
    { id: 'rose', name: 'Rose Gold', colors: ['#F43F5E', '#FB7185'], shadowColor: '#F43F5E' },
    { id: 'mint', name: 'Fresh Mint', colors: ['#14B8A6', '#22D3EE'], shadowColor: '#14B8A6' },
    { id: 'royal', name: 'Royal Purple', colors: ['#7C3AED', '#4F46E5'], shadowColor: '#7C3AED' },
    { id: 'fire', name: 'Fire', colors: ['#EF4444', '#F97316'], shadowColor: '#EF4444' },
    { id: 'forest', name: 'Forest', colors: ['#22C55E', '#16A34A'], shadowColor: '#22C55E' },
    { id: 'gold', name: 'Golden Hour', colors: ['#EAB308', '#F97316'], shadowColor: '#EAB308' },
    { id: 'midnight', name: 'Midnight', colors: ['#3730A3', '#6366F1'], shadowColor: '#3730A3' },
] as const;

export type AccentGradientId = typeof ACCENT_GRADIENTS[number]['id'];

interface AccentGradient {
    id: AccentGradientId | 'rank';
    name: string;
    colors: readonly [string, string];
    shadowColor: string;
}

interface AccentContextType {
    accentGradient: AccentGradient;
    /** The colour picked in Appearance, used when the app does not follow the rank. */
    chosenGradient: AccentGradient;
    setAccentGradientId: (id: AccentGradientId) => void;
    /** The app's colour follows your rank (theme/rankLooks.ts): always. */
    followRank: boolean;
    /** Kept for callers; the colour always follows the rank now. */
    setFollowRank: (on: boolean) => void;
    /** The rank whose look is showing, when it is a rank's look. */
    rankShown: string | null;
    getAccentColor: () => string; // Returns primary color
}


const AccentContext = createContext<AccentContextType | undefined>(undefined);

const STORAGE_KEY = 'habyss_accent_gradient';

export function AccentProvider({ children }: { children: ReactNode }) {
    const [gradientId, setGradientId] = useState<AccentGradientId>('habyss');

    // Load saved accent on mount
    useEffect(() => {
        const loadAccent = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved && ACCENT_GRADIENTS.some(g => g.id === saved)) {
                    setGradientId(saved as AccentGradientId);
                }
            } catch (e) {
                console.error('Failed to load accent:', e);
            }
        };
        loadAccent();
    }, []);

    const setAccentGradientId = async (id: AccentGradientId) => {
        setGradientId(id);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, id);
        } catch (e) {
            console.error('Failed to save accent:', e);
        }
    };

    // Your rank dresses the app, always (or, from the Developer page, any rank for a preview).
    // The colour picked before rank looks is kept only for the moment before your rank is known.
    const followRank = true;
    const setFollowRank = (_on: boolean) => undefined;
    useEffect(() => { void loadRankLook(); }, []);
    // The hourglass in use (lib/rankLook.ts shownRankLook): a preview, the one you picked, else your rank.
    const rankShown = useSyncExternalStore(subscribeRankLook, shownRankLook, shownRankLook);
    // The palette the app wears (context/ThemeContext.tsx): Lost when it is the Default theme.
    const { palette } = useTheme();

    const chosenGradient = (ACCENT_GRADIENTS.find(g => g.id === gradientId) || ACCENT_GRADIENTS[0]) as AccentGradient;
    const accentGradient: AccentGradient = useMemo(() => {
        // Any palette but the original (Default's Habyss blue, or the Hourglass theme): its own accent.
        if (PALETTE !== 'original' && palette !== DEFAULT_PALETTE) {
            const colors = [...paletteFor(palette).accent] as [string, string];
            return { id: 'rank', name: palette, colors, shadowColor: colors[0] };
        }
        // The original (Lost, or PALETTE = 'original'): your rank's own colour as the accent.
        if (!rankShown) return chosenGradient;
        const gem = rankGradient(rankShown);
        return { id: 'rank', name: rankShown, colors: gem, shadowColor: gem[0] };
    }, [rankShown, chosenGradient, palette]);

    const getAccentColor = () => mixHex(accentGradient.colors[0], accentGradient.colors[1]);

    return (
        <AccentContext.Provider value={{ accentGradient, chosenGradient, setAccentGradientId, getAccentColor, followRank, setFollowRank, rankShown }}>
            {children}
        </AccentContext.Provider>
    );
}

/** A string that changes when the rank or preview does, for useSyncExternalStore. */

export function useAccent() {
    const context = useContext(AccentContext);
    if (!context) {
        throw new Error('useAccent must be used within AccentProvider');
    }
    return context;
}

// Helper hook to get gradient colors for components
export function useAccentGradient() {
    const { accentGradient } = useAccent();
    const { theme } = useTheme();
    return useMemo(() => {
        // One accent colour for every solid use — the middle of the gradient —
        // so a blue-to-purple theme fills chips, rings and icons in the same
        // violet its gradient button reads as, not in the blue of one end.
        const solid = mixHex(accentGradient.colors[0], accentGradient.colors[1]);
        const lightAccent = contrastRatio('#000000', solid) > contrastRatio('#FFFFFF', solid);
        return {
        colors: accentGradient.colors as [string, string],
        shadowColor: solid,
        primary: solid,
        secondary: accentGradient.colors[1],
        foreground: readableAccent(solid, Colors[theme].background),
        // A light accent (the top ranks' pale gold, Eternal's white light) keeps its
        // own colour with dark labels; any other is darkened just enough for white ones.
        buttonColors: (lightAccent ? [...accentGradient.colors] : accentGradient.colors.map(color => readableAccent(color, '#ffffff'))) as [string, string],
        /** The label colour on a filled accent button. */
        buttonInk: lightAccent ? Colors.common.black : Colors.common.white,
        };
    }, [accentGradient, theme]);
}

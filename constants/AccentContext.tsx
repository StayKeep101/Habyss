import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Beautiful gradient presets for app accent
export const ACCENT_GRADIENTS = [
    { id: 'habyss', name: 'Habyss', colors: ['#3A5A8C', '#8BADD6'], shadowColor: '#3A5A8C' }, // Original Habyss blue
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
    id: AccentGradientId;
    name: string;
    colors: readonly [string, string];
    shadowColor: string;
}

interface AccentContextType {
    accentGradient: AccentGradient;
    setAccentGradientId: (id: AccentGradientId) => void;
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

    const accentGradient = ACCENT_GRADIENTS.find(g => g.id === gradientId) || ACCENT_GRADIENTS[0];

    const getAccentColor = () => accentGradient.colors[0];

    return (
        <AccentContext.Provider value={{ accentGradient, setAccentGradientId, getAccentColor }}>
            {children}
        </AccentContext.Provider>
    );
}

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
    return {
        colors: accentGradient.colors as [string, string],
        shadowColor: accentGradient.shadowColor,
        primary: accentGradient.colors[0],
        secondary: accentGradient.colors[1],
    };
}

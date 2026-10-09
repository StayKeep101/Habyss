import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '@/hooks/useTokens';

export interface ScreenProps {
    children: React.ReactNode;
    /** Scrolls by default; a screen that manages its own list can turn it off. */
    scroll?: boolean;
    /** Safe-area edges to pad. Tabs usually want only the top. */
    edges?: ('top' | 'bottom')[];
    /** Space between direct children. */
    gap?: 'md' | 'lg' | 'xl' | '2xl';
}

/** The page every screen is built on: background, safe area, gutters and rhythm. */
export function Screen({ children, scroll = true, edges = ['top'], gap = 'xl' }: ScreenProps) {
    const t = useTokens();
    const inner = { paddingHorizontal: t.space.xl, paddingBottom: t.space['4xl'], gap: t.space[gap] };
    return (
        <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.color.background }}>
            {scroll ? (
                <ScrollView contentContainerStyle={inner} showsVerticalScrollIndicator={false}>{children}</ScrollView>
            ) : (
                <View style={[{ flex: 1 }, inner]}>{children}</View>
            )}
        </SafeAreaView>
    );
}

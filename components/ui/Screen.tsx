import React from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
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
    /** Pull to refresh. */
    refreshControl?: React.ReactElement<RefreshControlProps>;
    /** A soft glow of the accent at the top, as the tab screens have. */
    wash?: boolean;
    /** Leave room at the bottom for the floating tab bar. */
    tabBar?: boolean;
}

/** The page every screen is built on: background, safe area, gutters and rhythm. */
export function Screen({ children, scroll = true, edges = ['top'], gap = 'xl', refreshControl, wash, tabBar }: ScreenProps) {
    const t = useTokens();
    const { tabBarClearance } = useResponsiveLayout();
    const inner = { paddingHorizontal: t.space.xl, paddingTop: t.space.sm, paddingBottom: tabBar ? tabBarClearance : t.space['4xl'], gap: t.space[gap] };
    return (
        <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.color.background }}>
            {wash ? (
                <LinearGradient pointerEvents="none" colors={[t.tint('subtle'), t.tint('subtle', t.color.background), t.color.background]}
                    locations={[0, 0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%' }} />
            ) : null}
            {scroll ? (
                <ScrollView contentContainerStyle={inner} refreshControl={refreshControl} showsVerticalScrollIndicator={false}>{children}</ScrollView>
            ) : (
                <View style={[{ flex: 1 }, inner]}>{children}</View>
            )}
        </SafeAreaView>
    );
}

import { Spacing } from '@/theme/designSystem';
import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The widest the content of a page gets: wider windows give it room around, not longer lines. */
export const READABLE_WIDTH = 720;
/** From this window width the tab bar becomes a rail down the left side (iPad, an open foldable). */
export const RAIL_FROM = 744;
export const RAIL_WIDTH = 96;

export function useResponsiveLayout() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    return useMemo(() => {
        const shortestSide = Math.min(width, height);
        const isCompactWidth = width <= 350;
        const isCompactHeight = height <= 700;
        const isSmallDevice = isCompactWidth || isCompactHeight;

        const horizontalPadding = isCompactWidth ? Spacing.lg : Spacing.xl;
        const sectionGap = isSmallDevice ? Spacing.md : Spacing.lg;
        const topSpacing = isCompactHeight ? Spacing.md : Spacing.xl;

        const tabBarHeight = isCompactWidth ? 56 : 64;
        const floatingButtonSize = isCompactWidth ? 56 : 64;
        const tabBarBottomOffset = Math.max(insets.bottom + (isCompactHeight ? 10 : 16), isCompactHeight ? 12 : 18);
        // A wide window (iPad, Split View at two thirds, a foldable opened
        // flat) has the tabs down the side, so nothing floats over the bottom.
        const railed = width >= RAIL_FROM;
        const tabBarClearance = railed
            ? insets.bottom + Spacing.xl
            // Plus the Now bar that sits over the tab bar (components/Focus/FocusMiniBar.tsx).
            : tabBarBottomOffset + Math.max(tabBarHeight, floatingButtonSize) + (isCompactHeight ? 20 : 28) + 64;
        const isTablet = Platform.OS === 'ios' && Platform.isPad;

        return {
            width,
            height,
            shortestSide,
            insets,
            isCompactWidth,
            isCompactHeight,
            isSmallDevice,
            horizontalPadding,
            sectionGap,
            topSpacing,
            tabBarHeight,
            floatingButtonSize,
            tabBarBottomOffset,
            tabBarClearance,
            railed,
            isTablet,
        };
    }, [height, insets, width]);
}

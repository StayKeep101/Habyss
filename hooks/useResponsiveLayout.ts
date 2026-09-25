import { Spacing } from '@/constants/DesignSystem';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        const tabBarClearance = tabBarBottomOffset + Math.max(tabBarHeight, floatingButtonSize) + (isCompactHeight ? 20 : 28);

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
        };
    }, [height, insets, width]);
}

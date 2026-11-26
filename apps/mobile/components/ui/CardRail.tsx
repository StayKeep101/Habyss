import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Spacing } from '@/theme/designSystem';

/**
 * Cards side by side, swiped one at a time, the next one peeking in at the
 * edge so it is obvious there is more. Runs to the screen's edges (it undoes
 * the page's side padding). One card fills the width on its own.
 */
export function CardRail({ children }: { children: React.ReactNode }) {
    const { width, horizontalPadding } = useResponsiveLayout();
    const cards = React.Children.toArray(children).filter(Boolean);
    if (cards.length <= 1) return <>{cards}</>;
    const card = width - horizontalPadding * 2 - Spacing.section;
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast"
            snapToInterval={card + Spacing.md} snapToAlignment="start" disableIntervalMomentum
            style={{ marginHorizontal: -horizontalPadding }}
            contentContainerStyle={[styles.row, { paddingHorizontal: horizontalPadding }]}>
            {cards.map((child, index) => <View key={index} style={{ width: card }}>{child}</View>)}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: { gap: Spacing.md, alignItems: 'stretch' },
});

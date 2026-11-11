import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { ShareButton, ShareSummary } from '@/components/Common/ShareButton';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { Control, Spacing, Typography } from '@/theme/designSystem';

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    onAction?: () => void;
    shareSummary?: ShareSummary;
    actionIcon?: keyof typeof Ionicons.glyphMap;
    actionLabel?: string;
    backIcon?: 'chevron-back' | 'close';
    rightSlot?: React.ReactNode;
    /**
     * An animated style for the title: a page whose own big title scrolls away
     * hands it to the header, fading it in as it goes.
     */
    titleStyle?: React.ComponentProps<typeof Animated.View>['style'];
    /**
     * A mark before the title (a habit's icon): the header then reads from the
     * left, mark, title and the line under it, with no back button (a sheet
     * closes by swiping down), and the mark fades in with the title.
     */
    leading?: React.ReactNode;
    /**
     * A second title that takes over once the page's own headline has scrolled
     * away ("16 missed" for "Missed"): `titleStyle` fades the first out,
     * `altStyle` fades this one in, in the same place.
     */
    altTitle?: string;
    altStyle?: React.ComponentProps<typeof Animated.View>['style'];
}

/**
 * Every sheet's header, one way: its name centred at the top in the sheet
 * title size, on the page's own 20 pt margins with room under the sheet's top
 * edge. Its actions sit on the right; a close button (a form with edits to
 * discard) on the left. The two sides are kept the same width, so the name is
 * centred on the sheet whatever sits beside it. A habit's mark goes in front
 * of its name, the pair centred together.
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title, subtitle, onBack, onAction, actionIcon = 'share-outline', actionLabel,
    shareSummary, backIcon = 'chevron-back', rightSlot, titleStyle, leading, altTitle, altStyle,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [sides, setSides] = React.useState({ left: 0, right: 0 });
    const side = Math.max(sides.left, sides.right);
    const right = rightSlot ?? (onAction
        ? <IconButton icon={actionIcon} label={actionLabel ?? (actionIcon === 'person-add-outline' ? 'Add friend' : 'Share')} onPress={onAction} />
        : shareSummary ? <ShareButton summary={shareSummary} /> : null);

    // A habit's page: its mark and name read from the left, as they always have,
    // with the actions on the right and no balancing space to squeeze the name.
    if (leading) {
        return (
            <View style={[styles.header, styles.headerLeading]}>
                <Animated.View style={[styles.lead, styles.leadStart, titleStyle]}>
                    {leading}
                    <View style={styles.copyStart}>
                        <Text accessibilityRole="header" numberOfLines={1} style={[Typography.sheetTitle, { color: colors.textPrimary }]}>{title}</Text>
                        {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
                    </View>
                </Animated.View>
                {right ? <View style={styles.sideRight}>{right}</View> : null}
            </View>
        );
    }

    return (
        <View style={styles.header}>
            <View style={[styles.side, { minWidth: side }]}>
                {onBack ? (
                    <View onLayout={event => { const left = event.nativeEvent.layout.width; setSides(current => (current.left === left ? current : { ...current, left })); }}>
                        <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} size={backIcon === 'close' ? 22 : 26} />
                    </View>
                ) : null}
            </View>
            <View style={styles.copySlot}>
                <Animated.View style={[styles.lead, titleStyle]}>
                    {leading}
                    <View style={styles.copy}>
                        <Text accessibilityRole="header" numberOfLines={1} style={[Typography.sheetTitle, styles.centered, { color: colors.textPrimary }]}>{title}</Text>
                        {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.centered, styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
                    </View>
                </Animated.View>
                {altTitle ? (
                    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.alt, altStyle]}>
                        <Text numberOfLines={1} style={[Typography.sheetTitle, styles.centered, { color: colors.textPrimary }]}>{altTitle}</Text>
                    </Animated.View>
                ) : null}
            </View>
            <View style={[styles.side, styles.sideRight, { minWidth: side }]}>
                {right ? (
                    <View onLayout={event => { const width = event.nativeEvent.layout.width; setSides(current => (current.right === width ? current : { ...current, right: width })); }}>
                        {right}
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, minHeight: Control.hitTarget },
    side: { minHeight: Control.hitTarget, justifyContent: 'center', alignItems: 'flex-start' },
    sideRight: { alignItems: 'flex-end' },
    copySlot: { flex: 1, minHeight: Control.hitTarget, justifyContent: 'center' },
    lead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm + Spacing.xs },
    copy: { flexShrink: 1 },
    alt: { justifyContent: 'center' },
    centered: { textAlign: 'center' },
    subtitle: { marginTop: 2 },
    headerLeading: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
    leadStart: { flex: 1, justifyContent: 'flex-start', minHeight: Control.hitTarget, paddingLeft: Spacing.xs },
    copyStart: { flex: 1 },
});

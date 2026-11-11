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
    /** 'leading': the title reads from the left (no back button), with its action on the right. */
    align?: 'center' | 'leading';
}

/** Equal side columns keep the heading centered, including with multiple actions. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title, subtitle, onBack, onAction, actionIcon = 'share-outline', actionLabel,
    shareSummary, backIcon = 'chevron-back', rightSlot, titleStyle, leading, align = 'center', altTitle, altStyle,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [actionWidth, setActionWidth] = React.useState<number>(Control.hitTarget);
    const right = rightSlot ?? (onAction
        ? <IconButton icon={actionIcon} label={actionLabel ?? (actionIcon === 'person-add-outline' ? 'Add friend' : 'Share')} onPress={onAction} />
        : shareSummary ? <ShareButton summary={shareSummary} /> : null);

    if (leading || align === 'leading') {
        return (
            // Room under a sheet's grabber, so the title never sits jammed against the top.
            // Title from the left: on the page's own side margins (the content's 20 pt),
            // with room under the sheet's top edge, as iOS sheets set it.
            <View style={[styles.header, leading ? styles.headerSheet : styles.headerLeading]}>
                <Animated.View style={[styles.lead, !leading && styles.leadBare, titleStyle]}>
                    {leading}
                    <View style={styles.leadCopy}>
                        <Text accessibilityRole="header" numberOfLines={1} style={[Typography.title, { color: colors.textPrimary }]}>{title}</Text>
                        {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.leadSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
                    </View>
                </Animated.View>
                <View style={styles.rightSlot}>{right}</View>
            </View>
        );
    }

    return (
        <View style={styles.header}>
            <View style={{ width: actionWidth }}>
                {onBack ? <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} size={backIcon === 'close' ? 22 : 26} /> : null}
            </View>
            <View style={styles.copySlot}>
                <Animated.View style={[styles.copy, titleStyle]}>
                    <Text accessibilityRole="header" numberOfLines={1} style={[Typography.title, styles.centered, { color: colors.textPrimary }]}>{title}</Text>
                    {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
                </Animated.View>
                {altTitle ? (
                    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.copy, styles.alt, altStyle]}>
                        <Text numberOfLines={1} style={[Typography.title, styles.centered, { color: colors.textPrimary }]}>{altTitle}</Text>
                    </Animated.View>
                ) : null}
            </View>
            <View onLayout={event => setActionWidth(Math.max(Control.hitTarget, event.nativeEvent.layout.width))} style={styles.rightSlot}>{right}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, paddingBottom: Spacing.md },
    copySlot: { flex: 1 },
    copy: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
    alt: { justifyContent: 'center' },
    rightSlot: { minWidth: Control.hitTarget, minHeight: Control.hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
    centered: { textAlign: 'center' },
    subtitle: { marginTop: Spacing.xs, textAlign: 'center' },
    headerSheet: { paddingTop: Spacing.lg },
    headerLeading: { paddingTop: Spacing.lg, paddingHorizontal: Spacing.xl },
    leadBare: { paddingLeft: 0 },
    lead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + Spacing.xs, minHeight: Control.hitTarget, paddingLeft: Spacing.xs },
    leadCopy: { flex: 1 },
    leadSubtitle: { marginTop: 2 },
});

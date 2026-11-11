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
 * Every sheet's header, one way: the title from the left on the page's own
 * 20 pt margins, with room under the sheet's top edge, and its actions on the
 * right. A sheet that keeps a close button (a form with edits to discard)
 * puts it first and the title after it; a habit's mark sits there too.
 */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title, subtitle, onBack, onAction, actionIcon = 'share-outline', actionLabel,
    shareSummary, backIcon = 'chevron-back', rightSlot, titleStyle, leading, altTitle, altStyle,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const right = rightSlot ?? (onAction
        ? <IconButton icon={actionIcon} label={actionLabel ?? (actionIcon === 'person-add-outline' ? 'Add friend' : 'Share')} onPress={onAction} />
        : shareSummary ? <ShareButton summary={shareSummary} /> : null);

    return (
        <View style={styles.header}>
            {onBack ? (
                <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} size={backIcon === 'close' ? 22 : 26} />
            ) : null}
            <View style={styles.copySlot}>
                <Animated.View style={[styles.lead, titleStyle]}>
                    {leading}
                    <View style={styles.copy}>
                        <Text accessibilityRole="header" numberOfLines={1} style={[Typography.title, { color: colors.textPrimary }]}>{title}</Text>
                        {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
                    </View>
                </Animated.View>
                {altTitle ? (
                    <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.alt, altStyle]}>
                        <Text numberOfLines={1} style={[Typography.title, { color: colors.textPrimary }]}>{altTitle}</Text>
                    </Animated.View>
                ) : null}
            </View>
            {right ? <View style={styles.rightSlot}>{right}</View> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, minHeight: Control.hitTarget },
    copySlot: { flex: 1, minHeight: Control.hitTarget, justifyContent: 'center' },
    lead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + Spacing.xs },
    copy: { flex: 1 },
    alt: { justifyContent: 'center' },
    rightSlot: { minWidth: Control.hitTarget, minHeight: Control.hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
    subtitle: { marginTop: 2 },
});

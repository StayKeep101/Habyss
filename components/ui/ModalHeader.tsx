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
}

/** Equal side columns keep the heading centered, including with multiple actions. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title, subtitle, onBack, onAction, actionIcon = 'share-outline', actionLabel,
    shareSummary, backIcon = 'chevron-back', rightSlot, titleStyle,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [actionWidth, setActionWidth] = React.useState<number>(Control.hitTarget);
    const right = rightSlot ?? (onAction
        ? <IconButton icon={actionIcon} label={actionLabel ?? (actionIcon === 'person-add-outline' ? 'Add friend' : 'Share')} onPress={onAction} />
        : shareSummary ? <ShareButton summary={shareSummary} /> : null);

    return (
        <View style={styles.header}>
            <View style={{ width: actionWidth }}>
                {onBack ? <IconButton icon={backIcon} label={backIcon === 'close' ? 'Close' : 'Back'} onPress={onBack} size={backIcon === 'close' ? 22 : 26} /> : null}
            </View>
            <Animated.View style={[styles.copy, titleStyle]}>
                <Text accessibilityRole="header" numberOfLines={1} style={[Typography.title, styles.centered, { color: colors.textPrimary }]}>{title}</Text>
                {subtitle ? <Text numberOfLines={1} style={[Typography.caption, styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text> : null}
            </Animated.View>
            <View onLayout={event => setActionWidth(Math.max(Control.hitTarget, event.nativeEvent.layout.width))} style={styles.rightSlot}>{right}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, paddingBottom: Spacing.md },
    copy: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xs },
    rightSlot: { minWidth: Control.hitTarget, minHeight: Control.hitTarget, alignItems: 'flex-end', justifyContent: 'center' },
    centered: { textAlign: 'center' },
    subtitle: { marginTop: Spacing.xs, textAlign: 'center' },
});

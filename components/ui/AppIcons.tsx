import React from 'react';
import { requireNativeComponent, UIManager, View, type ViewStyle } from 'react-native';
import { Spacing } from '@/theme/designSystem';

type NativeProps = { habitId: string; version: number; size: number; style?: ViewStyle };
const NativeIcons = UIManager.hasViewManagerConfig?.('AppTimeIconsView')
    ? requireNativeComponent<NativeProps>('AppTimeIconsView')
    : null;

/** Whether this build can draw the chosen apps' icons (1.0.8). */
export const appIconsSupported = (): boolean => !!NativeIcons;

/**
 * The apps a habit counts time in, as their own icons in a row (Tracking →
 * Apps). Only iOS can draw them: Habyss never learns which apps they are.
 * `version` changes after the picker closes, so a new choice shows at once.
 * Nothing on a build without it.
 */
export function AppIcons({ habitId, version = 0, size = Spacing.section - Spacing.xs }: { habitId: string; version?: number; size?: number }) {
    if (!NativeIcons || !habitId) return null;
    return (
        <View accessible accessibilityLabel="The apps you chose" style={{ height: size }}>
            <NativeIcons habitId={habitId} version={version} size={size} style={{ height: size, width: '100%' }} />
        </View>
    );
}

import React from 'react';
import { Modal, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/theme/colors';
import { surfaceFor } from '@/theme/designSystem';

interface VoidModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Runs once the sheet has finished dismissing (iOS only, as per RN's Modal). */
    onDismiss?: () => void;
}

/**
 * Sheet presented the same way as the routed screens (goal detail, habit detail,
 * AI settings), which use expo-router's `presentation: 'modal'`.
 *
 * Both end up as a UIKit page sheet, so the rounded corners, the card behind and
 * the drag-to-dismiss are Apple's own: the whole sheet is draggable with real
 * rubber-band physics, not a gesture attached to a small handle. `onRequestClose`
 * fires when the sheet is swiped away, which keeps `visible` in sync; React
 * Native requires the two props together for exactly that reason.
 *
 * A page sheet cannot be transparent, so there is no custom scrim. iOS dims and
 * scales the screen behind on its own.
 */
export const VoidModal: React.FC<VoidModalProps> = ({ visible, onClose, children, style, onDismiss }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            allowSwipeDismissal
            onRequestClose={onClose}
            onDismiss={onDismiss}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                {/* The card's own material: lit at the top and falling into the
                    page colour, so the window reads as raised over the dimmed
                    screen behind it (iOS draws that dim; a native sheet cannot
                    cast a shadow of its own). */}
                <View style={{ flex: 1, backgroundColor: colors.background }}>
                    <LinearGradient pointerEvents="none" colors={[tone.top, tone.fill, colors.background]} locations={[0, 0.18, 0.5]}
                        style={StyleSheet.absoluteFill} />
                    {/* The sheet already starts below the status bar, so only the
                        bottom edge needs insetting. */}
                    <View style={[{ flex: 1, paddingBottom: insets.bottom, paddingTop: Platform.OS === 'ios' ? 0 : insets.top, paddingLeft: insets.left, paddingRight: insets.right }, style]}>
                        {children}
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

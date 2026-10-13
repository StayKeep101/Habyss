import React from 'react';
import { Modal, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoidShell } from '@/components/ui/VoidShell';

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
                <VoidShell>
                    {/* The sheet already starts below the status bar, so only the
                        bottom edge needs insetting. */}
                    <View style={[{ flex: 1, paddingBottom: insets.bottom, paddingTop: Platform.OS === 'ios' ? 0 : insets.top, paddingLeft: insets.left, paddingRight: insets.right }, style]}>
                        {children}
                    </View>
                </VoidShell>
            </GestureHandlerRootView>
        </Modal>
    );
};

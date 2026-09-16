import React from 'react';
import { Modal, StyleProp, View, ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoidShell } from '@/components/Layout/VoidShell';

interface VoidModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Runs once the sheet has finished dismissing (iOS only, as per RN's Modal). */
    onDismiss?: () => void;
}

/**
 * Full-screen sheet.
 *
 * Presents like a pushed screen rather than a partial bottom sheet: the same
 * VoidShell background as the rest of the app, no dimmed backdrop over the
 * screen behind, and no drag handle. A translucent modal over a darkened
 * background had to composite both layers during the slide, which is what made
 * opening feel heavy and left a visible shadowed layer.
 *
 * Every caller provides its own close control in ModalHeader, and
 * onRequestClose keeps the Android back button working.
 */
export const VoidModal: React.FC<VoidModalProps> = ({ visible, onClose, children, style, onDismiss }) => {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
            onDismiss={onDismiss}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <VoidShell>
                    <View
                        accessibilityViewIsModal
                        style={[
                            { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom },
                            style,
                        ]}
                    >
                        {children}
                    </View>
                </VoidShell>
            </GestureHandlerRootView>
        </Modal>
    );
};

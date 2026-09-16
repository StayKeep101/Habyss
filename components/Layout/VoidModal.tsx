import React from 'react';
import { View, Pressable, Modal, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';

interface VoidModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    heightPercentage?: number;
    style?: StyleProp<ViewStyle>;
}

export const VoidModal: React.FC<VoidModalProps> = ({ visible, onClose, children, heightPercentage = 0.75, style }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const background: [string, string] = theme === 'light' ? ['#FFFFFF', '#F7FAFF'] : theme === 'trueDark' ? ['#030303', '#000000'] : ['#0f1218', '#080a0e'];
    const dismissGesture = Gesture.Pan().onEnd(event => {
        if (event.translationY > 60 || event.velocityY > 500) runOnJS(onClose)();
    });

    // A single controlled native modal owns presentation. No delayed close callback
    // can reopen the sheet or leave a transparent view intercepting touches.
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={styles.container}>
                <Pressable accessibilityLabel="Close sheet" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} onPress={onClose} />
                <View accessibilityViewIsModal style={[styles.sheet, { height: Math.min(height * heightPercentage, height - insets.top - 8), paddingBottom: Math.max(insets.bottom, 12), borderColor: colors.border }, style]}>
                    <LinearGradient colors={background} style={StyleSheet.absoluteFill} />
                    <GestureDetector gesture={dismissGesture}>
                        <View style={styles.handleArea}>
                            <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
                        </View>
                    </GestureDetector>
                    <View style={{ flex: 1 }}>{children}</View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderWidth: 1, borderBottomWidth: 0 },
    handleArea: { height: 20, alignItems: 'center', justifyContent: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2, opacity: 0.45 },
});

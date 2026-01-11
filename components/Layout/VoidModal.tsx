import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Dimensions, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAG_THRESHOLD = 100;

interface VoidModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    heightPercentage?: number;
    style?: StyleProp<ViewStyle>;
}

export const VoidModal: React.FC<VoidModalProps> = ({
    visible,
    onClose,
    children,
    heightPercentage = 0.75,
    style
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';

    const SHEET_HEIGHT = SCREEN_HEIGHT * heightPercentage;
    const [isOpen, setIsOpen] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
        contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }, [SHEET_HEIGHT]);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 300);
    }, [onClose, SHEET_HEIGHT]);

    useEffect(() => {
        if (visible && !isOpen) openModal();
        else if (!visible && isOpen) closeModal();
    }, [visible]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) runOnJS(closeModal)();
            else translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [1, 0], Extrapolation.CLAMP) }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    // Determine Gradient Colors based on Theme
    let bgColors: string[] = ['#0f1218', '#080a0e']; // Default Abyss
    if (isLight) {
        bgColors = ['#FFFFFF', '#F5F5F7'];
    } else if (isTrueDark) {
        bgColors = ['#000000', '#000000'];
    }

    if (!isOpen && !visible) return null;

    return (
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
            <View style={styles.container}>
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
                    <TouchableOpacity style={[StyleSheet.absoluteFill, { backgroundColor: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)' }]} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, { height: SHEET_HEIGHT }, sheetStyle, style]}>
                        <LinearGradient colors={bgColors as [string, string, ...string[]]} style={StyleSheet.absoluteFill} />
                        {/* Optional border overlay */}
                        <View style={[StyleSheet.absoluteFill, styles.sheetBorder, { borderColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(34, 197, 94, 0.15)' }]} />

                        <Animated.View style={[{ flex: 1 }, contentStyle]}>
                            {children}
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        // Shadow for separation
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    sheetBorder: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1, // Ensure border is visible if color allows
        borderBottomWidth: 0,
        pointerEvents: 'none'
    },
});

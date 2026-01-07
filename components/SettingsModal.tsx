import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions, Platform, Pressable, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { height } = Dimensions.get('window');

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose, title, children }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onClose} />
                </Animated.View>

                {/* Modal Content */}
                <Animated.View
                    entering={SlideInDown.springify().damping(20).mass(0.8)}
                    style={[styles.modalWrapper, { backgroundColor: theme === 'light' ? colors.background : 'rgba(10, 10, 15, 0.95)' }]}
                >
                    {theme !== 'light' && (
                        <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={StyleSheet.absoluteFill} />
                    )}

                    <View style={styles.content}>
                        <View style={styles.handle} />

                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceTertiary }]}>
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {children}
                        </ScrollView>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalWrapper: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        maxHeight: height * 0.85,
    },
    content: {
        padding: 24,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        maxHeight: height * 0.6,
    }
});

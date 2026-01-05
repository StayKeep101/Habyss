import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions, Platform, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, SlideInDown, FadeOut } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

const { width } = Dimensions.get('window');

interface TechModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    subtitle?: string;
    height?: number | string;
}

export const TechModal: React.FC<TechModalProps> = ({ visible, onClose, title, children, subtitle, height }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View
                    entering={Animated.FadeIn.duration(200)}
                    exiting={Animated.FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onClose} />
                </Animated.View>

                {/* Modal Content */}
                <Animated.View
                    entering={SlideInDown.springify().damping(20).mass(0.8)}
                    exiting={SlideInDown.springify().damping(20).mass(0.8).withCallback((finished) => {
                        // Optional callback
                    })}
                    style={[styles.modalWrapper, { height: height || 'auto' }]}
                >
                    <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint="dark" style={StyleSheet.absoluteFill} />

                    {/* Glowing Border Top */}
                    <View style={styles.glowLine} />

                    <View style={styles.content}>
                        <View style={styles.handle} />

                        <View style={styles.header}>
                            <View>
                                <Text style={styles.title}>{title.toUpperCase()}</Text>
                                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.body}>
                            {children}
                        </View>
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
        backgroundColor: 'rgba(10, 10, 15, 0.85)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 40,
        maxHeight: '90%',
    },
    glowLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#8B5CF6',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 10,
        zIndex: 10,
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
        fontSize: 14,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
    },
    subtitle: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
        fontFamily: 'Lexend_400Regular',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        // flex: 1,
    }
});

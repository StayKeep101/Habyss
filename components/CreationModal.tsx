import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter, Modal, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export const CreationModal = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { horizontalPadding, floatingButtonSize, tabBarBottomOffset } = useResponsiveLayout();
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const pending = useRef<'habit' | 'goal' | null>(null);
    const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const open = DeviceEventEmitter.addListener('show_creation_modal', () => setVisible(true));
        const close = DeviceEventEmitter.addListener('close_creation_modal', () => setVisible(false));
        return () => { open.remove(); close.remove(); if (fallback.current) clearTimeout(fallback.current); };
    }, []);
    const openSelection = () => {
        const selection = pending.current;
        pending.current = null;
        if (fallback.current) clearTimeout(fallback.current);
        // Creating a habit opens quick add; the full form is for editing,
        // reachable from quick add's More options.
        if (selection === 'habit') DeviceEventEmitter.emit('show_quick_add');
        if (selection === 'goal') DeviceEventEmitter.emit('show_goal_quick_add');
    };
    const choose = (selection: 'habit' | 'goal') => {
        if (pending.current) return;
        pending.current = selection;
        setVisible(false);
        // Android does not deliver onDismiss.
        fallback.current = setTimeout(openSelection, 350);
    };
    return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)} onDismiss={openSelection} statusBarTranslucent>
        <View style={{ flex: 1 }}>
            <Pressable accessibilityLabel="Close creation menu" onPress={() => setVisible(false)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
            <View accessibilityViewIsModal style={{ position: 'absolute', right: horizontalPadding, bottom: tabBarBottomOffset, gap: 14, alignItems: 'flex-end' }}>
                {([{ id: 'goal', label: 'Goal', icon: 'flag-outline', color: primary }, { id: 'habit', label: 'Habit', icon: 'repeat', color: '#10B981' }] as const).map(item =>
                    <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={'Create ' + item.label.toLowerCase()} onPress={() => choose(item.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: floatingButtonSize / 2, paddingLeft: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Lexend_500Medium' }}>{item.label}</Text>
                        <View style={{ width: floatingButtonSize, height: floatingButtonSize, borderRadius: floatingButtonSize / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: item.color }}>
                            <Ionicons name={item.icon} size={26} color="#fff" />
                        </View>
                    </TouchableOpacity>)}
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close creation menu" onPress={() => setVisible(false)}
                    style={{ width: floatingButtonSize, height: floatingButtonSize, borderRadius: floatingButtonSize / 2, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    </Modal>;
};

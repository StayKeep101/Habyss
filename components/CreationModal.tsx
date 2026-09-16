import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ModalHeader } from '@/components/Layout/ModalHeader';

export const CreationModal = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
        if (selection === 'habit') DeviceEventEmitter.emit('show_habit_modal');
        if (selection === 'goal') router.push('/create');
    };
    const choose = (selection: 'habit' | 'goal') => {
        pending.current = selection;
        setVisible(false);
        // Android does not deliver onDismiss; also tolerate interrupted native transitions.
        fallback.current = setTimeout(openSelection, 400);
    };
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)} onDismiss={openSelection}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <Pressable accessibilityLabel="Close creation menu" onPress={() => setVisible(false)} style={{ flex: 1 }} />
            <View style={{ backgroundColor: colors.surface, padding: 24, paddingBottom: Math.max(insets.bottom, 24), borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary, alignSelf: 'center', marginBottom: 8, opacity: 0.4 }} />
                <ModalHeader title="Create" onBack={() => setVisible(false)} backIcon="close" />
                <View style={{ flexDirection: 'row', gap: 14 }}>
                    {([{ id: 'habit', label: 'Habit', icon: 'repeat', color: '#10B981' }, { id: 'goal', label: 'Goal', icon: 'flag-outline', color: colors.primary }] as const).map(item =>
                        <TouchableOpacity key={item.id} accessibilityRole="button" onPress={() => choose(item.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 24, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}>
                            <Ionicons name={item.icon} size={32} color={item.color} />
                            <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Lexend_600SemiBold' }}>{item.label}</Text>
                        </TouchableOpacity>)}
                </View>
            </View>
        </View>
    </Modal>;
};

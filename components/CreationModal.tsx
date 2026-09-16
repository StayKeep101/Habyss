import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { SheetSection } from '@/components/Layout/SheetSection';

export const CreationModal = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
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
        if (selection === 'habit') DeviceEventEmitter.emit('show_habit_modal');
        if (selection === 'goal') router.push('/create');
    };

    const choose = (selection: 'habit' | 'goal') => {
        pending.current = selection;
        setVisible(false);
        // Android does not deliver onDismiss; also tolerate interrupted native transitions.
        fallback.current = setTimeout(openSelection, 400);
    };

    const options = [
        { id: 'habit', label: 'Habit', icon: 'repeat', color: '#10B981', blurb: 'Something you repeat on a schedule.' },
        { id: 'goal', label: 'Goal', icon: 'flag-outline', color: colors.primary, blurb: 'An outcome your habits build toward.' },
    ] as const;

    return (
        <VoidModal visible={visible} onClose={() => setVisible(false)} onDismiss={openSelection}>
            <View style={{ flex: 1 }}>
                <ModalHeader title="Create" onBack={() => setVisible(false)} backIcon="close" />

                <View style={{ paddingHorizontal: 16 }}>
                    <SheetSection first title="What are you adding?" description="Habits are the work. Goals are what the work adds up to." />

                    <View style={{ gap: 14, marginTop: 14 }}>
                        {options.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                accessibilityRole="button"
                                activeOpacity={0.85}
                                onPress={() => choose(item.id)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 16,
                                    paddingVertical: 20,
                                    paddingHorizontal: 18,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: colors.surfaceSecondary,
                                }}
                            >
                                <View style={{
                                    width: 52, height: 52, borderRadius: 16,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: item.color + '1A',
                                }}>
                                    <Ionicons name={item.icon} size={26} color={item.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: 'Lexend_600SemiBold' }}>
                                        {item.label}
                                    </Text>
                                    <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 3, fontFamily: 'Lexend_400Regular' }}>
                                        {item.blurb}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </VoidModal>
    );
};

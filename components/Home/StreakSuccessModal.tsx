import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { VoidModal } from '@/components/Layout/VoidModal';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';

export const StreakSuccessModal = ({ visible, streak, onClose, completedDates = [] }: {
    visible: boolean; streak: number; onClose: () => void; completedDates?: string[];
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { successFeedback } = useHaptics();
    useEffect(() => { if (visible) successFeedback(); }, [visible, successFeedback]);
    const today = new Date();
    const week = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today); date.setDate(today.getDate() - today.getDay() + index);
        return { date, key: localDateKey(date) };
    });
    return <VoidModal visible={visible} onClose={onClose}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }} bounces={false}>
            <Animated.View entering={ZoomIn.springify()} style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: '#F9731620', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flame" size={62} color="#FF9D23" />
            </Animated.View>
            <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 30, color: '#FF9D23', fontFamily: 'Lexend_600SemiBold' }}>{streak} day{streak === 1 ? '' : 's'}!</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontFamily: 'Lexend_600SemiBold' }}>You showed up today.</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>One day at a time. Keep your streak going.</Text>
            </View>
            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingVertical: 8 }}>
                {week.map(({ date, key }) => {
                    const done = completedDates.includes(key);
                    return <View key={key} style={{ alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{date.toLocaleDateString('en', { weekday: 'narrow' })}</Text>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? '#FF9D23' : colors.surfaceSecondary, borderWidth: key === localDateKey(today) ? 2 : 0, borderColor: '#FF9D23', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={17} color={done ? '#fff' : colors.textTertiary} />
                        </View>
                    </View>;
                })}
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: '100%', padding: 15, borderRadius: 16, alignItems: 'center', backgroundColor: colors.primary, borderBottomWidth: 4, borderBottomColor: colors.primaryDark }}>
                <Text style={{ color: '#fff', fontFamily: 'Lexend_600SemiBold', fontSize: 15 }}>Keep going</Text>
            </TouchableOpacity>
        </ScrollView>
    </VoidModal>;
};

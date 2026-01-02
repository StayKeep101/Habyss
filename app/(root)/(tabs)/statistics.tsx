import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ActivityHeatmap } from '@/components/Analytics/ActivityHeatmap';
import { CategoryOrbit } from '@/components/Analytics/CategoryOrbit';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';

import { VoidShell } from '@/components/Layout/VoidShell';

export default function StatisticsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        lightFeedback();
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 2000);
    };

    return (
        <VoidShell>
            <LinearGradient
                colors={[colors.primary, 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 1, y: 0.6 }}
                style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, opacity: 0.15, borderRadius: 150, transform: [{ scaleX: 1.5 }] }}
            />

            <ScrollView
                contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -1 }}>
                        Quantified Self
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 4 }}>
                        Your progress, visualized.
                    </Text>
                </View>

                {/* Key Metrics Row */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <View style={{ flex: 1, padding: 20, borderRadius: 24, backgroundColor: colors.surfaceSecondary, alignItems: 'center' }}>
                        <Ionicons name="flame" size={24} color="#F59E0B" style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>12</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>DAY STREAK</Text>
                    </View>
                    <View style={{ flex: 1, padding: 20, borderRadius: 24, backgroundColor: colors.surfaceSecondary, alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" style={{ marginBottom: 8 }} />
                        <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>85%</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>COMPLETION</Text>
                    </View>
                </View>

                {/* Main Visuals */}
                <ActivityHeatmap />

                <View style={{ height: 24 }} />

                <CategoryOrbit />

                {/* Insight Card */}
                <View style={{ marginTop: 24, padding: 24, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="bulb" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>AI INSIGHT</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}>
                        You are most productive on Tuesdays. Consider moving your hardest "Deep Work" sessions to Tuesday mornings to maximize output.
                    </Text>
                </View>

            </ScrollView>
        </VoidShell>
    );
}

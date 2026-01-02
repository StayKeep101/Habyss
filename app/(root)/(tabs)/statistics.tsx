import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { BlurView } from 'expo-blur';

export default function StatisticsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <LinearGradient
                colors={[colors.accent, colors.background]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0.4 }}
                style={{ position: 'absolute', width: '100%', height: 400, opacity: 0.2 }}
            />

            <ScrollView contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 }}>
                    Analytics
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 40 }}>
                    Quantified Self.
                </Text>

                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
                    <View style={{ flex: 1, aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceSecondary }}>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 40, fontWeight: 'bold', color: colors.textPrimary }}>85%</Text>
                            <Text style={{ color: colors.textSecondary }}>Completion</Text>
                        </View>
                    </View>
                    <View style={{ flex: 1, aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surfaceSecondary }}>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 40, fontWeight: 'bold', color: colors.textPrimary }}>12</Text>
                            <Text style={{ color: colors.textSecondary }}>Day Streak</Text>
                        </View>
                    </View>
                </View>

                <View style={{ borderRadius: 24, overflow: 'hidden', height: 200, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textTertiary }}>Chart Placeholder</Text>
                </View>

            </ScrollView>
        </View>
    );
}

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { BlurView } from 'expo-blur';

export default function RoadmapScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <LinearGradient
                colors={[colors.primaryDark, colors.background]}
                style={{ position: 'absolute', width: '100%', height: 400 }}
            />

            <ScrollView contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 }}>
                    Vision Board
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 40 }}>
                    Your long-term trajectory.
                </Text>

                {[1, 2, 3].map((i) => (
                    <View key={i} style={{ marginBottom: 20, borderRadius: 24, overflow: 'hidden' }}>
                        <BlurView intensity={20} tint="dark" style={{ padding: 24, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' }}>Q{i} Goals</Text>
                                <Text style={{ color: colors.primaryLight, fontWeight: 'bold' }}>In Progress</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 10 }}>
                                <View style={{ width: `${30 * i}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
                            </View>
                        </BlurView>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

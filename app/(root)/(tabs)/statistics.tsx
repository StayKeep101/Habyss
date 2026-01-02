import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ActivityHeatmap } from '@/components/Analytics/ActivityHeatmap';
import { CategoryOrbit } from '@/components/Analytics/CategoryOrbit';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';

import { VoidShell } from '@/components/Layout/VoidShell';
import { BlurView } from 'expo-blur';

import { VoidCard } from '@/components/Layout/VoidCard';
import { ScreenHeader } from '@/components/Layout/ScreenHeader';

export default function StatisticsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { thud } = useHaptics();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = () => {
        thud();
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 2000);
    };

    const DataPoint = ({ label, value, icon, color }: any) => (
        <VoidCard style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <Ionicons name={icon} size={20} color={color} style={{ opacity: 0.8 }} />
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 }} />
            </View>
            <Text style={[styles.dataValue, { color: colors.textPrimary }]}>{value}</Text>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>{label}</Text>
        </VoidCard>
    );

    return (
        <VoidShell>
            <ScrollView
                contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                <ScreenHeader title="COCKPIT" subtitle="SYSTEM STATUS :: ONLINE" />

                {/* Key Metrics Grid */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                    <View style={{ flex: 1 }}>
                        <DataPoint label="CURRENT STREAK" value="12" icon="flame" color="#FFD93D" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <DataPoint label="COMPLETION RATE" value="85%" icon="disc" color="#00FF94" />
                    </View>
                </View>

                {/* Main Visuals Section */}
                <View style={{ gap: 24 }}>
                    <VoidCard glass style={{ padding: 4 }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TEMPORAL DENSITY</Text>
                            <Ionicons name="apps" size={16} color={colors.textTertiary} />
                        </View>
                        <ActivityHeatmap />
                    </VoidCard>

                    <VoidCard glass style={{ padding: 4 }}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ORBITAL ANALYSIS</Text>
                            <Ionicons name="planet" size={16} color={colors.textTertiary} />
                        </View>
                        <CategoryOrbit />
                    </VoidCard>
                </View>

                {/* Insight Card */}
                <View style={[styles.insightCard, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="terminal" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>ANALYSIS</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22, fontFamily: 'SpaceMono-Regular' }}>
                        &gt; Efficiency peak detected on <Text style={{ color: colors.primary }}>Tuesdays</Text>.
                        {'\n'}&gt; Recommend shifting high-viscosity tasks to TUE/AM sector.
                    </Text>
                </View>

            </ScrollView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        fontFamily: 'SpaceGrotesk-Bold', // Assuming you have this or similar setup, otherwise system font bold
    },
    headerSubtitle: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
        opacity: 0.8,
        fontFamily: 'SpaceMono-Regular',
    },
    dataCard: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
    },
    dataValue: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 4,
        fontFamily: 'SpaceMono-Regular', // Monospace for data
    },
    dataLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    },
    insightCard: {
        marginTop: 32,
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderLeftWidth: 4, // Tech styling
    },
});

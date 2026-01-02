import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { VoidCard } from '@/components/Layout/VoidCard';

export default function SettingsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Mock State for settings
    const [notifications, setNotifications] = useState(true);
    const [sound, setSound] = useState(true);
    const [haptics, setHaptics] = useState(true);

    const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
        Haptics.selectionAsync();
        setter(!value);
    };

    const SettingItem = ({ icon, label, value, onToggle }: any) => (
        <View style={styles.settingItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={[styles.iconBox, { borderColor: colors.border }]}>
                    <Ionicons name={icon} size={20} color={colors.textSecondary} />
                </View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{label}</Text>
            </View>
            <Switch
                trackColor={{ false: '#3e3e3e', true: colors.primary }}
                thumbColor={colors.textPrimary}
                ios_backgroundColor="#3e3e3e"
                onValueChange={() => toggleSwitch(onToggle, value)}
                value={value}
            />
        </View>
    );

    const MenuLink = ({ icon, label, onPress, destructive = false }: any) => (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.settingItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={[styles.iconBox, { borderColor: colors.border }]}>
                    <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.textSecondary} />
                </View>
                <Text style={[styles.settingLabel, { color: destructive ? colors.error : colors.textPrimary }]}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
        </TouchableOpacity>
    );

    return (
        <VoidShell>
            <ScrollView contentContainerStyle={styles.scrollContent}>



                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>S</Text>
                        </View>
                        <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                            <Ionicons name="checkmark" size={12} color="black" />
                        </View>
                    </View>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>SourKiwi888</Text>
                    <Text style={[styles.email, { color: colors.textSecondary }]}>sourkiwi888@gmail.com</Text>

                    <View style={[styles.tag, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.tagText, { color: colors.primary }]}>MASTER OF ROUTINE</Text>
                    </View>
                </View>

                {/* Settings Groups */}
                <VoidCard glass style={styles.groupCard}>
                    <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
                    <SettingItem icon="notifications-outline" label="Notifications" value={notifications} onToggle={setNotifications} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem icon="volume-high-outline" label="Sound Effects" value={sound} onToggle={setSound} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <SettingItem icon="phone-portrait-outline" label="Haptics" value={haptics} onToggle={setHaptics} />
                </VoidCard>

                <VoidCard glass style={styles.groupCard}>
                    <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
                    <MenuLink icon="star-outline" label="Manage Subscription" onPress={() => router.push('/paywall')} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <MenuLink icon="help-buoy-outline" label="Support" onPress={() => { }} />
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <MenuLink icon="log-out-outline" label="Log Out" onPress={() => router.replace('/(auth)/welcome')} destructive />
                </VoidCard>

                <View style={styles.footer}>
                    <Text style={[styles.quote, { color: colors.textSecondary }]}>"Descend into discipline"</Text>
                    <Text style={[styles.version, { color: colors.textTertiary }]}>v1.0.4 • Void Build</Text>
                </View>

            </ScrollView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: 80,
        paddingBottom: 120,
        paddingHorizontal: 20,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#050505',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    email: {
        fontSize: 14,
        marginBottom: 16,
    },
    tag: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    groupCard: {
        marginBottom: 24,
    },
    groupTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
        marginTop: 20,
        marginLeft: 20,
        marginBottom: 8,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        marginLeft: 72,
    },
    footer: {
        alignItems: 'center',
        marginTop: 20,
    },
    quote: {
        fontStyle: 'italic',
        marginBottom: 8,
    },
    version: {
        fontSize: 12,
    }
});

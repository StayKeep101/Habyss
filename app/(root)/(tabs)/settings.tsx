import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, TextInput, Alert, ActivityIndicator, Image, Linking, Platform } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { VoidCard } from '@/components/Layout/VoidCard';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { StripeService } from '@/lib/stripeService';
import { LinearGradient } from 'expo-linear-gradient';

// Conditionally require ImagePicker
let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // User state
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);

    // Settings state - use global context
    const {
        hapticsEnabled, setHapticsEnabled,
        soundsEnabled, setSoundsEnabled,
        notificationsEnabled, setNotificationsEnabled,
        aiPersonality
    } = useAppSettings();

    // Profile picture state
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(false);

    // Load user profile
    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setEmail(user.email || '');

                // Try to get username from profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', user.id)
                    .single();

                if (profile?.username) {
                    setUsername(profile.username);
                } else {
                    setUsername(user.email?.split('@')[0] || 'User');
                }

                // Load saved avatar
                const savedAvatar = await AsyncStorage.getItem('profile_avatar');
                if (savedAvatar) setAvatarUri(savedAvatar);

                // Check premium status
                const status = await StripeService.getSubscriptionStatus();
                setIsPremium(status.premium);
            }
        };
        loadProfile();
    }, []);

    // Check username availability
    const checkUsernameAvailability = async (name: string) => {
        if (name.length < 3) {
            setUsernameAvailable(null);
            return;
        }

        setCheckingUsername(true);
        const { data: { user } } = await supabase.auth.getUser();

        // Check if any user (other than current user) has this username
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .ilike('username', name.toLowerCase()) // Case-insensitive search
            .neq('id', user?.id || '');

        setCheckingUsername(false);

        // Username is available if no matching rows found (data is empty array or null)
        const isTaken = data && data.length > 0;
        setUsernameAvailable(!isTaken);
    };

    // Save new username
    const saveUsername = async () => {
        if (!usernameAvailable || newUsername.length < 3) return;

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user?.id,
                username: newUsername.toLowerCase(),
                updated_at: new Date().toISOString()
            });

        setSaving(false);

        if (error) {
            Alert.alert('Error', 'Could not save username');
        } else {
            setUsername(newUsername);
            setIsEditingUsername(false);
            setNewUsername('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    const handleChangeAvatar = async () => {
        if (!ImagePicker) return Alert.alert("Feature Unavailable", "Rebuild required.");

        Alert.alert(
            "Change Profile Picture",
            "Choose an option",
            [
                {
                    text: "Take Photo",
                    onPress: async () => {
                        try {
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== 'granted') {
                                Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
                                return;
                            }

                            const result = await ImagePicker.launchCameraAsync({
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                            });

                            if (!result.canceled && result.assets && result.assets[0]) {
                                const uri = result.assets[0].uri;
                                setAvatarUri(uri);
                                await AsyncStorage.setItem('profile_avatar', uri);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } catch (error) {
                            console.error('Camera error:', error);
                            Alert.alert('Error', 'Could not access camera. Please try again.');
                        }
                    }
                },
                {
                    text: "Choose from Library",
                    onPress: async () => {
                        try {
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== 'granted') {
                                Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
                                return;
                            }

                            const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ['images'],
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                            });

                            if (!result.canceled && result.assets && result.assets[0]) {
                                const uri = result.assets[0].uri;
                                setAvatarUri(uri);
                                await AsyncStorage.setItem('profile_avatar', uri);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } catch (error) {
                            console.error('Library error:', error);
                            Alert.alert('Error', 'Could not access photo library. Please try again.');
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const toggleGlobalSetting = (setter: (val: boolean) => void, currentValue: boolean) => {
        if (hapticsEnabled) Haptics.selectionAsync();
        setter(!currentValue);
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
                onValueChange={() => onToggle(!value)}
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

    const handleLogout = async () => {
        // Clear all cached user data before logging out
        const { clearHabitsCache } = await import('@/lib/habits');
        clearHabitsCache();

        await supabase.auth.signOut();
        router.replace('/(auth)/welcome');
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header with Settings Button */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.selectionAsync();
                            router.push('/(root)/settings');
                        }}
                        style={[styles.settingsButton, { borderColor: colors.border }]}
                    >
                        <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>PROFILE</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Profile Section */}
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={handleChangeAvatar} style={styles.avatarContainer}>
                            {/* Premium gradient border */}
                            {isPremium && (
                                <LinearGradient
                                    colors={['#10B981', '#3B82F6', '#8B5CF6', '#10B981']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.premiumAvatarBorder}
                                />
                            )}
                            <View style={[
                                styles.avatarPlaceholder,
                                {
                                    backgroundColor: colors.surfaceSecondary,
                                    borderColor: isPremium ? 'transparent' : colors.border,
                                    overflow: 'hidden',
                                }
                            ]}>
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={{ width: 100, height: 100 }} />
                                ) : (
                                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>
                                        {username[0]?.toUpperCase() || 'U'}
                                    </Text>
                                )}
                            </View>
                            <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                                <Ionicons name="camera" size={12} color="black" />
                            </View>
                            {/* PRO Badge */}
                            {isPremium && (
                                <LinearGradient
                                    colors={['#10B981', '#3B82F6']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.proBadge}
                                >
                                    <Text style={styles.proBadgeText}>PRO</Text>
                                </LinearGradient>
                            )}
                        </TouchableOpacity>

                        {/* Username (Editable) */}
                        {isEditingUsername ? (
                            <View style={styles.usernameEditContainer}>
                                <View style={[styles.usernameInput, { borderColor: usernameAvailable ? colors.success : colors.border }]}>
                                    <TextInput
                                        value={newUsername}
                                        onChangeText={(text) => {
                                            setNewUsername(text);
                                            checkUsernameAvailability(text);
                                        }}
                                        placeholder="Enter username"
                                        placeholderTextColor={colors.textTertiary}
                                        style={[styles.usernameInputText, { color: colors.textPrimary }]}
                                        autoCapitalize="none"
                                        autoFocus
                                    />
                                    {checkingUsername && <ActivityIndicator size="small" color={colors.primary} />}
                                    {!checkingUsername && usernameAvailable === true && (
                                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                    )}
                                    {!checkingUsername && usernameAvailable === false && (
                                        <Ionicons name="close-circle" size={20} color={colors.error} />
                                    )}
                                </View>
                                <View style={styles.usernameButtons}>
                                    <TouchableOpacity
                                        onPress={() => setIsEditingUsername(false)}
                                        style={[styles.cancelBtn, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={saveUsername}
                                        disabled={!usernameAvailable || saving}
                                        style={[styles.saveBtn, { backgroundColor: usernameAvailable ? colors.primary : colors.surfaceTertiary }]}
                                    >
                                        {saving ? (
                                            <ActivityIndicator size="small" color="#000" />
                                        ) : (
                                            <Text style={{ color: '#000', fontWeight: 'bold' }}>Save</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => {
                                setNewUsername(username);
                                setIsEditingUsername(true);
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={[styles.name, { color: colors.textPrimary }]}>{username}</Text>
                                    <Ionicons name="pencil" size={16} color={colors.textTertiary} />
                                </View>
                            </TouchableOpacity>
                        )}

                        <Text style={[styles.email, { color: colors.textSecondary }]}>{email}</Text>

                        <View style={[styles.tag, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.tagText, { color: colors.primary }]}>MASTER OF ROUTINE</Text>
                        </View>
                    </View>

                    {/* Settings Groups */}
                    <VoidCard glass style={styles.groupCard}>
                        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
                        <SettingItem icon="notifications-outline" label="Notifications" value={notificationsEnabled} onToggle={() => toggleGlobalSetting(setNotificationsEnabled, notificationsEnabled)} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem icon="volume-high-outline" label="Sound Effects" value={soundsEnabled} onToggle={() => toggleGlobalSetting(setSoundsEnabled, soundsEnabled)} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <SettingItem icon="phone-portrait-outline" label="Haptics" value={hapticsEnabled} onToggle={() => toggleGlobalSetting(setHapticsEnabled, hapticsEnabled)} />
                    </VoidCard>

                    {/* AI Section */}
                    <VoidCard glass style={styles.groupCard}>
                        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>AI ASSISTANT</Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (hapticsEnabled) Haptics.selectionAsync();
                                router.push('/(root)/ai-settings');
                            }}
                            activeOpacity={0.7}
                            style={styles.settingItem}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <View style={[styles.iconBox, { borderColor: colors.border }]}>
                                    <Text style={{ fontSize: 18 }}>{PERSONALITY_MODES.find(m => m.id === aiPersonality)?.icon || '🙂'}</Text>
                                </View>
                                <View>
                                    <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>AI Personality</Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceMono-Regular' }}>
                                        {PERSONALITY_MODES.find(m => m.id === aiPersonality)?.name || 'Normal'}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                        </TouchableOpacity>
                    </VoidCard>

                    <VoidCard glass style={styles.groupCard}>
                        <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
                        <MenuLink icon="star-outline" label="Manage Subscription" onPress={() => router.push('/paywall')} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <MenuLink icon="help-buoy-outline" label="Support" onPress={() => { }} />
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <MenuLink icon="log-out-outline" label="Log Out" onPress={handleLogout} destructive />
                    </VoidCard>

                    {/* Feedback Section */}
                    <VoidCard style={styles.groupCard}>
                        <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>FEEDBACK</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16, fontFamily: 'SpaceMono-Regular' }}>
                            We'd love to hear from you! Help us make Habyss even better.
                        </Text>
                        <TouchableOpacity
                            onPress={() => Linking.openURL('mailto:feedback@habyss.app?subject=Habyss Feedback')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary + '20',
                                padding: 16,
                                borderRadius: 12,
                                gap: 12,
                            }}
                        >
                            <Ionicons name="mail-outline" size={20} color={colors.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>Send Feedback</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceMono-Regular' }}>feedback@habyss.app</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => Linking.openURL('https://habyss.app/feature-request')}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.surfaceSecondary,
                                padding: 16,
                                borderRadius: 12,
                                gap: 12,
                                marginTop: 12,
                            }}
                        >
                            <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>Request a Feature</Text>
                                <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'SpaceMono-Regular' }}>Tell us what you want</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </VoidCard>

                    {/* Rating Section */}
                    <VoidCard style={styles.groupCard}>
                        <Text style={[styles.groupTitle, { color: colors.textTertiary }]}>RATE US</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16, fontFamily: 'SpaceMono-Regular' }}>
                            Enjoying Habyss? Leave a review!
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => {
                                        if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        // Open App Store
                                        const storeUrl = Platform.OS === 'ios'
                                            ? 'https://apps.apple.com/app/habyss/id123456789'
                                            : 'https://play.google.com/store/apps/details?id=com.habyss.app';
                                        Linking.openURL(storeUrl);
                                    }}
                                >
                                    <Ionicons name="star" size={32} color="#F59E0B" />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                const storeUrl = Platform.OS === 'ios'
                                    ? 'https://apps.apple.com/app/habyss/id123456789'
                                    : 'https://play.google.com/store/apps/details?id=com.habyss.app';
                                Linking.openURL(storeUrl);
                            }}
                            style={{
                                backgroundColor: '#F59E0B',
                                paddingVertical: 14,
                                borderRadius: 12,
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15, fontFamily: 'SpaceGrotesk-Bold' }}>
                                Rate on {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
                            </Text>
                        </TouchableOpacity>
                    </VoidCard>

                    <View style={styles.footer}>
                        <Text style={[styles.quote, { color: colors.textSecondary }]}>"Descend into discipline"</Text>
                        <Text style={[styles.version, { color: colors.textTertiary }]}>v1.0.4 • Void Build</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 2,
        fontFamily: 'SpaceMono-Regular',
    },
    settingsButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    scrollContent: {
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
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 4,
    },
    email: {
        fontSize: 14,
        fontFamily: 'SpaceMono-Regular',
        marginBottom: 16,
    },
    usernameEditContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    usernameInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    usernameInputText: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'SpaceMono-Regular',
    },
    usernameButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
    },
    cancelBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
    },
    saveBtn: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontFamily: 'SpaceMono-Regular',
    },
    groupCard: {
        padding: 16,
        marginBottom: 16,
    },
    groupTitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 16,
        fontFamily: 'SpaceMono-Regular',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    footer: {
        alignItems: 'center',
        marginTop: 32,
        paddingBottom: 20,
    },
    quote: {
        fontSize: 12,
        fontStyle: 'italic',
        fontFamily: 'SpaceMono-Regular',
    },
    version: {
        fontSize: 10,
        marginTop: 8,
        fontFamily: 'SpaceMono-Regular',
    },
    premiumAvatarBorder: {
        position: 'absolute',
        width: 108,
        height: 108,
        borderRadius: 54,
        top: -4,
        left: -4,
    },
    proBadge: {
        position: 'absolute',
        bottom: -2,
        left: '50%',
        marginLeft: -18,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    proBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'SpaceGrotesk-Bold',
    },
});

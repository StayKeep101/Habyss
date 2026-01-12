import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, TextInput, Alert, ActivityIndicator, Image, Linking, Platform, DeviceEventEmitter } from 'react-native';
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
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { LinearGradient } from 'expo-linear-gradient';
import { EditProfileModal } from '@/components/Profile/EditProfileModal';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { clearHabitsCache } from '@/lib/habitsSQLite';


// Settings configuration
interface SettingOption {
    id: string;
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    comingSoon?: boolean;
}

// Conditionally require ImagePicker
let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { colors: accentColors, primary: accentColor } = useAccentGradient();

    // User state
    const { lightFeedback, selectionFeedback, mediumFeedback } = useHaptics();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);

    // Settings state - use global context
    const {
        hapticsEnabled, setHapticsEnabled,
        soundsEnabled, setSoundsEnabled,
        notificationsEnabled, setNotificationsEnabled,
        aiPersonality,
        cardSize, setCardSize
    } = useAppSettings();

    // Profile picture state
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const { isPremium } = usePremiumStatus();

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
        if (!ImagePicker) {
            Alert.alert(
                "Feature Unavailable",
                "Photo picker requires a development build. Run 'npx expo run:ios' or 'npx expo run:android' to enable this feature."
            );
            return;
        }

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

                            // Add delay to prevent crash
                            await new Promise(resolve => setTimeout(resolve, 100));

                            const result = await ImagePicker.launchCameraAsync({
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                            });

                            if (!result.canceled && result.assets && result.assets[0]) {
                                const uri = result.assets[0].uri;
                                setAvatarUri(uri);
                                await AsyncStorage.setItem('profile_avatar', uri);
                                DeviceEventEmitter.emit('profile_avatar_changed', uri);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } catch (error: any) {
                            console.error('Camera error:', error);
                            Alert.alert('Camera Error', error?.message || 'Could not access camera. If using Expo Go, please create a development build.');
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

                            // Add delay to prevent crash
                            await new Promise(resolve => setTimeout(resolve, 100));

                            const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'images',
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                            });

                            if (!result.canceled && result.assets && result.assets[0]) {
                                const uri = result.assets[0].uri;
                                setAvatarUri(uri);
                                await AsyncStorage.setItem('profile_avatar', uri);
                                DeviceEventEmitter.emit('profile_avatar_changed', uri);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        } catch (error: any) {
                            console.error('Library error:', error);
                            Alert.alert('Photo Library Error', error?.message || 'Could not access photo library. If using Expo Go, please create a development build.');
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const toggleGlobalSetting = (setter: (val: boolean) => void, currentValue: boolean) => {
        if (hapticsEnabled) selectionFeedback();
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

    // DEV ONLY: Premium Toggle Component
    const DevPremiumToggle = ({ colors }: { colors: any }) => {
        const [devPremium, setDevPremium] = useState(false);

        useEffect(() => {
            AsyncStorage.getItem('HABYSS_DEV_PREMIUM_OVERRIDE').then(val => setDevPremium(val === 'true'));
        }, []);

        const toggleDevPremium = async () => {
            const newValue = !devPremium;
            setDevPremium(newValue);
            await AsyncStorage.setItem('HABYSS_DEV_PREMIUM_OVERRIDE', newValue ? 'true' : 'false');
            DeviceEventEmitter.emit('dev_premium_update');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        };

        return (
            <View style={styles.settingItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={[styles.iconBox, { borderColor: '#F59E0B' }]}>
                        <Ionicons name="diamond" size={20} color="#F59E0B" />
                    </View>
                    <View>
                        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Force Premium</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Simulate Pro status for testing</Text>
                    </View>
                </View>
                <Switch
                    trackColor={{ false: '#3e3e3e', true: '#F59E0B' }}
                    thumbColor={colors.textPrimary}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={toggleDevPremium}
                    value={devPremium}
                />
            </View>
        );
    };

    const handleLogout = async () => {
        // Clear all cached user data before logging out
        clearHabitsCache();

        await supabase.auth.signOut();
        router.replace('/(auth)/welcome');
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header - No Settings Button */}
                <View style={styles.header}>
                    <View style={{ width: 40 }} />
                    <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: 24, fontFamily: 'Lexend_700Bold' }]}>PROFILE</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Profile Section */}
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={() => setShowEditProfile(true)} style={styles.avatarContainer}>
                            {/* Premium gradient border */}
                            {isPremium && (
                                <LinearGradient
                                    colors={accentColors}
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
                            {/* Badge: PRO for premium users, star for non-premium */}
                            {isPremium ? (
                                <LinearGradient
                                    colors={accentColors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.verifiedBadge}
                                >
                                    <Text style={{ color: 'white', fontSize: 8, fontWeight: '900', fontFamily: 'Lexend' }}>PRO</Text>
                                </LinearGradient>
                            ) : null}
                        </TouchableOpacity>

                        {/* Upgrade Button (only for non-premium) */}
                        {!isPremium && (
                            <TouchableOpacity
                                onPress={() => {
                                    selectionFeedback();
                                    router.push('/(root)/paywall');
                                }}
                                style={styles.upgradeBtnContainer}
                            >
                                <LinearGradient
                                    colors={accentColors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.upgradeBtn}
                                >
                                    <Ionicons name="sparkles" size={16} color="white" />
                                    <Text style={styles.upgradeText}>Upgrade to Pro</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {/* Username Display (non-editable here, edit in modal) */}
                        <Text style={[styles.name, { color: colors.textPrimary }]}>{username}</Text>
                    </View>

                    {/* Inline Settings Sections */}
                    {/* APP PREFERENCES */}
                    <View style={styles.settingsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>APP PREFERENCES</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.sectionCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/ai-settings'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="sparkles-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>AI Configuration</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Personality & greeting settings</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/notifications'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="notifications-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Notifications</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Manage alerts and reminders</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/appearance'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="color-palette-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Appearance</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Theme, colors, and display</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />

                            {/* Sounds & Haptics */}
                            <View style={[styles.settingItem, { paddingVertical: 12 }]}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="volume-high-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Sounds & Haptics</Text>

                                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                                        <TouchableOpacity
                                            onPress={() => { setSoundsEnabled(!soundsEnabled); selectionFeedback(); }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                                        >
                                            <Ionicons name={soundsEnabled ? "volume-medium" : "volume-mute"} size={14} color={soundsEnabled ? accentColor : colors.textTertiary} />
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: soundsEnabled ? accentColor : colors.textTertiary }}>Sounds</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => { setHapticsEnabled(!hapticsEnabled); selectionFeedback(); }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                                        >
                                            <Ionicons name={hapticsEnabled ? "phone-portrait" : "tablet-landscape"} size={14} color={hapticsEnabled ? accentColor : colors.textTertiary} />
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: hapticsEnabled ? accentColor : colors.textTertiary }}>Haptics</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => Alert.alert('Coming Soon', 'Custom sound packs (Void, Modern, Classic) coming in next update.')}
                                        style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>Sound Pack: Void (Default)</Text>
                                        <Text style={{ fontSize: 11, color: accentColor, fontWeight: '600' }}>Change</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </VoidCard>
                    </View>

                    {/* DATA & SYNC */}
                    <View style={styles.settingsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>DATA & SYNC</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.sectionCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/data-storage'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="cloud-upload-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Backup & Restore</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Cloud sync and data export</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/integrations'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="link-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Integrations</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Calendar, Health (Coming Soon)</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </VoidCard>
                    </View>

                    {/* ACCOUNT */}
                    <View style={styles.settingsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>ACCOUNT</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.sectionCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/paywall'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="star-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Subscription</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Manage your plan</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/privacy'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Privacy & Security</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Data and security options</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </VoidCard>
                    </View>

                    {/* SUPPORT */}
                    <View style={styles.settingsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>SUPPORT</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.sectionCard, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/help'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="help-buoy-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Help Center</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>FAQs and guides</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/contact'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="mail-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Contact Support</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Get help from our team</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                            <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.settingItem} onPress={() => { selectionFeedback(); router.push('/(root)/about'); }}>
                                <LinearGradient colors={accentColors} style={styles.settingIcon}>
                                    <Ionicons name="information-circle-outline" size={20} color="white" />
                                </LinearGradient>
                                <View style={styles.settingContent}>
                                    <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>About Habyss</Text>
                                    <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>Version and legal info</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </VoidCard>
                    </View>

                    {/* Sign Out */}
                    <View style={styles.settingsSection}>
                        <TouchableOpacity
                            style={[styles.signOutButton, { backgroundColor: colors.error + '20' }]}
                            onPress={handleLogout}
                        >
                            <Ionicons name="log-out-outline" size={20} color={colors.error} />
                            <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.quote, { color: colors.textSecondary }]}>"Descend into discipline"</Text>
                        <Text style={[styles.version, { color: colors.textTertiary }]}>v1.0.4 • Void Build</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
            <EditProfileModal
                visible={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                currentUsername={username}
                currentAvatarUri={avatarUri}
                onProfileUpdate={(newAvatarUri) => {
                    // Reload username and avatar
                    supabase.auth.getUser().then(({ data: { user } }) => {
                        if (user) {
                            supabase.from('profiles').select('username').eq('id', user.id).single()
                                .then(({ data }) => {
                                    if (data?.username) setUsername(data.username);
                                });
                        }
                    });
                    if (newAvatarUri) setAvatarUri(newAvatarUri);
                }}
            />
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
        fontSize: 24,
        fontFamily: 'Lexend_700Bold', // Matches CalendarStrip day font
        letterSpacing: 0,
    },
    settingsButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        marginBottom: 32,
        marginTop: 20,
    },
    avatarContainer: {
        marginBottom: 12,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#050505',
    },
    name: {
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 2,
    },
    email: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 12,
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
        paddingVertical: 10,
        gap: 8,
    },
    usernameInputText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
    },
    usernameButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    saveBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 16,
        minWidth: 80,
        alignItems: 'center',
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    groupCard: {
        padding: 12,
        marginBottom: 12,
    },
    groupTitle: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 12,
        fontFamily: 'Lexend_400Regular',
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: '500',
        fontFamily: 'Lexend_400Regular',
    },
    divider: {
        height: 1,
        marginVertical: 6,
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
        paddingBottom: 20,
    },
    quote: {
        fontSize: 11,
        fontStyle: 'italic',
        fontFamily: 'Lexend_400Regular',
    },
    version: {
        fontSize: 9,
        marginTop: 6,
        fontFamily: 'Lexend_400Regular',
    },
    premiumAvatarBorder: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
        top: -4,
        left: -4,
    },
    proBadge: {
        position: 'absolute',
        bottom: -2,
        left: '50%',
        marginLeft: -16,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    proBadgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Lexend',
    },
    upgradeBtnContainer: {
        marginTop: 12,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    upgradeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 8,
    },
    upgradeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Lexend',
    },
    // Inline settings styles
    settingsSection: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    sectionCard: {
        padding: 4,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    settingSubtitle: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    settingDivider: {
        height: 1,
        marginHorizontal: 14,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 8,
    },
    signOutText: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});

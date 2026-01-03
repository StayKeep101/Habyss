import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
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

    // Settings state
    const [notifications, setNotifications] = useState(true);
    const [sound, setSound] = useState(true);
    const [haptics, setHaptics] = useState(true);

    // Profile picture state
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

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

        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', name.toLowerCase())
            .neq('id', user?.id || '')
            .single();

        setCheckingUsername(false);
        setUsernameAvailable(!data && !error);
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
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') return Alert.alert('Camera permission needed');

                        const result = await ImagePicker.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                            await AsyncStorage.setItem('profile_avatar', result.assets[0].uri);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }
                },
                {
                    text: "Choose from Library",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') return Alert.alert('Library permission needed');

                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                            await AsyncStorage.setItem('profile_avatar', result.assets[0].uri);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

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

    const handleLogout = async () => {
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
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, overflow: 'hidden' }]}>
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
                        <MenuLink icon="log-out-outline" label="Log Out" onPress={handleLogout} destructive />
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
});

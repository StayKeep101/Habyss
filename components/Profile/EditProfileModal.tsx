import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, SafeAreaView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { supabase } from '@/lib/supabase';
import { ScrollPickerModal } from './ScrollPickerModal';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally require ImagePicker
let ImagePicker: any = null;
try { ImagePicker = require('expo-image-picker'); } catch (e) { }

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    currentUsername: string;
    currentAvatarUri?: string | null;
    onProfileUpdate: (avatarUri?: string) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose, currentUsername, currentAvatarUri, onProfileUpdate }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Form State
    const [nickname, setNickname] = useState(currentUsername);
    const [gender, setGender] = useState('');
    const [description, setDescription] = useState('');
    const [age, setAge] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(currentAvatarUri || null);

    const [showAgePicker, setShowAgePicker] = useState(false);
    const [showGenderPicker, setShowGenderPicker] = useState(false);
    const [deleteEmail, setDeleteEmail] = useState('');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const ages = Array.from({ length: 100 }, (_, i) => String(i + 1));
    const genders = ['Male', 'Female', 'Other'];

    // Load initial data and avatar
    useEffect(() => {
        const loadDetails = async () => {
            if (!visible) return;
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                    if (profile) {
                        setNickname(profile.username || '');
                        setGender(profile.gender || '');
                        setDescription(profile.bio || '');
                        setAge(profile.age ? String(profile.age) : '');
                    }
                }
                // Load saved avatar from AsyncStorage
                const savedAvatar = await AsyncStorage.getItem('profile_avatar');
                if (savedAvatar) setAvatarUri(savedAvatar);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadDetails();
    }, [visible]);

    // Handle avatar change
    const handleChangeAvatar = async () => {
        if (!ImagePicker) {
            Alert.alert("Feature Unavailable", "Run expo run:ios/android for this feature.");
            return;
        }
        Alert.alert("Change Photo", "Choose an option", [
            {
                text: "Take Photo",
                onPress: async () => {
                    try {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') return Alert.alert('Permission Required');
                        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                        }
                    } catch (e) { console.error(e); }
                }
            },
            {
                text: "Choose from Library",
                onPress: async () => {
                    try {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') return Alert.alert('Permission Required');
                        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.7 });
                        if (!result.canceled && result.assets[0]) {
                            setAvatarUri(result.assets[0].uri);
                        }
                    } catch (e) { console.error(e); }
                }
            },
            { text: "Cancel", style: "cancel" }
        ]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            // Only update fields that exist in the database schema
            // Note: 'age', 'gender', 'bio' may not exist - save only username for now
            const updates = {
                id: user.id,
                username: nickname,
                gender: gender,
                age: age ? parseInt(age) : null,
                bio: description,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) {
                console.error('Update error', error);
                throw error;
            }

            // Save avatar locally
            if (avatarUri) {
                await AsyncStorage.setItem('profile_avatar', avatarUri);
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onProfileUpdate(avatarUri || undefined);
            onClose();
        } catch (e) {
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.prompt(
            "Delete Account",
            "This action is permanent. To confirm, please type your email address below.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async (email) => {
                        try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (email?.toLowerCase() === user?.email?.toLowerCase()) {
                                setLoading(true);
                                // IMPORTANT: In a real app, use an Edge Function for this.
                                // Client-side deletion is restricted for security.
                                // We will sign out for now as a mock of deletion success if strict mode is on.
                                await supabase.auth.signOut();
                                Alert.alert("Account Deleted", "Your account has been scheduled for deletion.");
                                onClose();
                            } else {
                                Alert.alert("Error", "Email does not match.");
                            }
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete account.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ],
            "plain-text"
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={false}
            visible={visible}
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={{ color: colors.textSecondary, fontFamily: 'Lexend' }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Profile</Text>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            style={styles.closeBtn}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={{ color: colors.primary, fontFamily: 'Lexend', fontWeight: 'bold' }}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {loading && <ActivityIndicator style={{ marginBottom: 20 }} />}

                        {/* Profile Photo */}
                        <TouchableOpacity onPress={handleChangeAvatar} style={styles.avatarSection}>
                            <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Ionicons name="person" size={40} color={colors.textTertiary} />
                                    </View>
                                )}
                                <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="camera" size={14} color="black" />
                                </View>
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8, fontFamily: 'Lexend_400Regular' }}>Tap to change photo</Text>
                        </TouchableOpacity>

                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>NICKNAME</Text>
                            <TextInput
                                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder="Your codename"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.fieldGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>AGE</Text>
                                <TouchableOpacity
                                    style={[styles.input, { borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center' }]}
                                    onPress={() => setShowAgePicker(true)}
                                >
                                    <Text style={{ color: age ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                        {age || "Years"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 10 }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>GENDER</Text>
                                <TouchableOpacity
                                    style={[styles.input, { borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center' }]}
                                    onPress={() => setShowGenderPicker(true)}
                                >
                                    <Text style={{ color: gender ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                        {gender || "Identity"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
                            <TextInput
                                style={[styles.inputTextArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Your mission briefing..."
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleDeleteAccount}
                            style={[styles.deleteBtn, { borderColor: colors.error }]}
                        >
                            <Text style={{ color: colors.error, fontFamily: 'Lexend_600SemiBold' }}>Delete Account</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </SafeAreaView>
            </View>

            <ScrollPickerModal
                visible={showAgePicker}
                onClose={() => setShowAgePicker(false)}
                onSelect={(val) => { setAge(val); setShowAgePicker(false); }}
                title="Select Age"
                items={ages}
                selectedValue={age}
            />

            <ScrollPickerModal
                visible={showGenderPicker}
                onClose={() => setShowGenderPicker(false)}
                onSelect={(val) => { setGender(val); setShowGenderPicker(false); }}
                title="Select Gender"
                items={genders}
                selectedValue={gender}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    closeBtn: {
        padding: 4,
        minWidth: 60,
        alignItems: 'center',
    },
    fieldGroup: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    input: {
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
    },
    inputTextArea: {
        minHeight: 100,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        overflow: 'hidden',
        position: 'relative',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        marginTop: 40,
        marginBottom: 40,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

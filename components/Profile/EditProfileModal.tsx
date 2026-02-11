import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { supabase } from '@/lib/supabase';
import { ScrollPickerModal } from './ScrollPickerModal';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoidModal } from '@/components/Layout/VoidModal';
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

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
    const isLight = theme === 'light';

    // Form State
    const [nickname, setNickname] = useState(currentUsername);
    const [gender, setGender] = useState('');
    const [description, setDescription] = useState('');
    const [age, setAge] = useState('');
    const [avatarUri, setAvatarUri] = useState<string | null>(currentAvatarUri || null);

    const [showAgePicker, setShowAgePicker] = useState(false);
    const [showGenderPicker, setShowGenderPicker] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const ages = Array.from({ length: 100 }, (_, i) => String(i + 1));
    const genders = ['Male', 'Female', 'Other'];

    // Animation Values
    const scrollY = useSharedValue(0);
    const HEADER_HEIGHT = 200;

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollY.value,
                        [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
                        [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
                    ),
                },
                {
                    scale: interpolate(
                        scrollY.value,
                        [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
                        [2, 1, 1],
                        Extrapolation.CLAMP
                    ),
                },
            ],
        };
    });

    // Load initial data
    useEffect(() => {
        const loadDetails = async () => {
            if (!visible) return;
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', user.id)
                        .single();
                    if (profile) {
                        setNickname(profile.username || '');
                    }
                }
                const savedAvatar = await AsyncStorage.getItem('profile_avatar');
                const savedBio = await AsyncStorage.getItem('profile_bio');
                const savedAge = await AsyncStorage.getItem('profile_age');
                const savedGender = await AsyncStorage.getItem('profile_gender');
                if (savedAvatar) setAvatarUri(savedAvatar);
                if (savedBio) setDescription(savedBio);
                if (savedAge) setAge(savedAge);
                if (savedGender) setGender(savedGender);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadDetails();
    }, [visible]);

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

            const updates: any = {
                id: user.id,
                username: nickname,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);
            if (error) {
                console.error('Update error', error);
                throw error;
            }

            if (avatarUri) {
                await AsyncStorage.setItem('profile_avatar', avatarUri);
                DeviceEventEmitter.emit('profile_avatar_changed', avatarUri);
            }
            if (description) await AsyncStorage.setItem('profile_bio', description);
            if (age) await AsyncStorage.setItem('profile_age', age);
            if (gender) await AsyncStorage.setItem('profile_gender', gender);

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
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.85}>
            <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                {/* Parallax Header Image */}
                <Animated.View style={[styles.headerImageContainer, headerAnimatedStyle]}>
                    <Image
                        source={avatarUri ? { uri: avatarUri } : require('@/assets/images/icon.png')} // Fallback to icon or a specific cover if available
                        style={[styles.headerImage, { opacity: 0.6 }]}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', colors.background]}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>

                {/* Header Actions - Absolute positioned on top */}
                <View style={[styles.headerOverlay, { paddingTop: 20 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtnBlur}>
                        <BlurView intensity={30} tint="dark" style={styles.blurBtn}>
                            <Ionicons name="close" size={20} color="#fff" />
                        </BlurView>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtnBlur}>
                        {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <BlurView intensity={30} tint="dark" style={styles.blurBtn}>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </BlurView>
                        )}
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <Animated.ScrollView
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        contentContainerStyle={{ paddingBottom: 40, paddingTop: HEADER_HEIGHT - 60 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
                            {loading && <ActivityIndicator style={{ marginBottom: 20 }} />}

                            {/* Profile Photo - Overlapping Header */}
                            <TouchableOpacity onPress={handleChangeAvatar} style={styles.avatarSection}>
                                <View style={[styles.avatarContainer, { borderColor: colors.background }]}>
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
                                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                    value={nickname}
                                    onChangeText={setNickname}
                                    placeholder="Your codename"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.fieldGroup, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>AGE</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', justifyContent: 'center' }]}
                                        onPress={() => setShowAgePicker(true)}
                                    >
                                        <Text style={{ color: age ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                            {age || "Years"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 10, marginBottom: 0 }]}>
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>GENDER</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', justifyContent: 'center' }]}
                                        onPress={() => setShowGenderPicker(true)}
                                    >
                                        <Text style={{ color: gender ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                            {gender || "Identity"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={[styles.fieldGroup, { marginTop: 16 }]}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
                                <TextInput
                                    style={[styles.inputTextArea, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
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
                        </View>
                    </Animated.ScrollView>
                </KeyboardAvoidingView>
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
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    headerImageContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        zIndex: 0,
    },
    headerImage: {
        width: '100%',
        height: '100%',
    },
    headerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 100, // Make sure buttons are clickable
    },
    headerBtnBlur: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    blurBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    contentContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        minHeight: 500,
    },
    headerBtn: {
        padding: 4,
        minWidth: 60,
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    fieldGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
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
        marginBottom: 20,
    },
    avatarContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
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
        bottom: 2,
        right: 2,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteBtn: {
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, DeviceEventEmitter, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ScrollPickerModal } from './ScrollPickerModal';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoidModal } from '@/components/Layout/VoidModal';
import { deleteAllLocalData, restartAfterDeletion } from '@/lib/accountDeletion';
import { router } from 'expo-router';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SettingsModal } from '@/components/SettingsModal';

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

    const [birthday, setBirthday] = useState<Date | null>(null);
    const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
    const [showGenderPicker, setShowGenderPicker] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const genders = ['Male', 'Female', 'Other', 'Prefer not to say'];

    // Age is derived from the birthday; the stored age is kept for profiles
    // saved before birthdays existed.
    const ageFromBirthday = (date: Date): string => {
        const today = new Date();
        let years = today.getFullYear() - date.getFullYear();
        const monthDelta = today.getMonth() - date.getMonth();
        if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) years -= 1;
        return years >= 0 ? String(years) : '';
    };

    const formatBirthday = (date: Date): string =>
        date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

    // Local YYYY-MM-DD; toISOString() would shift the date in negative-offset timezones.
    const toDateKey = (date: Date): string =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const displayedAge = birthday ? ageFromBirthday(birthday) : age;

    // Load initial data
    useEffect(() => {
        const loadDetails = async () => {
            if (!visible) return;
            setLoading(true);
            try {
                // Load from local storage
                const savedNickname = await AsyncStorage.getItem('profile_nickname');
                if (savedNickname) setNickname(savedNickname);
                const savedAvatar = await AsyncStorage.getItem('profile_avatar');
                const savedBio = await AsyncStorage.getItem('profile_bio');
                const savedAge = await AsyncStorage.getItem('profile_age');
                const savedGender = await AsyncStorage.getItem('profile_gender');
                const savedBirthday = await AsyncStorage.getItem('profile_birthday');
                if (savedBirthday) {
                    const [y, m, d] = savedBirthday.split('-').map(Number);
                    if (y && m && d) setBirthday(new Date(y, m - 1, d));
                }
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
            // Save profile locally
            await AsyncStorage.setItem('profile_nickname', nickname);

            if (avatarUri) {
                await AsyncStorage.setItem('profile_avatar', avatarUri);
                DeviceEventEmitter.emit('profile_avatar_changed', avatarUri);
            }
            if (description) await AsyncStorage.setItem('profile_bio', description);
            if (birthday) {
                await AsyncStorage.setItem('profile_birthday', toDateKey(birthday));
                await AsyncStorage.setItem('profile_age', ageFromBirthday(birthday));
            } else if (age) {
                await AsyncStorage.setItem('profile_age', age);
            }
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
        Alert.alert(
            "Delete account",
            "This permanently removes your habits, streaks, history, settings and the downloaded AI model from this device. It cannot be undone, and we hold no copy to restore.\n\nAny subscription stays with your Apple ID; cancel it in Settings if you no longer want it.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        const report = await deleteAllLocalData();
                        setLoading(false);
                        onClose();

                        if (report.ok) {
                            Alert.alert('Account deleted', 'Everything stored on this device has been removed.', [
                                { text: 'OK', onPress: async () => { if (!(await restartAfterDeletion())) router.replace('/(auth)/welcome'); } },
                            ]);
                        } else {
                            Alert.alert(
                                'Partly deleted',
                                `Your data was removed, except: ${report.failed.map(step => step.label).join(', ')}. ` +
                                'Deleting the app from your device removes anything left.',
                                [{ text: 'OK', onPress: async () => { if (!(await restartAfterDeletion())) router.replace('/(auth)/welcome'); } }],
                            );
                        }
                    }
                }
            ]
        );
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                <ModalHeader
                    title="Edit Profile"
                    onBack={onClose}
                    backIcon="close"
                    rightSlot={
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            accessibilityLabel="Save profile"
                            style={[styles.headerCircleBtn, { backgroundColor: colors.primary }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <Ionicons name="checkmark" size={20} color="#000" />
                            )}
                        </TouchableOpacity>
                    }
                />

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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

                            <View style={styles.fieldGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>BIRTHDAY</Text>
                                <TouchableOpacity
                                    style={[styles.input, styles.inputRow, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                    onPress={() => setShowBirthdayPicker(true)}
                                >
                                    <Text style={{ color: birthday ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                        {birthday ? formatBirthday(birthday) : 'Add your birthday'}
                                    </Text>
                                    {displayedAge ? (
                                        <View style={[styles.agePill, { backgroundColor: colors.primary + '1A' }]}>
                                            <Text style={{ color: colors.primary, fontFamily: 'Lexend_600SemiBold', fontSize: 12 }}>
                                                {displayedAge} yrs
                                            </Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.fieldGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>GENDER</Text>
                                <TouchableOpacity
                                    style={[styles.input, styles.inputRow, { borderColor: colors.border, backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}
                                    onPress={() => setShowGenderPicker(true)}
                                >
                                    <Text style={{ color: gender ? colors.textPrimary : colors.textTertiary, fontFamily: 'Lexend_400Regular', fontSize: 16 }}>
                                        {gender || 'Identity'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
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
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>

            <SettingsModal
                visible={showBirthdayPicker}
                onClose={() => setShowBirthdayPicker(false)}
                title="Your birthday"
            >
                <View style={{ alignItems: 'center' }}>
                    <DateTimePicker
                        value={birthday || new Date(2000, 0, 1)}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        maximumDate={new Date()}
                        minimumDate={new Date(1900, 0, 1)}
                        themeVariant={isLight ? 'light' : 'dark'}
                        onChange={(_event, selected) => {
                            if (Platform.OS !== 'ios') setShowBirthdayPicker(false);
                            if (selected) setBirthday(selected);
                        }}
                    />
                    {Platform.OS === 'ios' ? (
                        <TouchableOpacity
                            onPress={() => setShowBirthdayPicker(false)}
                            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                        >
                            <Text style={{ color: '#000', fontFamily: 'Lexend_600SemiBold', fontSize: 15 }}>Done</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </SettingsModal>

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
    headerCircleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    agePill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    doneBtn: {
        marginTop: 12,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 999,
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

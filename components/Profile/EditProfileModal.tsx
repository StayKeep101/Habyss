import { FontFamily, Typography } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView} from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { ScrollPickerModal } from './ScrollPickerModal';
import { useHaptics } from '@/hooks/useHaptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { IconButton } from '@/components/ui/IconButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { DateWheels } from '@/components/ui/DateWheels';
import { SettingsModal } from '@/components/Common/SettingsModal';
import { getProfile, saveProfile } from '@/lib/profile';
import { getMyUsername, setMyUsername } from '@/lib/friendsService';

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
    // Through the hook rather than expo-haptics directly. A bare
    // notificationAsync call drops a promise that rejects where there is no
    // haptic engine, which React Native raises as a red screen, and it buzzes
    // even for somebody who has turned haptics off in Settings.
    const { successFeedback } = useHaptics();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentSolid } = useAccentGradient();

    // Form State
    const [nickname, setNickname] = useState(currentUsername);
    // The @handle friends find you by. Changeable, with the same rules as when
    // it was first chosen; only sent when it actually changed.
    const [handle, setHandle] = useState('');
    const [savedHandle, setSavedHandle] = useState<string | null>(null);
    const [handleError, setHandleError] = useState<string | undefined>();
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
                // From the one profile store, not the storage keys directly.
                const me = await getProfile();
                if (me.name) setNickname(me.name);
                setHandleError(undefined);
                void getMyUsername().then(current => { setSavedHandle(current); setHandle(current ?? ''); }).catch(() => undefined);
                const savedAge = await AsyncStorage.getItem('profile_age');
                if (me.birthday) {
                    const [y, m, d] = me.birthday.split('-').map(Number);
                    if (y && m && d) setBirthday(new Date(y, m - 1, d));
                }
                if (me.avatar) setAvatarUri(me.avatar);
                if (me.bio) setDescription(me.bio);
                if (me.gender) setGender(me.gender);
                if (savedAge) setAge(savedAge);
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
            const wanted = handle.trim().replace(/^@/, '').toLowerCase();
            if (savedHandle !== null && wanted && wanted !== savedHandle) {
                const result = await setMyUsername(wanted);
                if (!result.ok) { setHandleError(result.error); setSaving(false); return; }
                setSavedHandle(wanted);
            }
            // Through `saveProfile`, not by setting the keys here.
            //
            // This screen wrote the six AsyncStorage keys by hand, and
            // `saveProfile` is the only thing that sends a profile to the
            // server — so editing your name and picture here changed them on
            // this phone and told nobody. That is why friends saw a handle and
            // a grey circle: the columns were never written, not withheld.
            //
            // It also derives the stored age from the birthday and announces
            // the avatar change, both of which were repeated here by hand.
            await saveProfile({
                name: nickname,
                // An empty field means "clear it", so these are passed even
                // when blank — leaving them out would mean "unchanged" and a
                // bio could never be deleted.
                bio: description,
                avatar: avatarUri || null,
                birthday: birthday ? toDateKey(birthday) : null,
                gender: gender || '',
            });
            if (!birthday && age) await AsyncStorage.setItem('profile_age', age);

            successFeedback();
            onProfileUpdate(avatarUri || undefined);
            onClose();
        } catch (e) {
            Alert.alert('Error', 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={styles.flex}>
                <ModalHeader
                    title="Your profile"
                    onBack={onClose}
                    backIcon="close"
                    rightSlot={
                        <IconButton
                            icon="checkmark"
                            label="Save profile"
                            loading={saving}
                            onPress={handleSave}
                        />
                    }
                />

                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        alwaysBounceVertical={false}
                    >
                        {loading ? <ActivityIndicator color={accentSolid} /> : null}

                        {/* The badge sits outside the clipped circle, so it is a
                            whole button rather than the half-moon it was. */}
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Change your photo"
                            activeOpacity={0.85}
                            onPress={handleChangeAvatar}
                            style={styles.avatarSection}
                        >
                            <View style={styles.avatarFrame}>
                                <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
                                    {avatarUri ? (
                                        <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                                    ) : (
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceTertiary }]}>
                                            <Ionicons name="person" size={38} color={colors.textTertiary} />
                                        </View>
                                    )}
                                </View>
                                <View style={[styles.cameraIcon, { backgroundColor: accentSolid, borderColor: colors.background }]}>
                                    <Ionicons name="camera" size={13} color="#000" />
                                </View>
                            </View>
                            <Text style={[styles.avatarHint, { color: colors.textTertiary }]}>Tap to change</Text>
                        </TouchableOpacity>

                        <AppTextField
                            label="Name"
                            value={nickname}
                            onChangeText={setNickname}
                            autoCapitalize="words"
                            maxLength={40}
                            placeholder="What friends see"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Your name"
                        />

                        {savedHandle !== null ? (
                            <AppTextField
                                label="Username"
                                value={handle}
                                onChangeText={value => { setHandle(value); setHandleError(undefined); }}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={21}
                                leadingIcon="at"
                                placeholder="username"
                                placeholderTextColor={colors.textTertiary}
                                accessibilityLabel="Your username"
                                error={handleError}
                            />
                        ) : null}

                        <View style={styles.group}>
                            <Text style={[Typography.caption, { color: colors.textSecondary }]}>Birthday</Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={birthday ? `Birthday, ${formatBirthday(birthday)}` : 'Add your birthday'}
                                activeOpacity={0.8}
                                onPress={() => setShowBirthdayPicker(true)}
                                style={[styles.pickerRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                            >
                                <Text style={[styles.pickerText, { color: birthday ? colors.textPrimary : colors.textTertiary }]}>
                                    {birthday ? formatBirthday(birthday) : 'Add your birthday'}
                                </Text>
                                {displayedAge ? (
                                    <View style={[styles.agePill, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text style={[styles.ageText, { color: accentSolid }]}>{displayedAge}</Text>
                                    </View>
                                ) : (
                                    <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.group}>
                            <Text style={[Typography.caption, { color: colors.textSecondary }]}>Gender</Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={gender ? `Gender, ${gender}` : 'Choose a gender'}
                                activeOpacity={0.8}
                                onPress={() => setShowGenderPicker(true)}
                                style={[styles.pickerRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                            >
                                <Text style={[styles.pickerText, { color: gender ? colors.textPrimary : colors.textTertiary }]}>
                                    {gender || 'Rather not say'}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        <AppTextField
                            label="About you"
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            maxLength={280}
                            placeholder="A line about what you are working on"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="About you"
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>

            <SettingsModal
                visible={showBirthdayPicker}
                onClose={() => setShowBirthdayPicker(false)}
                title="Your birthday"
            >
                <View style={{ alignItems: 'center' }}>
                    <DateWheels value={birthday || new Date(2000, 0, 1)} onChange={setBirthday} />
                    <AppButton label="Done" onPress={() => setShowBirthdayPicker(false)} />
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
    flex: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
    avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    // Not clipped: the frame holds the badge, the circle inside holds the photo.
    avatarFrame: { width: 92, height: 92 },
    avatarContainer: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%' },
    avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cameraIcon: {
        position: 'absolute', bottom: 0, right: 0,
        width: 30, height: 30, borderRadius: 15, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarHint: { fontSize: 12, fontFamily: FontFamily.regular },
    group: { gap: 8 },
    pickerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 54, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16,
    },
    pickerText: { fontSize: 15, fontFamily: FontFamily.regular },
    agePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    ageText: { fontSize: 12, fontFamily: FontFamily.semibold },
    doneBtn: { marginTop: 12, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 999, alignItems: 'center' },
});


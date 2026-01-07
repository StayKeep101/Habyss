import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const Contact = () => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];
    const { lightFeedback, successFeedback } = useHaptics();

    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (!message.trim()) {
            Alert.alert('Error', 'Please enter a message.');
            return;
        }
        successFeedback();
        Alert.alert('Sent!', 'Thanks for reaching out. We\'ll get back to you soon.');
        setMessage('');
    };

    const openTwitter = () => {
        lightFeedback();
        Linking.openURL('https://twitter.com/habyss');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Contact</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Quick Links */}
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('mailto:support@habyss.app')}>
                            <Ionicons name="mail-outline" size={22} color={colors.primary} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>support@habyss.app</Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.linkRow} onPress={openTwitter}>
                            <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>@habyss</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Message Form */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>SEND A MESSAGE</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="What's on your mind?"
                        placeholderTextColor={colors.textTertiary}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />

                    <TouchableOpacity onPress={handleSend}>
                        <LinearGradient
                            colors={['#3B82F6', '#8B5CF6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.sendBtn}
                        >
                            <Ionicons name="send" size={18} color="#fff" />
                            <Text style={styles.sendText}>Send</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    content: {
        padding: 16,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    linkText: {
        fontSize: 15,
        fontFamily: 'Lexend_400Regular',
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    input: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        fontSize: 15,
        fontFamily: 'Lexend_400Regular',
        minHeight: 120,
        marginBottom: 16,
    },
    sendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 8,
    },
    sendText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Lexend',
    },
});

export default Contact;

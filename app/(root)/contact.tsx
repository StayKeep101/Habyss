import { AppButton } from '@/components/Common/AppButton';
import { AppTextField } from '@/components/Common/AppTextField';
import { SheetSection } from '@/components/Layout/SheetSection';
import { FontFamily, UIStyles, Radius } from '@/constants/DesignSystem';
import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAccentGradient } from '@/constants/AccentContext';

import { SheetScreen } from '@/components/Layout/SheetScreen';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

const Contact = () => {
    // const colorScheme = useColorScheme();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { foreground: accentColor } = useAccentGradient();
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
        <SheetScreen title="Contact support" onBack={() => router.back()}>

                {/* Content */}
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Quick Links */}
                    <VoidCard
                        glass={!isTrueDark}
                        intensity={isLight ? 20 : 80}
                        style={[
                            styles.card,
                            {
                                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                                borderColor: colors.border
                            }
                        ]}
                    >
                        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('mailto:support@habyss.app')}>
                            <Ionicons name="mail-outline" size={22} color={accentColor} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>support@habyss.app</Text>
                        </TouchableOpacity>
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity style={styles.linkRow} onPress={openTwitter}>
                            <Ionicons name="logo-twitter" size={22} color="#1DA1F2" />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>@habyss</Text>
                        </TouchableOpacity>
                    </VoidCard>

                    {/* Message Form */}
                    <SheetSection title="Send a message">
                        <AppTextField label="Message" placeholder="What's on your mind?" value={message}
                            onChangeText={setMessage} multiline numberOfLines={4} />
                        <AppButton label="Send" icon="send-outline" onPress={handleSend} disabled={!message.trim()} style={{ marginTop: 16 }} />
                    </SheetSection>
                </ScrollView>
            </SheetScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: { ...UIStyles.screenContent },
    card: {
        borderRadius: Radius.card,
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
        fontFamily: FontFamily.regular,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
});

export default Contact;

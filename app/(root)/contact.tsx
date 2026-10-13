import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { SheetSection } from '@/components/ui/SheetSection';
import { FontFamily, UIStyles, Radius } from '@/theme/designSystem';
import { useState } from 'react';
import { sendFeedback } from '@/lib/feedback';
import { ScrollView, View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { useAccentGradient } from '@/context/AccentContext';

import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { useTheme } from '@/context/ThemeContext';
import { styles } from '@/styles/screens/contact.styles';

const Contact = () => {
    // const colorScheme = useColorScheme();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { foreground: accentColor } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [message, setMessage] = useState('');

    const [sending, setSending] = useState(false);

    /**
     * This used to show "Sent!" and clear the field. Nothing left the phone,
     * which is worse than having no contact form at all — the person who took
     * the trouble to write it believed it had arrived.
     */
    const handleSend = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        await sendFeedback(message, { screen: 'contact' });
        setSending(false);
        successFeedback();
        setMessage('');
        Alert.alert('Sent', 'Thank you. It goes straight to the person who builds this.');
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
                        <AppButton label={sending ? 'Sending…' : 'Send'} icon="send-outline" onPress={() => void handleSend()} disabled={!message.trim() || sending} style={{ marginTop: 16 }} />
                    </SheetSection>
                </ScrollView>
            </SheetScreen>
    );
};


export default Contact;

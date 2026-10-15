import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/help.styles';

const QUESTIONS = [
    { q: 'How do I add a habit?', a: 'Tap + at the bottom of the screen.' },
    { q: 'How does my streak work?', a: 'Do one habit or task a day and it keeps going.' },
    { q: 'Does it work offline?', a: 'Yes. Everything saves on your phone first.' },
    { q: 'What are Marks?', a: 'Points for keeping your habits and tasks. They go down when you miss.' },
];

/**
 * Everything about getting help, in one place: talk to us, the questions
 * people ask, and the small print. It used to be four pages — Help centre,
 * Contact support, Send feedback and About — that said the same thing.
 */
export default function Help() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [open, setOpen] = useState<number | null>(null);
    const version = Constants.expoConfig?.version || '1.0.0';

    return (
        <SheetScreen title="Help" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup>
                    <SettingsRow icon="chatbubble" color="#5B8CFF" label="Send feedback"
                        onPress={() => emit('show_feedback', { screen: 'help' })} />
                    <SettingsRow icon="mail" color="#3DDC97" label="Email support"
                        onPress={() => void Linking.openURL('mailto:support@habyss.app')} />
                    <SettingsRow icon="logo-twitter" color="#1D9BF0" label="Habyss on X"
                        onPress={() => void Linking.openURL('https://twitter.com/habyss')} />
                </SettingsGroup>

                <SettingsGroup title="Questions">
                    {QUESTIONS.map((item, index) => (
                        <Pressable key={item.q} accessibilityRole="button" accessibilityState={{ expanded: open === index }}
                            onPress={() => setOpen(open === index ? null : index)} style={styles.question}>
                            <Text style={[styles.q, { color: colors.textPrimary }]}>{item.q}</Text>
                            {open === index ? (
                                <Animated.Text entering={FadeIn.duration(180)} style={[styles.a, { color: colors.textSecondary }]}>{item.a}</Animated.Text>
                            ) : null}
                        </Pressable>
                    ))}
                </SettingsGroup>

                <SettingsGroup>
                    <SettingsRow icon="shield-checkmark" color="#8A8A94" label="Privacy policy"
                        onPress={() => void Linking.openURL('https://habyss.app/privacy')} />
                    <SettingsRow icon="document-text" color="#8A8A94" label="Terms"
                        onPress={() => void Linking.openURL('https://habyss.app/terms')} />
                </SettingsGroup>

                <View style={styles.footer}>
                    <Text style={[styles.version, { color: colors.textTertiary }]}>Habyss {version}</Text>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

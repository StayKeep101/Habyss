import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { emit } from '@/lib/appEvents';
import { CoffeePopup } from '@/components/Common/CoffeePopup';
import { styles } from '@/styles/screens/help.styles';

/** The one answer that is typed out, slowly, and then owns up. */
const FREE_ANSWER = 'Communisme muhahahahaha… ah ha… ahhhh… kof kof kof';

const QUESTIONS: { q: string; a: string; typed?: boolean }[] = [
    { q: 'Why the hell is this app free? Where’s the catch?', a: FREE_ANSWER, typed: true },
    { q: 'How do I add a habit?', a: 'Tap + at the bottom of the screen.' },
    { q: 'How does my streak work?', a: 'Do one habit or task a day and it keeps going.' },
    { q: 'Does it work offline?', a: 'Yes. Everything saves on your phone first.' },
    { q: 'What are Marks?', a: 'Points for keeping your habits and tasks. They go down when you miss. Sleep counts too: reach your sleep goal and you get +5, fall short and it’s −5.' },
];

/**
 * Text typed out a letter at a time, slower on the pauses, the way somebody
 * laughing at their own joke would say it. Calls back when it has finished.
 */
function SlowTyped({ text, style, onDone }: { text: string; style: object; onDone: () => void }) {
    const [shown, setShown] = useState('');
    useEffect(() => {
        let index = 0;
        let timer: ReturnType<typeof setTimeout>;
        const step = () => {
            index += 1;
            setShown(text.slice(0, index));
            if (index >= text.length) { timer = setTimeout(onDone, 700); return; }
            const char = text[index - 1];
            timer = setTimeout(step, char === '…' ? 520 : char === ' ' ? 120 : 75);
        };
        timer = setTimeout(step, 250);
        return () => clearTimeout(timer);
    }, [text, onDone]);
    return <Text style={style}>{shown}</Text>;
}

/**
 * Everything about getting help, in one place: talk to us, the questions
 * people ask, and the small print. It used to be four pages — Help centre,
 * Contact support, Send feedback and About — that said the same thing.
 */
export default function Help() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [open, setOpen] = useState<number | null>(null);
    const [coffee, setCoffee] = useState(false);
    const showCoffee = useCallback(() => setCoffee(true), []);
    const version = Constants.expoConfig?.version || '1.0.0';

    return (
        <SheetScreen title="Help" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SettingsGroup>
                    <SettingsRow icon="book" color="#FFB020" label="How Habyss works" onPress={() => router.push('/(root)/guide')} />
                </SettingsGroup>

                <SettingsGroup>
                    <SettingsRow icon="chatbubble" color="#5B8CFF" label="Send feedback"
                        onPress={() => emit('show_feedback', { screen: 'help' })} />
                </SettingsGroup>

                <SettingsGroup title="Questions">
                    {QUESTIONS.map((item, index) => (
                        <Pressable key={item.q} accessibilityRole="button" accessibilityState={{ expanded: open === index }}
                            onPress={() => setOpen(open === index ? null : index)} style={styles.question}>
                            <Text style={[styles.q, { color: colors.textPrimary }]}>{item.q}</Text>
                            {open === index ? (
                                item.typed
                                    ? <SlowTyped text={item.a} style={[styles.a, { color: colors.textSecondary }]} onDone={showCoffee} />
                                    : <Animated.Text entering={FadeIn.duration(180)} style={[styles.a, { color: colors.textSecondary }]}>{item.a}</Animated.Text>
                            ) : null}
                        </Pressable>
                    ))}
                </SettingsGroup>

                <SettingsGroup>
                    <SettingsRow icon="shield-checkmark" color="#8A8A94" label="Privacy policy"
                        onPress={() => router.push({ pathname: '/(root)/legal' as never, params: { doc: 'privacy' } })} />
                    <SettingsRow icon="document-text" color="#8A8A94" label="Terms"
                        onPress={() => router.push({ pathname: '/(root)/legal' as never, params: { doc: 'terms' } })} />
                </SettingsGroup>

                <View style={styles.footer}>
                    <Text style={[styles.version, { color: colors.textTertiary }]}>Habyss {version}</Text>
                </View>
            </ScrollView>
            <CoffeePopup visible={coffee} onClose={() => setCoffee(false)} />
        </SheetScreen>
    );
}

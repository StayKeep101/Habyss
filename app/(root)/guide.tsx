import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconTile } from '@/components/ui/IconTile';
import { ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { styles } from '@/styles/screens/guide.styles';

/**
 * How Habyss works, one idea per card: an icon, a name, a line or two. Short
 * enough to read on the way past, so nobody has to wonder what a word on the
 * screen means.
 */
const IDEAS: { icon: string; color: string; title: string; body: string }[] = [
    { icon: 'repeat', color: '#BF5AF2', title: 'Habits', body: 'Things you repeat, like reading or the gym. Tick them off each day.' },
    { icon: 'flash', color: '#FF9F0A', title: 'Tasks', body: 'One-off things to get done, like sending an email.' },
    { icon: 'flag', color: '#FF453A', title: 'Goals', body: 'Something big you are working towards. Put habits and tasks under it and watch it fill up.' },
    { icon: 'checkmark-done', color: '#30D158', title: "Today's 3", body: 'Pick 3 (or 5) tasks for today. Finish them and the day is yours.' },
    { icon: 'diamond', color: '#5B8CFF', title: 'Marks', body: 'Points. Do a habit, a task or a goal and you earn them. Miss one and you lose some. Adding new things earns a few too.' },
    { icon: 'trophy', color: '#FFB020', title: 'Ranks', body: 'Earn enough Marks and you move up a rank. The more you keep going, the higher you climb.' },
    { icon: 'flame', color: '#FF6B35', title: 'Streak', body: 'Days in a row you did at least one thing. One habit or task a day keeps it alive.' },
    { icon: 'pulse', color: '#64D2FF', title: 'Momentum', body: 'How much of what your habits asked for you actually did lately. Higher is better.' },
    { icon: 'refresh', color: '#30D158', title: 'Recovery', body: 'How often you get straight back on track after a miss. Missing once is fine — missing twice is the habit slipping.' },
    { icon: 'sparkles', color: '#5E5CE6', title: 'Echo', body: 'Your coach. It reminds you, cheers you on, and gives you a push when you need it. Pick its voice in Settings.' },
    { icon: 'timer', color: '#FF375F', title: 'Focus timer', body: 'For habits measured in time. Start it, put your phone down, and the time counts on its own.' },
    { icon: 'people', color: '#30D158', title: 'Friends', body: 'Add friends to see each other’s day, react, and do habits together.' },
];

export default function Guide() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <SheetScreen title="How Habyss works" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {IDEAS.map((idea, index) => (
                    <ListItem key={idea.title} index={index}>
                        <VoidCard style={styles.card}>
                            <IconTile icon={idea.icon} color={idea.color} size={44} shape="square" />
                            <View style={styles.text}>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>{idea.title}</Text>
                                <Text style={[styles.body, { color: colors.textSecondary }]}>{idea.body}</Text>
                            </View>
                        </VoidCard>
                    </ListItem>
                ))}
            </ScrollView>
        </SheetScreen>
    );
}

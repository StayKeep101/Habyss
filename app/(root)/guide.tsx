import React from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/ui/AppButton';
import { HowItWorksStory } from '@/components/Guide/HowItWorksStory';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { styles } from '@/styles/screens/guide.styles';

/**
 * How Habyss works: a short animated story of the system — goals are the
 * target, habits and tasks the steps, Today's 3, Marks — and nothing else.
 * Opened once after onboarding (`intro=1`, with a button to start) and any
 * time from Settings.
 */
export default function Guide() {
    const intro = useLocalSearchParams<{ intro?: string }>().intro === '1';
    return (
        <SheetScreen title="How Habyss works" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <HowItWorksStory />
                {intro ? <AppButton label="Start climbing" onPress={() => router.back()} /> : null}
            </ScrollView>
        </SheetScreen>
    );
}

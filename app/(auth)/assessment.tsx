import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { PersonalityAssessment } from '@/components/Onboarding/PersonalityAssessment';
import { StatusBar } from 'expo-status-bar';

export default function AssessmentScreen() {
    const router = useRouter();

    const handleComplete = () => {
        // After assessment, go to sign up
        router.push('/(auth)/sign-up');
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar style="light" />
            <VoidShell>
                <PersonalityAssessment onComplete={handleComplete} />
            </VoidShell>
        </View>
    );
}

import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { PersonalityAssessment } from '@/components/Onboarding/PersonalityAssessment';
import { AnalyzingScreen } from '@/components/Onboarding/AnalyzingScreen';
import { StatusBar } from 'expo-status-bar';
import { setOnboardingComplete } from '@/lib/localUser';

export default function AssessmentScreen() {
    const router = useRouter();
    const [showAnalyzing, setShowAnalyzing] = useState(false);

    const handleQuizComplete = () => {
        // Show analyzing screen
        setShowAnalyzing(true);
    };

    const handleAnalysisComplete = async () => {
        // Mark onboarding as done, then go straight to app
        await setOnboardingComplete();
        router.replace('/(root)/(tabs)/home');
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar style="light" />

            {showAnalyzing ? (
                <AnalyzingScreen onComplete={handleAnalysisComplete} />
            ) : (
                <VoidShell>
                    <PersonalityAssessment onComplete={handleQuizComplete} />
                </VoidShell>
            )}
        </View>
    );
}


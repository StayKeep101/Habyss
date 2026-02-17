import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { PersonalityAssessment } from '@/components/Onboarding/PersonalityAssessment';
import { AnalyzingScreen } from '@/components/Onboarding/AnalyzingScreen';
import { StatusBar } from 'expo-status-bar';

export default function AssessmentScreen() {
    const router = useRouter();
    const [showAnalyzing, setShowAnalyzing] = useState(false);

    const handleQuizComplete = () => {
        // Show analyzing screen
        setShowAnalyzing(true);
    };

    const handleAnalysisComplete = () => {
        // After analysis, go to sign up
        router.push('/(auth)/sign-up');
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

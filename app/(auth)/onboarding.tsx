import React, { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FixedTheme } from '@/context/ThemeContext';
import { Ascent, forgetAscent, type AscentEnd } from '@/components/Ascent/Ascent';
import { FIRST_STEP_KEY, expectArrival } from '@/components/Ascent/AscentArrival';
import { stepOf } from '@/lib/ascent/plan';
import { setOnboardingComplete } from '@/lib/localUser';
import { clearDraft } from '@/lib/onboarding';

/**
 * The first run: The Ascent (components/Ascent). Finishing or skipping both
 * land in the app for good; when a first step was made, Home is told, so it
 * can rise out of the light and point at it.
 *
 * Developer → "Test onboarding" opens it with ?preview=1: the whole story,
 * saving nothing, back to Settings at the end.
 */
export default function OnboardingScreen() {
    const router = useRouter();
    const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';

    const end = useCallback(async ({ state, how }: AscentEnd) => {
        if (preview) { router.replace('/(root)/(tabs)/settings'); return; }
        await setOnboardingComplete();
        await Promise.all([clearDraft(), forgetAscent()]);
        if (state.created) {
            const step = { ...state.created, title: stepOf(state.answers).title, arrived: false };
            await AsyncStorage.setItem(FIRST_STEP_KEY, JSON.stringify(step)).catch(() => undefined);
        }
        if (how === 'finished') expectArrival();
        router.replace('/(root)/(tabs)/home');
    }, [preview, router]);

    return (
        <FixedTheme theme="abyss">
            <Ascent preview={preview} onEnd={end}
                onAccount={() => router.push({ pathname: '/(root)/account', params: { restore: '1' } })} />
        </FixedTheme>
    );
}

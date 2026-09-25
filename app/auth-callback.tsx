import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeOAuthSignIn, GOOGLE_REDIRECT } from '@/lib/socialSignIn';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { AppButton } from '@/components/Common/AppButton';
import { Typography } from '@/constants/DesignSystem';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

/** Handles OAuth even when the OS cold-launches Habyss with the callback. */
export default function AuthCallback() {
    const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
    const router = useRouter();
    const { theme } = useTheme();
    const [error, setError] = useState<string | null>(null);
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    const providerError = params.error;
    const description = params.error_description;
    useEffect(() => {
        let active = true;
        if (!code && !providerError) { router.replace('/(root)/account'); return; }
        const query = new URLSearchParams();
        if (code) query.set('code', code);
        if (providerError) query.set('error', String(providerError));
        if (description) query.set('error_description', String(description));
        completeOAuthSignIn(`${GOOGLE_REDIRECT}?${query}`).then(result => {
            if (!active) return;
            if (result.ok) router.replace('/(root)/(tabs)/community');
            else setError(result.error);
        });
        return () => { active = false; };
    }, [code, providerError, description, router]);
    return <SheetScreen title="Signing in">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 }}>
            {error ? <><Text accessibilityRole="alert" style={[Typography.body, { color: Colors[theme].error, textAlign: 'center' }]}>{error}</Text><AppButton label="Back to sign in" onPress={() => router.replace('/(root)/account')} /></>
                : <><ActivityIndicator color={Colors[theme].primary} /><Text style={[Typography.body, { color: Colors[theme].textSecondary }]}>Finishing your sign-in…</Text></>}
        </View>
    </SheetScreen>;
}

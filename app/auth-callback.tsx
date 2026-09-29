import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import { completeOAuthSignIn, GOOGLE_REDIRECT } from '@/lib/socialSignIn';
import { isAuthCallbackURL } from '@/lib/authRedirect';
import { SheetScreen } from '@/components/Layout/SheetScreen';
import { AppButton } from '@/components/Common/AppButton';
import { Typography } from '@/constants/DesignSystem';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

/** Handles Google and email links, including errors in URL fragments. */
export default function AuthCallback() {
    const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string }>();
    const incomingURL = useURL();
    const router = useRouter();
    const { theme } = useTheme();
    const [error, setError] = useState<string | null>(null);
    const code = Array.isArray(params.code) ? params.code[0] : params.code;
    const providerError = params.error;
    const errorCode = params.error_code;
    const description = params.error_description;
    useEffect(() => {
        let active = true;
        const query = new URLSearchParams();
        if (code) query.set('code', code);
        if (providerError) query.set('error', String(providerError));
        if (errorCode) query.set('error_code', String(errorCode));
        if (description) query.set('error_description', String(description));
        // Router params cover in-app navigation; the original URL preserves
        // Supabase's #error fragment, which the router does not expose.
        const url = code || providerError || errorCode
            ? `${GOOGLE_REDIRECT}?${query}`
            : incomingURL && isAuthCallbackURL(incomingURL) ? incomingURL : `${GOOGLE_REDIRECT}?${query}`;
        setError(null);
        completeOAuthSignIn(url).then(result => {
            if (!active) return;
            if (result.ok) router.replace('/(root)/(tabs)/community');
            else setError(result.error);
        });
        return () => { active = false; };
    }, [code, providerError, errorCode, description, incomingURL, router]);
    return <SheetScreen title="Signing in">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 }}>
            {error ? <><Text accessibilityRole="alert" style={[Typography.body, { color: Colors[theme].error, textAlign: 'center' }]}>{error}</Text><AppButton label="Back to sign in" onPress={() => router.replace('/(root)/account')} /></>
                : <><ActivityIndicator color={Colors[theme].primary} /><Text style={[Typography.body, { color: Colors[theme].textSecondary }]}>Finishing your sign-in…</Text></>}
        </View>
    </SheetScreen>;
}

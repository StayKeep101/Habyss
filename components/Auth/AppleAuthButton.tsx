import { Platform, StyleSheet, View, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

export function AppleAuthButton({ type = 'sign-in' }: { type?: 'sign-in' | 'sign-up' | 'continue' }) {
    if (Platform.OS !== 'ios') return null;

    return (
        <AppleAuthentication.AppleAuthenticationButton
            buttonType={type === 'sign-up' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={14}
            style={styles.button}
            onPress={async () => {
                try {
                    const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                    });

                    // Sign in via Supabase
                    if (credential.identityToken) {
                        const { error } = await supabase.auth.signInWithIdToken({
                            provider: 'apple',
                            token: credential.identityToken,
                        });

                        if (!error) {
                            // HARD PAYWALL: Redirect to paywall
                            router.replace("/(root)/onboarding-paywall");
                        } else {
                            throw error;
                        }
                    } else {
                        throw new Error('No identity token provided.');
                    }
                } catch (e: any) {
                    if (e.code === 'ERR_REQUEST_CANCELED') {
                        // handle that the user canceled the sign-in flow
                    } else {
                        Alert.alert('Error', e.message || 'Could not sign in with Apple');
                        console.error(e);
                    }
                }
            }}
        />
    );
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 52,
    },
});

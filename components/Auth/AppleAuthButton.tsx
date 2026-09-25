import React from 'react';
import { StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/constants/themeContext';

/** Native Apple branding, shared by every sign-in surface. */
export function AppleAuthButton({ type = 'continue', onPress, disabled = false }: {
    type?: 'sign-in' | 'sign-up' | 'continue';
    onPress: () => void;
    disabled?: boolean;
}) {
    const { theme } = useTheme();
    const types = AppleAuthentication.AppleAuthenticationButtonType;
    return <View pointerEvents={disabled ? 'none' : 'auto'} accessibilityState={{ disabled }}>
        <AppleAuthentication.AppleAuthenticationButton
            buttonType={type === 'sign-in' ? types.SIGN_IN : type === 'sign-up' ? types.SIGN_UP : types.CONTINUE}
            buttonStyle={theme === 'light' ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={999}
            style={styles.button}
            onPress={onPress}
        />
    </View>;
}
const styles = StyleSheet.create({ button: { width: '100%', height: 54 } });

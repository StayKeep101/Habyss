import { Platform, StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Apple Auth Button — DISABLED in local-only mode
 * Will be re-enabled when premium cloud sync is available.
 * For now, renders nothing (returning null).
 */
export function AppleAuthButton({ type = 'sign-in' }: { type?: 'sign-in' | 'sign-up' | 'continue' }) {
    // Authentication is not available in free/local-only mode
    return null;
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 52,
    },
});

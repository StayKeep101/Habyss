import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * What the app shows while it is getting ready.
 *
 * Deliberately nothing: the system's launch screen already shows the mark, so
 * repeating it in the app made every cold start feel like two splash screens.
 * This is the app's own background with a small spinner, and on a fast start
 * it is gone before the eye catches it.
 */
export const QuietLoading: React.FC<{ color?: string }> = ({ color = '#64748B' }) => (
    <View style={styles.container}>
        <ActivityIndicator color={color} />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' },
});

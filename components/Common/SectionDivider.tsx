import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';

export const SectionDivider: React.FC<{ label: string }> = ({ label }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    return (
        <View style={styles.row}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 8,
    },
    line: {
        flex: 1,
        height: 1,
    },
    label: {
        marginHorizontal: 12,
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Lexend_400Regular',
    },
});

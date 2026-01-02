import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '@/constants/Colors';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface StepEssenceProps {
    name: string;
    description: string;
    onUpdate: (data: any) => void;
    onSubmit: () => void;
    colors: any;
}

export const StepEssence: React.FC<StepEssenceProps> = ({ name, description, onUpdate, onSubmit, colors }) => {
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 500);
    }, []);

    return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Name your ritual</Text>

            <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                placeholder="e.g. Morning Read"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={(t) => onUpdate({ name: t })}
                returnKeyType="next"
                onSubmitEditing={() => {
                    if (name.length > 0) onSubmit();
                }}
            />

            <TextInput
                style={[styles.inputDesc, { color: colors.textSecondary, borderBottomColor: colors.border }]}
                placeholder="Add a small description (optional)"
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={(t) => onUpdate({ description: t })}
                returnKeyType="done"
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 40,
        textAlign: 'center',
    },
    input: {
        fontSize: 32,
        fontWeight: '600',
        textAlign: 'center',
        paddingBottom: 16,
        borderBottomWidth: 2,
        marginBottom: 32,
    },
    inputDesc: {
        fontSize: 18,
        textAlign: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
    }
});

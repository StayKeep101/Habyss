import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { UnifiedInputModal } from '@/components/Common/UnifiedInputModal'; // Using existing modal if needed, or building custom picker here

interface StepIdentityProps {
    icon: string;
    color: string;
    category: string;
    onUpdate: (data: any) => void;
    colors: any;
}

const PRESET_COLORS = [
    '#6B46C1', '#3B82F6', '#10B981', '#F97316', '#EF4444', '#EC4899', '#8B5CF6'
];

const ICONS = ['fitness', 'book', 'water', 'moon', 'sunny', 'code', 'musical-notes', 'brush', 'home', 'people'];

export const StepIdentity: React.FC<StepIdentityProps> = ({ icon, color, category, onUpdate, colors }) => {

    return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.container}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Choose an identity</Text>

            <View style={styles.previewContainer}>
                <View style={[styles.previewIcon, { backgroundColor: color }]}>
                    <Ionicons name={icon as any} size={48} color="white" />
                </View>
            </View>

            <View style={styles.section}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {PRESET_COLORS.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => onUpdate({ color: c })}
                            style={[
                                styles.colorBtn,
                                { backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' }
                            ]}
                        >
                            {color === c && <Ionicons name="checkmark" size={16} color="white" />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.section}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {ICONS.map(i => (
                        <TouchableOpacity
                            key={i}
                            onPress={() => onUpdate({ icon: i })}
                            style={[
                                styles.iconBtn,
                                {
                                    backgroundColor: icon === i ? color : colors.surfaceSecondary,
                                }
                            ]}
                        >
                            <Ionicons name={i as any} size={24} color={icon === i ? 'white' : colors.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

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
    previewContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    previewIcon: {
        width: 100,
        height: 100,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    section: {
        marginBottom: 24,
    },
    scrollContent: {
        gap: 16,
        paddingHorizontal: 10,
        justifyContent: 'center',
        flexGrow: 1
    },
    colorBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
    },
    iconBtn: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

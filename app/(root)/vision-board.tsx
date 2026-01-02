import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MasonryGrid } from '@/components/Vision/MasonryGrid';
import { getHabits } from '@/lib/habits';

export default function VisionBoard() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const router = useRouter();
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        loadVisionItems();
    }, []);

    const loadVisionItems = async () => {
        const habits = await getHabits();
        const goals = habits.filter(h => h.isGoal);

        const visionItems = goals.map(g => ({
            id: g.id,
            text: g.name,
            type: 'goal',
            // Random aspect ratio for visual interest unless we have real image metadata
            aspectRatio: 1 + (Math.random() * 0.5),
            color: getRandomPastelColor(), // Placeholder until we have goal colors
            imageUrl: `https://source.unsplash.com/random/400x${Math.floor(400 * (1 + Math.random() * 0.5))}?${g.name.split(' ').join(',')}`
        }));

        // Inject some quotes
        const quotes = [
            { id: 'q1', text: "The only way to do great work is to love what you do.", type: 'quote', aspectRatio: 0.8, color: colors.surfaceSecondary },
            { id: 'q2', text: "Discipline is freedom.", type: 'quote', aspectRatio: 1.2, color: colors.surfaceSecondary },
            { id: 'q3', text: "One day or day one. You decide.", type: 'quote', aspectRatio: 1.0, color: colors.surfaceSecondary }
        ];

        // Shuffle
        const combined = [...visionItems, ...quotes].sort(() => Math.random() - 0.5);
        setItems(combined);
    };

    const getRandomPastelColor = () => {
        const hues = [220, 260, 300, 340, 20]; // Blues, Purples, Pinks
        const hue = hues[Math.floor(Math.random() * hues.length)];
        return `hsl(${hue}, 70%, 75%)`;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Manifestation Canvas</Text>
                    <TouchableOpacity style={styles.addBtn}>
                        <Ionicons name="add" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                <MasonryGrid items={items} />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'System', // Replace with high-end font if available
        letterSpacing: -0.5,
    },
    backBtn: {
        padding: 8,
    },
    addBtn: {
        padding: 8,
    }
});

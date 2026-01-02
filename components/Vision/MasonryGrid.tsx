import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions, ScrollView, Animated } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { LinearGradient } from 'expo-linear-gradient';

interface VisionItem {
    id: string;
    text: string;
    imageUrl?: string;
    type: 'goal' | 'quote' | 'image';
    aspectRatio: number; // Height / Width ratio
    color?: string;
}

interface MaskonryGridProps {
    items: VisionItem[];
}

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const GAP = 12;
const COLUMN_WIDTH = (width - ((COLUMN_COUNT + 1) * GAP)) / COLUMN_COUNT;

export const MasonryGrid: React.FC<MaskonryGridProps> = ({ items }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];

    // Split items into columns
    const columns: VisionItem[][] = Array.from({ length: COLUMN_COUNT }, () => []);
    const heights = new Array(COLUMN_COUNT).fill(0);

    items.forEach(item => {
        // Find shortest column
        const shortestColIndex = heights.indexOf(Math.min(...heights));
        columns[shortestColIndex].push(item);
        heights[shortestColIndex] += (COLUMN_WIDTH * item.aspectRatio) + GAP;
    });

    return (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
                {columns.map((col, colIndex) => (
                    <View key={colIndex} style={styles.column}>
                        {col.map((item, index) => (
                            <VisionCard key={item.id} item={item} index={index} colIndex={colIndex} colors={colors} />
                        ))}
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const VisionCard = ({ item, index, colIndex, colors }: any) => {
    // Staggered fade in could go here

    return (
        <View
            style={[
                styles.card,
                {
                    height: COLUMN_WIDTH * item.aspectRatio,
                    backgroundColor: item.color || colors.surfaceSecondary
                }
            ]}
        >
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
            ) : null}

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.gradient}
            >
                <Text style={styles.text}>{item.text}</Text>
            </LinearGradient>

            {item.type === 'quote' && !item.imageUrl && (
                <View style={styles.quoteContainer}>
                    <Text style={[styles.quoteText, { color: colors.textPrimary }]}>"{item.text}"</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: GAP,
        paddingBottom: 100
    },
    grid: {
        flexDirection: 'row',
        gap: GAP,
    },
    column: {
        flex: 1,
        gap: GAP,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        width: '100%',
        marginBottom: 0,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 12,
    },
    text: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    quoteContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    quoteText: {
        fontSize: 18,
        fontStyle: 'italic',
        textAlign: 'center',
        fontWeight: '600',
    }
});

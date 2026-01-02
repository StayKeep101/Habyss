import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    withRepeat,
    withTiming,
    useAnimatedStyle,
    withSequence
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface StargateButtonProps {
    onPress: () => void;
    loading: boolean;
    price: string;
}

export const StargateButton: React.FC<StargateButtonProps> = ({ onPress, loading, price }) => {
    const shine = useSharedValue(-1);

    useEffect(() => {
        shine.value = withRepeat(
            withSequence(
                withTiming(2, { duration: 1500 }),
                withTiming(-1, { duration: 0 }) // Instant reset
            ),
            -1,
            false
        );
    }, []);

    const shineStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shine.value * 300 }, // Move shine across button
            { skewX: '-20deg' }
        ]
    }));

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            disabled={loading}
            style={styles.container}
        >
            <LinearGradient
                colors={['#8B5CF6', '#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                {/* Shine Effect */}
                <Animated.View style={[styles.shine, shineStyle]} />

                <View style={styles.content}>
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <View>
                                <Text style={styles.mainText}>Ignite Your Journey</Text>
                                <Text style={styles.subText}>{price} / month</Text>
                            </View>
                            <Ionicons name="arrow-forward-circle" size={32} color="white" style={{ marginLeft: 12, opacity: 0.9 }} />
                        </>
                    )}
                </View>
            </LinearGradient>

            {/* Glow Underlay */}
            <View style={styles.glow} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 24,
        marginBottom: 34,
        height: 72,
        borderRadius: 36,
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
    },
    gradient: {
        flex: 1,
        borderRadius: 36,
        overflow: 'hidden',
        justifyContent: 'center',
        zIndex: 2,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    subText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        textAlign: 'right',
    },
    shine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 100,
        backgroundColor: 'rgba(255,255,255,0.3)',
        zIndex: 1,
    },
    glow: {
        position: 'absolute',
        top: 10,
        left: 20,
        right: 20,
        height: 60,
        backgroundColor: '#8B5CF6',
        borderRadius: 30,
        opacity: 0.4,
        zIndex: 1,
    }
});

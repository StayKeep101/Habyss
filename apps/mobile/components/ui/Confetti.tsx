import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

interface Piece { x: number; drift: number; spin: number; delay: number; duration: number; width: number; height: number; color: string; round: boolean }

/**
 * Confetti falling from the top of the screen once, in the colours given.
 * Nothing at all with Reduce Motion on. It never takes a touch.
 */
export function Confetti({ colors, count = 48 }: { colors: string[]; count?: number }) {
    const { width, height } = useWindowDimensions();
    const reduced = useReducedMotion();
    // Thrown once, when it appears.
    const [pieces] = useState<Piece[]>(() => Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
        delay: Math.random() * 450,
        duration: 2400 + Math.random() * 1400,
        width: 6 + Math.random() * 4,
        height: 10 + Math.random() * 6,
        color: colors[index % colors.length],
        round: Math.random() < 0.25,
    })));
    if (reduced) return null;
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {pieces.map((piece, index) => <Fleck key={index} piece={piece} fall={height + 40} />)}
        </View>
    );
}

function Fleck({ piece, fall }: { piece: Piece; fall: number }) {
    const time = useSharedValue(0);
    useEffect(() => {
        time.set(withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) })));
    }, [time, piece.delay, piece.duration]);
    return <Animated.View style={[styles.fleck, useFleckStyle(time, piece, fall), {
        left: piece.x, width: piece.width, height: piece.round ? piece.width : piece.height,
        borderRadius: piece.round ? piece.width / 2 : 2, backgroundColor: piece.color,
    }]} />;
}

function useFleckStyle(time: SharedValue<number>, piece: Piece, fall: number) {
    const { drift, spin } = piece;
    return useAnimatedStyle(() => {
        const t = time.get();
        return {
            opacity: t === 0 ? 0 : t > 0.85 ? (1 - t) / 0.15 : 1,
            transform: [
                { translateY: -30 + t * fall },
                // A sway as it falls, wider the further it goes.
                { translateX: Math.sin(t * Math.PI * 3) * 18 + drift * t },
                { rotate: `${spin * t}deg` },
                { rotateY: `${t * 720}deg` },
            ],
        };
    });
}

const styles = StyleSheet.create({
    fleck: { position: 'absolute', top: 0 },
});

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { MatteSurface } from './MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily } from '@/theme/designSystem';

type Rect = { x: number; y: number; width: number; height: number };
type Target = { measure: () => Promise<Rect | null>; accepts: boolean };

interface DragContext {
    x: SharedValue<number>;
    y: SharedValue<number>;
    begin: (payload: string, label: string, x: number, y: number) => void;
    move: (x: number, y: number) => void;
    end: (x: number, y: number) => void;
    register: (id: string, target: Target) => () => void;
    hovered: string | null;
    dragging: boolean;
}

const Context = createContext<DragContext | null>(null);
/** How close to the top or bottom edge the finger must be for the page to scroll along. */
const EDGE = 110;
/** Touch and hold this long, still, before something lifts (iOS lifts at about half a second). */
const HOLD_MS = 450;
/** Moving more than this while holding is a scroll, never a drag. */
const STILL = 8;
/** A drop only counts once it was carried at least this far: lifting and letting go in place puts it back. */
const CARRY = 24;
const measureView = (view: View | null) => new Promise<Rect | null>(resolve => {
    if (!view) { resolve(null); return; }
    view.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
});

/**
 * Drag and drop, the way iOS does it: touch and hold something (`Draggable`)
 * until it lifts into a small card under your finger, carry it over a place
 * that takes it (`DropTarget`), which lights up, and let go. Near the top or
 * bottom of the page, the page scrolls along (`scrollBy`), so a day further
 * down can be reached. Letting go anywhere else puts it back.
 */
export function DragDropProvider({ children, onDrop, onDragging, scrollBy, style }: {
    children: React.ReactNode;
    onDrop: (payload: string, target: string) => void;
    /** While something is carried: the page should not scroll by itself. */
    onDragging?: (active: boolean) => void;
    /** Scrolls the page by this many points while the finger rests at an edge. */
    scrollBy?: (dy: number) => void;
    style?: StyleProp<ViewStyle>;
}) {
    const t = useTokens();
    // Read through a ref: the haptics functions are new each render, and the
    // callbacks below must stay the same for the whole drag.
    const haptics = useHaptics();
    const feel = useRef(haptics);
    feel.current = haptics;
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const origin = useSharedValue({ x: 0, y: 0 });
    const root = useRef<View>(null);
    const targets = useRef(new Map<string, Target>());
    const rects = useRef(new Map<string, Rect>());
    const carried = useRef<string | null>(null);
    const from = useRef<{ x: number; y: number } | null>(null);
    const travelled = useRef(false);
    const hoverRef = useRef<string | null>(null);
    const edge = useRef(0);
    const box = useRef<Rect | null>(null);
    const [label, setLabel] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);

    const remeasure = useCallback(async () => {
        const found = await Promise.all([...targets.current.entries()].filter(([, target]) => target.accepts)
            .map(async ([id, target]) => [id, await target.measure()] as const));
        rects.current = new Map(found.filter((entry): entry is readonly [string, Rect] => !!entry[1]));
    }, []);

    const hitTest = useCallback((px: number, py: number) => {
        let hit: string | null = null;
        for (const [id, rect] of rects.current) {
            if (px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height) { hit = id; break; }
        }
        if (hit !== hoverRef.current) {
            hoverRef.current = hit;
            setHovered(hit);
            if (hit) feel.current.selectionFeedback();
        }
    }, []);

    const begin = useCallback((payload: string, name: string, px: number, py: number) => {
        carried.current = payload;
        from.current = { x: px, y: py };
        travelled.current = false;
        setLabel(name);
        feel.current.mediumFeedback();
        onDragging?.(true);
        void measureView(root.current).then(rect => { box.current = rect; if (rect) origin.value = { x: rect.x, y: rect.y }; });
        void remeasure();
    }, [onDragging, remeasure, origin]);

    const move = useCallback((px: number, py: number) => {
        if (!carried.current) return;
        if (from.current && Math.hypot(px - from.current.x, py - from.current.y) >= CARRY) travelled.current = true;
        hitTest(px, py);
        const area = box.current;
        edge.current = !area || !scrollBy ? 0 : py < area.y + EDGE ? -1 : py > area.y + area.height - EDGE ? 1 : 0;
    }, [hitTest, scrollBy]);

    const end = useCallback((px: number, py: number) => {
        const payload = carried.current;
        if (!payload) return;
        const moved = travelled.current;
        carried.current = null;
        from.current = null;
        travelled.current = false;
        hoverRef.current = null;
        edge.current = 0;
        setHovered(null);
        setLabel(null);
        onDragging?.(false);
        if (!moved) return;
        // Where the targets are now, not where they were before the page moved:
        // the drop goes to the one under the finger as it lets go, or nowhere.
        void remeasure().then(() => {
            let target: string | null = null;
            for (const [id, rect] of rects.current) {
                if (px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height) { target = id; break; }
            }
            if (target) { feel.current.successFeedback(); onDrop(payload, target); }
        });
    }, [onDrop, onDragging, remeasure]);

    // While carrying: the page scrolls at an edge, and where things sit is read again as it does.
    useEffect(() => {
        if (!label) return;
        const scroll = setInterval(() => { if (edge.current && scrollBy) scrollBy(edge.current * 9); }, 16);
        const look = setInterval(() => { void remeasure().then(() => hitTest(x.value, y.value)); }, 180);
        return () => { clearInterval(scroll); clearInterval(look); };
    }, [label, scrollBy, remeasure, hitTest, x, y]);

    const register = useCallback((id: string, target: Target) => {
        targets.current.set(id, target);
        return () => { targets.current.delete(id); rects.current.delete(id); };
    }, []);

    const value = useMemo(() => ({ x, y, begin, move, end, register, hovered, dragging: !!label }), [x, y, begin, move, end, register, hovered, label]);
    const ghost = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - origin.value.x - 90 }, { translateY: y.value - origin.value.y - 56 }] }));

    return (
        <Context.Provider value={value}>
            <View ref={root} style={[styles.root, style]} collapsable={false}>
                {children}
                {label ? (
                    <Animated.View pointerEvents="none" style={[styles.ghost, ghost]}>
                        <MatteSurface radius={t.radius.full} elevation="floating" style={styles.ghostCard}>
                            <Text numberOfLines={1} style={[styles.ghostText, { color: t.color.textPrimary }]}>{label}</Text>
                        </MatteSurface>
                    </Animated.View>
                ) : null}
            </View>
        </Context.Provider>
    );
}

/**
 * Something that can be carried: touch and hold, still, then move. A plain
 * tap still reaches whatever is inside (a button, a row), and a finger that
 * moves before the hold is up is scrolling the page, so it never lifts.
 */
export function Draggable({ payload, label, disabled, children }: { payload: string; label: string; disabled?: boolean; children: React.ReactNode }) {
    const drag = useContext(Context);
    const gesture = useMemo(() => {
        const pan = Gesture.Pan().enabled(!!drag && !disabled).activateAfterLongPress(HOLD_MS)
            .failOffsetX([-STILL, STILL]).failOffsetY([-STILL, STILL]);
        if (!drag) return pan;
        const { x, y, begin, move, end } = drag;
        return pan
            .onStart(event => { x.value = event.absoluteX; y.value = event.absoluteY; runOnJS(begin)(payload, label, event.absoluteX, event.absoluteY); })
            .onUpdate(event => { x.value = event.absoluteX; y.value = event.absoluteY; runOnJS(move)(event.absoluteX, event.absoluteY); })
            .onFinalize(() => { runOnJS(end)(x.value, y.value); });
    }, [drag, disabled, payload, label]);
    return (
        <GestureDetector gesture={gesture}>
            <View collapsable={false}>{children}</View>
        </GestureDetector>
    );
}

/** A place something can be put down; it lights up while something is carried over it. */
export function DropTarget({ id, accepts = true, radius, style, children }: {
    id: string; accepts?: boolean; radius?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
    const t = useTokens();
    const drag = useContext(Context);
    const ref = useRef<View>(null);
    const register = drag?.register;
    useEffect(() => register?.(id, { measure: () => measureView(ref.current), accepts }), [register, id, accepts]);
    const over = drag?.hovered === id;
    return (
        <View ref={ref} collapsable={false} style={style}>
            {children}
            {over ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.over, { borderColor: t.color.accent, borderRadius: radius ?? t.radius.lg }]} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    ghost: { position: 'absolute', top: 0, left: 0, width: 180 },
    ghostCard: { paddingHorizontal: 16, paddingVertical: 12 },
    ghostText: { fontSize: 15, fontFamily: FontFamily.semibold, textAlign: 'center' },
    over: { borderWidth: 2 },
});

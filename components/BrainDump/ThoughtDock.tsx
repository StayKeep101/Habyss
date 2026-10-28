import React, { useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { textOn } from '@/theme/tokens';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';

export type DockTarget = 'habit' | 'task' | 'goal';
type Rect = { x: number; y: number; width: number; height: number };
export interface ThoughtDockHandle { targetAt: (x: number, y: number) => DockTarget | null }

const TARGETS: { id: DockTarget; label: string; icon: string }[] = [
    { id: 'habit', label: 'Habit', icon: 'repeat' },
    { id: 'task', label: 'Task', icon: 'checkbox' },
    { id: 'goal', label: 'Goal', icon: 'flag' },
];

/**
 * While a thought is held and carried: Habit, Task and Goal rise from the
 * bottom. Carried over one, it lights up in your colour; let go there and
 * the thought becomes that. Anywhere else, it only moves in the list.
 */
export function ThoughtDock({ hovered, dockRef }: { hovered: DockTarget | null; dockRef: React.Ref<ThoughtDockHandle> }) {
    const t = useTokens();
    const rects = useRef<Partial<Record<DockTarget, Rect>>>({});
    const views = useRef<Partial<Record<DockTarget, View | null>>>({});
    const measure = (id: DockTarget) => views.current[id]?.measureInWindow((x, y, width, height) => { rects.current[id] = { x, y, width, height }; });
    useImperativeHandle(dockRef, () => ({
        targetAt: (x, y) => {
            for (const target of TARGETS) {
                const rect = rects.current[target.id];
                if (rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y - 12 && y <= rect.y + rect.height + 12) return target.id;
            }
            return null;
        },
    }), []);
    return (
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} exiting={FadeOutDown.duration(180).reduceMotion(ReduceMotion.System)}
            style={styles.dock} pointerEvents="none">
            {TARGETS.map(target => {
                const on = hovered === target.id;
                return (
                    <View key={target.id} ref={view => { views.current[target.id] = view; }} onLayout={() => measure(target.id)} style={styles.slot} collapsable={false}>
                        <MatteSurface radius={Radius.card} level="control" tint={on ? t.color.accent : undefined} style={[styles.target, on && styles.targetOn]}>
                            <AppIcon name={target.icon} filled size={22} color={on ? textOn(t.color.accent) : t.color.accent} />
                            <Text style={[styles.label, { color: on ? textOn(t.color.accent) : t.color.textPrimary }]}>{target.label}</Text>
                        </MatteSurface>
                    </View>
                );
            })}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    dock: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xl, flexDirection: 'row', gap: Spacing.sm },
    slot: { flex: 1 },
    target: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
    targetOn: { transform: [{ scale: 1.06 }] },
    label: { fontFamily: FontFamily.semibold, fontSize: 15 },
});

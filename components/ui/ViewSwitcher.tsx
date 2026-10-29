import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export interface SwitcherOption<T extends string> {
    id: T;
    label: string;
    icon: IconName;
    /** Something new there: a small dot on its icon (and said to VoiceOver). */
    dot?: boolean;
}


/**
 * The control that changes what a detail page is showing.
 *
 * One capsule rather than a button in each corner: two buttons that both read
 * "Today" when you are looking at something else never said which one you were
 * on, while a segment that slides does. It sits on an opaque surface, because
 * a control floating over a scrolling page has to stay readable while the page
 * moves underneath it — a translucent pill lets the content show through and
 * turns into noise exactly when it is being used.
 */
export function ViewSwitcher<T extends string>({ options, value, onChange, accent }: {
    options: SwitcherOption<T>[];
    value: T;
    onChange: (id: T) => void;
    accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();

    return (
        <View accessibilityRole="tablist">
        <MatteSurface radius={32} elevation="floating" style={styles.bar}>
            {/* Like the tab bar: no pill behind the chosen one — its icon fills
                in the accent and its word brightens. */}

            {options.map(option => {
                const selected = option.id === value;
                return (
                    <Pressable
                        key={option.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        accessibilityLabel={option.dot ? `${option.label}, new` : option.label}
                        onPress={() => { if (!selected) selectionFeedback(); onChange(option.id); }}
                        style={styles.segment}
                    >
                        <View>
                            <AppIcon filled={selected} name={option.icon} size={18} color={selected ? accent : colors.textTertiary} />
                            {option.dot && !selected ? <View style={[styles.dot, { backgroundColor: accent, borderColor: colors.background }]} /> : null}
                        </View>
                        <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.textPrimary : colors.textTertiary }]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </MatteSurface>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
        height: 64, paddingHorizontal: 8,
    },
    segment: {
        flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: '100%',
    },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    dot: { position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
});

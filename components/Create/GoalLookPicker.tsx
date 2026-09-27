import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { GoalColorWheel } from './GoalColorWheel';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { readableAccent } from '@/lib/colorContrast';

/** Timed, never sprung: the panel changes height and a spring would bounce it. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));

/** Enough of the spectrum to read as "any colour" at 38 points across. */
const SPECTRUM = ['#EF4444', '#F59E0B', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];

const ICONS: { name: IconName; label: string; tags: string }[] = [
    { name: 'flag-outline', label: 'Flag', tags: 'goal target milestone' },
    { name: 'trophy-outline', label: 'Trophy', tags: 'win achievement' },
    { name: 'rocket-outline', label: 'Rocket', tags: 'launch business' },
    { name: 'book-outline', label: 'Book', tags: 'read study' },
    { name: 'barbell-outline', label: 'Weights', tags: 'fitness gym sport' },
    { name: 'wallet-outline', label: 'Wallet', tags: 'money save finance' },
    { name: 'heart-outline', label: 'Heart', tags: 'health love' },
    { name: 'briefcase-outline', label: 'Briefcase', tags: 'work career' },
    { name: 'leaf-outline', label: 'Leaf', tags: 'nature meditate calm' },
    { name: 'school-outline', label: 'Graduation', tags: 'learn study education' },
    { name: 'walk-outline', label: 'Walking', tags: 'steps fitness sport' },
    { name: 'code-slash-outline', label: 'Code', tags: 'programming app development' },
    { name: 'bicycle-outline', label: 'Bicycle', tags: 'ride cycle fitness' },
    { name: 'water-outline', label: 'Water', tags: 'drink hydration' },
    { name: 'musical-notes-outline', label: 'Music', tags: 'practice piano guitar' },
    { name: 'brush-outline', label: 'Brush', tags: 'art paint draw' },
    { name: 'camera-outline', label: 'Camera', tags: 'photo creativity' },
    { name: 'airplane-outline', label: 'Airplane', tags: 'travel trip' },
    { name: 'globe-outline', label: 'Globe', tags: 'language world travel' },
    { name: 'home-outline', label: 'Home', tags: 'house family' },
    { name: 'sunny-outline', label: 'Sun', tags: 'morning outdoors' },
    { name: 'moon-outline', label: 'Moon', tags: 'sleep night' },
    { name: 'star-outline', label: 'Star', tags: 'favorite dream' },
    { name: 'fitness-outline', label: 'Heartbeat', tags: 'health cardio' },
    { name: 'restaurant-outline', label: 'Food', tags: 'cook nutrition eat' },
    { name: 'cafe-outline', label: 'Coffee', tags: 'drink break' },
    { name: 'paw-outline', label: 'Paw', tags: 'pet dog cat' },
    { name: 'people-outline', label: 'People', tags: 'friends family community' },
    { name: 'chatbubbles-outline', label: 'Conversation', tags: 'social talk communication' },
    { name: 'pencil-outline', label: 'Pencil', tags: 'write journal' },
    { name: 'bulb-outline', label: 'Idea', tags: 'creativity invent' },
    { name: 'headset-outline', label: 'Headphones', tags: 'listen podcast audio' },
    { name: 'desktop-outline', label: 'Computer', tags: 'work technology' },
    { name: 'basketball-outline', label: 'Basketball', tags: 'sport fitness' },
    { name: 'football-outline', label: 'Football', tags: 'soccer sport' },
    { name: 'tennisball-outline', label: 'Tennis', tags: 'sport fitness' },
    { name: 'trail-sign-outline', label: 'Trail', tags: 'hike nature outdoor' },
    { name: 'flame-outline', label: 'Flame', tags: 'energy streak' },
    { name: 'diamond-outline', label: 'Diamond', tags: 'value wealth' },
    { name: 'gift-outline', label: 'Gift', tags: 'give celebrate' },
    { name: 'time-outline', label: 'Clock', tags: 'time focus' },
    { name: 'checkmark-circle-outline', label: 'Checkmark', tags: 'complete finish' },
];
const SWATCHES = [
    { name: 'Blue', color: '#6B8AF5' }, { name: 'Green', color: '#10B981' },
    { name: 'Amber', color: '#F59E0B' }, { name: 'Red', color: '#EF4444' },
    { name: 'Purple', color: '#8B5CF6' }, { name: 'Pink', color: '#EC4899' },
    { name: 'Teal', color: '#14B8A6' },
];

/**
 * Choosing how a goal or habit looks.
 *
 * Three things were wrong with the old one. It kept a preview of the icon on
 * the left, which is what the "Look" chip above the keyboard already shows, so
 * it spent a square of a small panel repeating itself. It showed twelve icons
 * and hid the other thirty-four behind "Browse all 42 icons", which is a tap
 * to see the thing you came for. And a colour wheel lived behind a line of
 * text reading "Custom color", where nothing about it looked like colour.
 *
 * Now: every icon, always, with the search on screen to narrow them; and the
 * wheel behind a circle of the spectrum sitting in the row of swatches, which
 * is the one place the eye is already looking for a colour.
 */
export function GoalLookPicker({ icon, color, onChange, subject = 'Goal' }: {
    subject?: 'Goal' | 'Habit';
    icon: IconName; color: string; onChange: (value: { icon?: IconName; color?: string }) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { selectionFeedback } = useHaptics();
    const tint = readableAccent(color, colors.background);
    const [tab, setTab] = useState<'icons' | 'color'>('icons');
    const [query, setQuery] = useState('');
    const [wheel, setWheel] = useState(false);

    const search = query.trim().toLowerCase();
    const icons = search
        ? ICONS.filter(item => `${item.label} ${item.tags}`.toLowerCase().includes(search))
        : ICONS;
    const custom = !SWATCHES.some(item => item.color.toUpperCase() === color.toUpperCase());

    return <Animated.View layout={MORPH} style={styles.content}>
        <View style={styles.tabs}>
            {(['icons', 'color'] as const).map(item => <Pressable key={item} accessibilityRole="tab"
                accessibilityLabel={item === 'icons' ? `${subject} icons` : `${subject} color`} accessibilityState={{ selected: tab === item }}
                onPress={() => { selectionFeedback(); setTab(item); }}
                style={[styles.tab, { backgroundColor: tab === item ? color + '20' : 'transparent', borderColor: tab === item ? tint : colors.border }]}>
                <Text style={[styles.label, { color: tab === item ? tint : colors.textSecondary }]}>{item === 'icons' ? 'Icon' : 'Colour'}</Text>
            </Pressable>)}
        </View>

        {tab === 'icons' ? <>
            <TextInput accessibilityLabel={`Search ${subject.toLowerCase()} icons`} value={query} onChangeText={setQuery}
                placeholder={`Search all ${ICONS.length} icons`} placeholderTextColor={colors.textTertiary}
                autoCorrect={false} autoCapitalize="none"
                style={[styles.search, { color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)' }]} />
            {/* Every icon, on screen. The panel has a ceiling so the sentence
                you are writing never leaves the screen to make room for them. */}
            <ScrollView style={styles.iconScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.icons}>
                    {icons.map(item => <Pressable key={item.name} accessibilityRole="radio" accessibilityLabel={`Icon ${item.label}`}
                        accessibilityState={{ selected: icon === item.name }}
                        onPress={() => { selectionFeedback(); onChange({ icon: item.name }); }}
                        style={[styles.icon, { backgroundColor: icon === item.name ? color + '20' : 'transparent', borderColor: icon === item.name ? tint : colors.border }]}>
                        <AppIcon name={item.name} size={22} color={icon === item.name ? tint : colors.textSecondary} />
                    </Pressable>)}
                </View>
            </ScrollView>
            {!icons.length ? <Text style={[styles.label, { color: colors.textSecondary }]}>No icons found. Try “art” or “work”.</Text> : null}
        </> : <>
            <View style={styles.swatches}>
                {SWATCHES.map(item => <Pressable key={item.color} accessibilityRole="radio" accessibilityLabel={`Color ${item.name}`}
                    accessibilityState={{ selected: color.toUpperCase() === item.color.toUpperCase() }}
                    onPress={() => { selectionFeedback(); setWheel(false); onChange({ color: item.color }); }}
                    style={[styles.swatch, { backgroundColor: item.color, borderColor: color.toUpperCase() === item.color.toUpperCase() ? colors.textPrimary : 'transparent' }]}>
                    {color.toUpperCase() === item.color.toUpperCase() ? <AppIcon name="checkmark" size={18} color="#000000" /> : null}
                </Pressable>)}

                {/* The spectrum, as a swatch. A wheel hidden behind the words
                    "Custom color" looked like nothing in particular; a circle
                    of every colour looks like what it opens. */}
                <Pressable accessibilityRole="button" accessibilityLabel="Any colour"
                    accessibilityState={{ expanded: wheel }}
                    onPress={() => { selectionFeedback(); setWheel(!wheel); }}
                    style={[styles.swatch, styles.spectrumWrap, { borderColor: custom ? colors.textPrimary : 'transparent' }]}>
                    <Svg width={38} height={38}>
                        <Defs>
                            <SvgGradient id={`spectrum-${subject}`} x1="0" y1="0" x2="1" y2="1">
                                {SPECTRUM.map((stop, index) => (
                                    <Stop key={stop} offset={index / (SPECTRUM.length - 1)} stopColor={stop} />
                                ))}
                            </SvgGradient>
                        </Defs>
                        <Circle cx={19} cy={19} r={19} fill={`url(#spectrum-${subject})`} />
                    </Svg>
                    {custom ? <AppIcon name="checkmark" size={18} color="#000000" style={StyleSheet.absoluteFill as never} /> : null}
                </Pressable>
            </View>

            {wheel ? (
                <Animated.View layout={MORPH} entering={FadeIn.duration(180)}>
                    <GoalColorWheel value={color} accent={tint} onChange={next => onChange({ color: next })} />
                </Animated.View>
            ) : null}
        </>}
    </Animated.View>;
}

const styles = StyleSheet.create({
    content: { gap: 10 },
    tabs: { flexDirection: 'row', gap: 8 }, tab: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
    iconScroll: { maxHeight: 188 },
    spectrumWrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontFamily: FontFamily.regular },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    icon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

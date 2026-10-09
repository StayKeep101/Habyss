import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { AppIcon, isGlyphIcon, isPhotoIcon, type IconName } from '@/components/Common/AppIcon';
import { GoalColorWheel } from './GoalColorWheel';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { contrastRatio, readableAccent } from '@/lib/colorContrast';

/** Whichever of black or white can actually be read on this swatch. */
const tickOn = (swatch: string): string =>
    contrastRatio('#000000', swatch) >= contrastRatio('#FFFFFF', swatch) ? '#000000' : '#FFFFFF';

/** Loaded lazily: a build without the picker should still show the tab. */
let ImagePicker: typeof import('expo-image-picker') | null = null;
try { ImagePicker = require('expo-image-picker'); } catch { ImagePicker = null; }

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
    // Chosen because somebody would plausibly make a habit of each, which is
    // the only test that matters — a picker of every glyph in the font is a
    // picker nobody can find anything in.
    { name: 'bed-outline', label: 'Sleep', tags: 'rest bed night early' },
    { name: 'sunny', label: 'Sunrise', tags: 'morning wake early rise' },
    { name: 'nutrition-outline', label: 'Nutrition', tags: 'eat healthy fruit diet' },
    { name: 'beer-outline', label: 'Drink', tags: 'alcohol quit sober' },
    { name: 'wine-outline', label: 'Wine', tags: 'alcohol quit sober' },
    { name: 'medkit-outline', label: 'Medicine', tags: 'pills vitamins health' },
    { name: 'body-outline', label: 'Body', tags: 'posture stretch physio' },
    { name: 'accessibility-outline', label: 'Stretch', tags: 'yoga mobility flexibility' },
    { name: 'american-football-outline', label: 'Football', tags: 'sport team' },
    { name: 'golf-outline', label: 'Golf', tags: 'sport practice' },
    { name: 'baseball-outline', label: 'Baseball', tags: 'sport practice' },
    { name: 'boat-outline', label: 'Rowing', tags: 'sport water kayak' },
    { name: 'snow-outline', label: 'Snow', tags: 'ski snowboard winter' },
    { name: 'barbell', label: 'Lift', tags: 'gym strength weights' },
    { name: 'stopwatch-outline', label: 'Stopwatch', tags: 'timer speed interval' },
    { name: 'calendar-outline', label: 'Calendar', tags: 'plan schedule review' },
    { name: 'alarm-outline', label: 'Alarm', tags: 'wake early morning' },
    { name: 'language-outline', label: 'Language', tags: 'learn spanish french vocabulary' },
    { name: 'library-outline', label: 'Library', tags: 'read study research' },
    { name: 'newspaper-outline', label: 'News', tags: 'read article journal' },
    { name: 'school', label: 'Study', tags: 'revise course exam' },
    { name: 'calculator-outline', label: 'Numbers', tags: 'maths budget accounts' },
    { name: 'card-outline', label: 'Spending', tags: 'money budget save finance' },
    { name: 'trending-up-outline', label: 'Invest', tags: 'money stocks saving' },
    { name: 'mail-outline', label: 'Email', tags: 'inbox work admin' },
    { name: 'call-outline', label: 'Call', tags: 'phone family friends' },
    { name: 'megaphone-outline', label: 'Practice speaking', tags: 'presentation speech voice' },
    { name: 'mic-outline', label: 'Voice', tags: 'sing podcast record' },
    { name: 'film-outline', label: 'Film', tags: 'watch study review' },
    { name: 'game-controller-outline', label: 'Gaming', tags: 'play limit quit' },
    { name: 'phone-portrait-outline', label: 'Screen time', tags: 'phone limit quit scroll' },
    { name: 'logo-no-smoking', label: 'No smoking', tags: 'quit cigarettes vape' },
    { name: 'hand-left-outline', label: 'Resist', tags: 'quit stop avoid' },
    { name: 'water', label: 'Hydrate', tags: 'drink water glasses' },
    { name: 'flask-outline', label: 'Experiment', tags: 'science test research' },
    { name: 'construct-outline', label: 'Build', tags: 'make diy project' },
    { name: 'hammer-outline', label: 'Craft', tags: 'woodwork make repair' },
    { name: 'color-palette-outline', label: 'Palette', tags: 'art design paint' },
    { name: 'shirt-outline', label: 'Laundry', tags: 'clothes chores tidy' },
    { name: 'trash-outline', label: 'Tidy', tags: 'clean chores declutter' },
    { name: 'car-outline', label: 'Commute', tags: 'drive travel car' },
    { name: 'bus-outline', label: 'Transit', tags: 'commute bus train' },
    { name: 'earth-outline', label: 'Explore', tags: 'travel world adventure' },
    { name: 'map-outline', label: 'Map', tags: 'hike explore navigate' },
    { name: 'sparkles-outline', label: 'Sparkle', tags: 'habit special new' },
    { name: 'shield-checkmark-outline', label: 'Discipline', tags: 'resist protect promise' },
    { name: 'infinite-outline', label: 'Forever', tags: 'consistency endless' },
    { name: 'partly-sunny-outline', label: 'Fresh air', tags: 'outdoors daylight walk sunshine' },
    { name: 'cloud-outline', label: 'Breathe', tags: 'calm breathing air' },
    { name: 'happy-outline', label: 'Mood', tags: 'gratitude feelings journal' },
    { name: 'journal-outline', label: 'Journal', tags: 'write diary reflect' },
    { name: 'create-outline', label: 'Write', tags: 'journal blog notes' },
    { name: 'heart-half-outline', label: 'Self care', tags: 'kindness rest recover' },
    { name: 'hand-right-outline', label: 'Help', tags: 'volunteer give kindness' },
    { name: 'cash-outline', label: 'Save', tags: 'money budget finance' },
    { name: 'trophy', label: 'Win', tags: 'achievement compete' },
    { name: 'ribbon-outline', label: 'Milestone', tags: 'award achievement' },
    { name: 'rocket', label: 'Launch', tags: 'ship business startup' },
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

    const typed = query.trim();
    const search = typed.toLowerCase();
    const icons = search
        ? ICONS.filter(item => `${item.label} ${item.tags}`.toLowerCase().includes(search))
        : ICONS;
    // Typing an emoji into the search field offers it as an icon, because that
    // is plainly what someone typing an emoji into an icon search wants.
    const glyph = typed && isGlyphIcon(typed) ? typed : null;
    const photo = isPhotoIcon(icon) ? icon : null;

    /** Your own picture, cropped square because every tile it lands in is. */
    const pickPhoto = async () => {
        if (!ImagePicker) return;
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6,
            });
            if (!result.canceled && result.assets?.[0]?.uri) onChange({ icon: result.assets[0].uri as IconName });
        } catch {
            // A picker that would not open is not worth an alert over an icon.
        }
    };
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
                placeholder={`Search ${ICONS.length} icons, or type an emoji`} placeholderTextColor={colors.textTertiary}
                autoCorrect={false} autoCapitalize="none"
                style={[styles.search, { color: colors.textPrimary, borderColor: colors.border,
                    backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)' }]} />
            {/* Every icon, on screen. The panel has a ceiling so the sentence
                you are writing never leaves the screen to make room for them. */}
            <ScrollView style={styles.iconScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.icons}>
                    {/* Your own, first: a picture from the library, or the
                        emoji being typed. Both are ordinary icons once chosen —
                        every card in the app draws them through AppIcon. */}
                    <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change your own picture' : 'Use your own picture'}
                        accessibilityState={{ selected: !!photo }}
                        onPress={() => { selectionFeedback(); void pickPhoto(); }}
                        style={[styles.icon, { backgroundColor: photo ? color + '20' : 'transparent', borderColor: photo ? tint : colors.border }]}>
                        {photo
                            ? <AppIcon name={photo} size={30} />
                            : <AppIcon name="image-outline" size={22} color={colors.textSecondary} />}
                    </Pressable>
                    {glyph ? (
                        <Pressable accessibilityRole="radio" accessibilityLabel={`Icon ${glyph}`}
                            accessibilityState={{ selected: icon === glyph }}
                            onPress={() => { selectionFeedback(); onChange({ icon: glyph as IconName }); }}
                            style={[styles.icon, { backgroundColor: icon === glyph ? color + '20' : 'transparent', borderColor: icon === glyph ? tint : colors.border }]}>
                            <AppIcon name={glyph} size={24} />
                        </Pressable>
                    ) : null}
                    {icons.map(item => <Pressable key={item.name} accessibilityRole="radio" accessibilityLabel={`Icon ${item.label}`}
                        accessibilityState={{ selected: icon === item.name }}
                        onPress={() => { selectionFeedback(); onChange({ icon: item.name }); }}
                        style={[styles.icon, { backgroundColor: icon === item.name ? color + '20' : 'transparent', borderColor: icon === item.name ? tint : colors.border }]}>
                        <AppIcon name={item.name} size={22} color={icon === item.name ? tint : colors.textSecondary} />
                    </Pressable>)}
                </View>
            </ScrollView>
            {!icons.length && !glyph ? <Text style={[styles.label, { color: colors.textSecondary }]}>No icons found. Try “art”, “work”, or an emoji.</Text> : null}
        </> : <>
            {/* With the wheel open the swatches become one row, so the wheel and
                its slider fit on screen without scrolling. */}
            <ScrollView horizontal={wheel} scrollEnabled={wheel} showsHorizontalScrollIndicator={false}
                contentContainerStyle={wheel ? styles.swatchRow : styles.swatches} keyboardShouldPersistTaps="handled">
                {SWATCHES.map(item => <Pressable key={item.color} accessibilityRole="radio" accessibilityLabel={`Color ${item.name}`}
                    accessibilityState={{ selected: color.toUpperCase() === item.color.toUpperCase() }}
                    onPress={() => { selectionFeedback(); setWheel(false); onChange({ color: item.color }); }}
                    style={[styles.swatch, { backgroundColor: item.color, borderColor: color.toUpperCase() === item.color.toUpperCase() ? colors.textPrimary : 'transparent' }]}>
                    {/* Black on amber reads; black on indigo does not. The
                        tick takes whichever of black or white the swatch it
                        sits on can actually carry. */}
                    {color.toUpperCase() === item.color.toUpperCase()
                        ? <AppIcon name="checkmark" size={18} color={tickOn(item.color)} /> : null}
                </Pressable>)}

                {/* The spectrum, as a swatch. A wheel hidden behind the words
                    "Custom color" looked like nothing in particular; a circle
                    of every colour looks like what it opens. */}
                <Pressable accessibilityRole="button" accessibilityLabel="Any colour"
                    accessibilityState={{ expanded: wheel }}
                    onPress={() => { selectionFeedback(); setWheel(!wheel); }}
                    style={[styles.swatch, styles.spectrumWrap, { borderColor: custom ? colors.textPrimary : 'transparent' }]}>
                    {/* Behind the tick rather than beside it. It used to be an
                        ordinary child with the tick laid out after it, and the
                        tick was pushed back on top with `absoluteFill` — which
                        stretches a text glyph across the whole 38pt box and
                        leaves it top-left rather than centred. That is the
                        lopsided mark. */}
                    <Svg width={38} height={38} style={StyleSheet.absoluteFill}>
                        <Defs>
                            <SvgGradient id={`spectrum-${subject}`} x1="0" y1="0" x2="1" y2="1">
                                {SPECTRUM.map((stop, index) => (
                                    <Stop key={stop} offset={index / (SPECTRUM.length - 1)} stopColor={stop} />
                                ))}
                            </SvgGradient>
                        </Defs>
                        <Circle cx={19} cy={19} r={19} fill={`url(#spectrum-${subject})`} />
                    </Svg>
                    {/* No single colour reads on a rainbow, so the tick brings
                        its own ground with it. */}
                    {custom ? (
                        <View style={styles.spectrumTick}>
                            <AppIcon name="checkmark" size={15} color="#FFFFFF" />
                        </View>
                    ) : null}
                </Pressable>
            </ScrollView>

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
    swatchRow: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
    spectrumWrap: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontFamily: FontFamily.regular },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    icon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    spectrumTick: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});

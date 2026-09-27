import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon, type IconName } from '@/components/Common/AppIcon';
import { GoalColorWheel } from './GoalColorWheel';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { readableAccent } from '@/lib/colorContrast';

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

export function GoalLookPicker({ icon, color, onChange, subject = 'Goal' }: {
    subject?: 'Goal' | 'Habit';
    icon: IconName; color: string; onChange: (value: { icon?: IconName; color?: string }) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const tint = readableAccent(color, colors.background);
    const [tab, setTab] = useState<'icons' | 'color'>('icons');
    const [browse, setBrowse] = useState(false);
    const [query, setQuery] = useState('');
    const [custom, setCustom] = useState(false);
    const icons = browse ? ICONS.filter(item => `${item.label} ${item.tags}`.toLowerCase().includes(query.toLowerCase().trim())) : ICONS.slice(0, 12);
    return <View style={styles.content}>
        <View style={styles.header}>
            <View style={[styles.preview, { backgroundColor: color + '20', borderColor: tint }]}>
                <AppIcon name={icon} size={26} color={tint} />
            </View>
            <View style={styles.tabs}>
                {(['icons', 'color'] as const).map(item => <Pressable key={item} accessibilityRole="tab"
                    accessibilityLabel={item === 'icons' ? `${subject} icons` : `${subject} color`} accessibilityState={{ selected: tab === item }}
                    onPress={() => { selectionFeedback(); setTab(item); }}
                    style={[styles.tab, { backgroundColor: tab === item ? color + '20' : colors.background, borderColor: tab === item ? tint : colors.border }]}>
                    <Text style={[styles.label, { color: tab === item ? tint : colors.textSecondary }]}>{item === 'icons' ? 'Icon' : 'Color'}</Text>
                </Pressable>)}
            </View>
        </View>
        {tab === 'icons' ? <>
            {browse ? <TextInput accessibilityLabel={`Search ${subject.toLowerCase()} icons`} value={query} onChangeText={setQuery}
                placeholder="Search icons, e.g. fitness or travel" placeholderTextColor={colors.textTertiary}
                autoCorrect={false} style={[styles.search, { color: colors.textPrimary, borderColor: colors.border }]} /> : null}
            <View style={styles.icons}>
                {icons.map(item => <Pressable key={item.name} accessibilityRole="radio" accessibilityLabel={`Icon ${item.label}`}
                    accessibilityState={{ selected: icon === item.name }}
                    onPress={() => { selectionFeedback(); onChange({ icon: item.name }); }}
                    style={[styles.icon, { backgroundColor: icon === item.name ? color + '20' : colors.background, borderColor: icon === item.name ? tint : colors.border }]}>
                    <AppIcon name={item.name} size={22} color={icon === item.name ? tint : colors.textSecondary} />
                </Pressable>)}
            </View>
            {!icons.length ? <Text style={[styles.label, { color: colors.textSecondary }]}>No icons found. Try “art” or “work”.</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => { setBrowse(!browse); setQuery(''); }} style={styles.more}>
                <Text style={[styles.label, { color: tint }]}>{browse ? 'Show fewer icons' : 'Browse all 42 icons'}</Text>
                <AppIcon name={browse ? 'chevron-up' : 'chevron-down'} size={14} color={tint} />
            </Pressable>
        </> : <>
            <View style={styles.swatches}>
                {SWATCHES.map(item => <Pressable key={item.color} accessibilityRole="radio" accessibilityLabel={`Color ${item.name}`}
                    accessibilityState={{ selected: color.toUpperCase() === item.color.toUpperCase() }}
                    onPress={() => { selectionFeedback(); onChange({ color: item.color }); }}
                    style={[styles.swatch, { backgroundColor: item.color, borderColor: color.toUpperCase() === item.color.toUpperCase() ? colors.textPrimary : 'transparent' }]}>
                    {color.toUpperCase() === item.color.toUpperCase() ? <AppIcon name="checkmark" size={18} color="#000000" /> : null}
                </Pressable>)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Custom color" accessibilityState={{ expanded: custom }}
                onPress={() => setCustom(!custom)} style={styles.more}>
                <Text style={[styles.label, { color: tint }]}>{custom ? 'Hide color wheel' : 'Custom color'}</Text>
                <Text style={[styles.hex, { color: colors.textSecondary }]}>{color.toUpperCase()}</Text>
                <AppIcon name={custom ? 'chevron-up' : 'color-palette-outline'} size={16} color={tint} />
            </Pressable>
            {custom ? <GoalColorWheel value={color} accent={tint} onChange={next => onChange({ color: next })} /> : null}
        </>}
    </View>;
}

const styles = StyleSheet.create({
    content: { gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    preview: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    tabs: { flexDirection: 'row', gap: 8 }, tab: { minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
    label: { fontSize: 13, fontFamily: FontFamily.medium },
    search: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13, fontFamily: FontFamily.regular },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    icon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    more: { flexDirection: 'row', minHeight: 36, alignItems: 'center', gap: 8 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    hex: { flex: 1, textAlign: 'right', fontSize: 12, fontFamily: FontFamily.regular },
});

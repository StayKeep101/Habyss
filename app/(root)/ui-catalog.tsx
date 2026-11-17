import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Svg from 'react-native-svg';
import {
    AnimatedFill, AppButton, AppIcon, AppTextField, Badge, ChartCard, CheckPop, ChipPicker, CountUp, Divider, EmptyState,
    GrowBar, HabitRow, HalfCircleProgress, IconButton, ModalHeader, PopIn, ProgressRing, Reveal, ChoiceRow, SheetScreen,
    SheetSection, StatTile, SwipeRow, Text, TimeRow, Toggle, ViewSwitcher, VoidCard, VoidModal, VoidSheet, Wheel,
    Avatar, CardRail, ChoicePill, ChoiceSheet, Confetti, DateWheels, DemonEdge, Echo, FaceStack, FocusPill, GameCard, HoldButton,
    IconTile, LevelTags, ListItem, MatteInput, MatteSurface, MicButton, MorphMenu, PageDots, PeopleFilter, PopupCard, PostCard,
    Receipt, SectionTitle, SegmentBar, SettingsGroup, SettingsRow, StepSlider, TimeWheels, TypingPlaceholder, VersusBar,
} from '@/components/ui';
import { BottomFade } from '@/components/ui/BottomFade';
import { useSharedValue } from 'react-native-reanimated';
import { CatalogSection, Specimen, Swatch, Variant } from '@/components/Catalog/Specimen';
import { useTokens } from '@/hooks/useTokens';
import type { TypeToken } from '@/theme/tokens';
import type { GoalPoint } from '@/lib/goalInsights';
import { styles } from '@/styles/screens/ui-catalog.styles';
import { GoalMilestones } from '@/components/Goal/GoalMilestones';
import { startTour } from '@/lib/coachMarks';
import { GoalCompleteSequence } from '@/components/Celebrations/GoalCompleteSequence';
import type { Milestone } from '@/lib/goalMilestones';

const CATALOG_TODAY = '2026-11-05';
const SAMPLE_MILESTONES: Milestone[] = [
    { id: 'm1', goalId: 'g', title: 'Finish Book 1', dueDate: '2026-11-02', doneAt: '2026-11-01', position: 1 },
    { id: 'm2', goalId: 'g', title: 'Finish Book 2', dueDate: '2026-11-04', position: 2 },
    { id: 'm3', goalId: 'g', title: 'Finish Book 3', dueDate: '2026-11-09', position: 3 },
    { id: 'm4', goalId: 'g', title: 'Finish Book 4', dueDate: '2026-11-16', position: 4 },
];

const TYPE_STYLES: TypeToken[] = ['display', 'screenTitle', 'title', 'heading', 'body', 'bodySmall', 'caption'];

const SAMPLE_SERIES: GoalPoint[] = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    actual: Math.round(index * 4.6 + (index % 3) * 2),
    pace: Math.round(index * 5.2),
}));

/**
 * Every building block of the app on one page, numbered.
 *
 * The real components, not pictures of them, in whichever theme is on — so
 * what you see here is exactly what the screens are made of. Quote a number
 * to change a piece ("#15c should be bolder"), and every screen using it
 * changes with it.
 */
export default function UICatalog() {
    const t = useTokens();
    const [on, setOn] = useState(true);
    const [segment, setSegment] = useState<'day' | 'week' | 'month'>('week');
    const [chip, setChip] = useState<'easy' | 'normal' | 'hard'>('normal');
    const [view, setView] = useState<'list' | 'grid'>('list');
    const [wheel, setWheel] = useState(25);
    const [time, setTime] = useState('07:30');
    const [text, setText] = useState('');
    const [done, setDone] = useState(false);
    const [taskDone, setTaskDone] = useState(true);
    const [modal, setModal] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [catalogMilestones, setCatalogMilestones] = useState<Milestone[]>(SAMPLE_MILESTONES);
    // Motion demos: replay remounts them, change moves their value.
    const [replay, setReplay] = useState(0);
    // The goal-reached ceremony, played here for show (no goal, no Marks).
    const [ceremony, setCeremony] = useState(0);
    const [level, setLevel] = useState(0.62);
    // The pieces added later (#42 on): their own little bits of state.
    const [birthday, setBirthday] = useState(() => new Date(2000, 0, 15));
    const [days, setDays] = useState<3 | 7 | 14>(7);
    const [pill, setPill] = useState(true);
    const [person, setPerson] = useState('all');
    const [choices, setChoices] = useState(false);
    const [popup, setPopup] = useState(false);
    const [receipt, setReceipt] = useState(false);
    const [confetti, setConfetti] = useState(0);
    const [demon, setDemon] = useState(false);
    const [listening, setListening] = useState(false);
    const [rows, setRows] = useState(['Morning run', 'Read 10 pages', 'Deep work']);
    const dots = useSharedValue(0);
    const [dot, setDot] = useState(0);
    const faces = [
        { userId: 'a', name: 'Sam' }, { userId: 'b', name: 'Lea' }, { userId: 'c', name: 'Noah' }, { userId: 'd', name: 'Ava' }, { userId: 'e', name: 'Kai' },
    ];

    const colors = [
        ['background', t.color.background], ['surface', t.color.surface], ['surfaceRaised', t.color.surfaceRaised],
        ['border', t.color.border], ['textPrimary', t.color.textPrimary], ['textMuted', t.color.textMuted],
        ['textSubtle', t.color.textSubtle], ['accent', t.color.accent], ['success', t.color.success],
        ['warning', t.color.warning], ['danger', t.color.danger], ['cobalt', t.color.cobalt], ['silver', t.color.silver],
    ] as const;

    return (
        <SheetScreen title="UI catalogue" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.intro}>
                    <Text variant="body" tone="muted">
                        Every building block in the app, numbered, from #1 to #73. Tell Claude the number and what to change. Every screen using that piece changes with it.
                    </Text>
                </View>

                {/* ───────────────────────── Foundations ───────────────────────── */}
                <CatalogSection title="Foundations" description="The values everything else is made from. They live in theme/." />

                <Specimen number={1} name="Colours" file="theme/colors.ts" note="named in theme/tokens.ts">
                    <View style={styles.wrap}>{colors.map(([name, value]) => <Swatch key={name} name={name} color={value} />)}</View>
                </Specimen>

                <Specimen number={2} name="Accent tints" file="theme/tokens.ts" note="your accent at three strengths">
                    <View style={styles.wrap}>
                        <Swatch name="subtle" color={t.tint('subtle')} />
                        <Swatch name="soft" color={t.tint('soft')} />
                        <Swatch name="border" color={t.tint('border')} />
                    </View>
                </Specimen>

                <Specimen number={3} name="Text styles" file="theme/designSystem.ts" note="Typography">
                    {TYPE_STYLES.map((variant, index) => (
                        <Variant key={variant} letter={String.fromCharCode(97 + index)} label={variant}>
                            <Text variant={variant}>Build the life you want</Text>
                        </Variant>
                    ))}
                </Specimen>

                <Specimen number={4} name="Text colours" file="components/ui/Text.tsx">
                    {(['primary', 'muted', 'accent', 'success', 'warning', 'danger'] as const).map((tone, index) => (
                        <Variant key={tone} letter={String.fromCharCode(97 + index)} label={tone}>
                            <Text tone={tone}>Five habits done today</Text>
                        </Variant>
                    ))}
                </Specimen>

                <Specimen number={5} name="Spacing" file="theme/tokens.ts" note="space">
                    {(Object.keys(t.space) as (keyof typeof t.space)[]).map(key => (
                        <View key={key} style={styles.row}>
                            <Text variant="caption" tone="muted">{key} · {t.space[key]}</Text>
                            <View style={[styles.spaceBar, { width: t.space[key] * 4, backgroundColor: t.color.accent }]} />
                        </View>
                    ))}
                </Specimen>

                <Specimen number={6} name="Corners" file="theme/designSystem.ts" note="Radius">
                    <View style={styles.wrap}>
                        {(Object.keys(t.radius) as (keyof typeof t.radius)[]).map(key => (
                            <View key={key} style={{ gap: t.space.xs, alignItems: 'center' }}>
                                <View style={[styles.radiusBox, { borderRadius: t.radius[key], backgroundColor: t.color.surfaceRaised, borderWidth: 1, borderColor: t.color.border }]} />
                                <Text variant="caption">{key}</Text>
                            </View>
                        ))}
                    </View>
                </Specimen>

                <Specimen number={7} name="Shadows" file="theme/designSystem.ts" note="Elevation">
                    <View style={styles.wrap}>
                        {(['none', 'card', 'floating'] as const).map(level => (
                            <View key={level} style={[styles.shadowBox, { borderRadius: t.radius.lg, backgroundColor: t.color.surface }, t.elevation(level)]}>
                                <Text variant="caption">{level}</Text>
                            </View>
                        ))}
                    </View>
                </Specimen>

                {/* ───────────────────────── Surfaces ───────────────────────── */}
                <CatalogSection title="Surfaces" description="Cards, sections, headers and windows." />

                <Specimen number={8} name="Card" file="components/ui/VoidCard.tsx" note="matte: soft top-to-bottom gradient, one light edge, soft shadow">
                    <VoidCard><View style={styles.cardBody}><Text variant="heading">Morning run</Text><Text tone="muted">Every day · 07:00</Text></View></VoidCard>
                </Specimen>

                <Specimen number={9} name="Sheet section" file="components/ui/SheetSection.tsx">
                    <SheetSection title="Reminders" description="When Echo should nudge you." first>
                        <Toggle label="Morning check-in" value={on} onChange={setOn} />
                    </SheetSection>
                </Specimen>

                <Specimen number={10} name="Page header" file="components/ui/ModalHeader.tsx" note="top of every pushed page">
                    <ModalHeader title="Habit details" subtitle="Morning run" onBack={() => undefined} onAction={() => undefined} actionIcon="create-outline" actionLabel="Edit" />
                </Specimen>

                <Specimen number={11} name="Centred window" file="components/ui/VoidModal.tsx">
                    <AppButton label="Open window" onPress={() => setModal(true)} />
                </Specimen>

                <Specimen number={12} name="Bottom sheet" file="components/ui/VoidSheet.tsx">
                    <AppButton label="Open sheet" onPress={() => setSheet(true)} />
                </Specimen>

                {/* ───────────────────────── Controls ───────────────────────── */}
                <CatalogSection title="Controls" description="Everything you press, type into or pick from." />

                <Specimen number={13} name="Button" file="components/ui/AppButton.tsx" note="one matte button">
                    <Variant letter="a" label="Button"><AppButton label="Save habit" onPress={() => undefined} /></Variant>
                    <Variant letter="b" label="With icon"><AppButton label="Add habit" icon="add" onPress={() => undefined} /></Variant>
                    <Variant letter="c" label="Danger"><AppButton label="Delete habit" variant="danger" onPress={() => undefined} /></Variant>
                    <Variant letter="d" label="Loading"><AppButton label="Saving" loading onPress={() => undefined} /></Variant>
                    <Variant letter="e" label="Disabled"><AppButton label="Save habit" disabled onPress={() => undefined} /></Variant>
                </Specimen>

                <Specimen number={14} name="Icon button" file="components/ui/IconButton.tsx" note="one matte disc">
                    <View style={styles.row}>
                        <IconButton icon="settings-outline" label="Settings" onPress={() => undefined} />
                        <IconButton icon="notifications" label="Inbox" onPress={() => undefined} badge={3} />
                    </View>
                </Specimen>

                <Specimen number={15} name="Text field" file="components/ui/AppTextField.tsx" note="one field look">
                    <Variant letter="a" label="Field"><AppTextField label="Habit name" placeholder="Read 10 pages" value={text} onChangeText={setText} /></Variant>
                    <Variant letter="b" label="Error"><AppTextField label="Habit name" value="" onChangeText={() => undefined} error="Give it a name" /></Variant>
                </Specimen>

                <Specimen number={16} name="Choice row" file="components/ui/ChoiceRow.tsx">
                    <ChoiceRow options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} value={segment} onChange={setSegment} />
                </Specimen>

                <Specimen number={17} name="Chip picker" file="components/ui/ChipPicker.tsx">
                    <ChipPicker accent={t.color.accent} value={chip} onChange={setChip}
                        options={[{ id: 'easy', label: 'Easy', icon: 'leaf-outline' }, { id: 'normal', label: 'Normal', icon: 'walk-outline' }, { id: 'hard', label: 'Hard', icon: 'flame-outline' }]} />
                </Specimen>

                <Specimen number={18} name="Switch" file="components/ui/Toggle.tsx">
                    <Variant letter="a" label="Row"><Toggle label="Daily reminder" detail="At 07:30 every morning" value={on} onChange={setOn} /></Variant>
                    <Variant letter="b" label="On its own"><Toggle value={on} onChange={setOn} /></Variant>
                </Specimen>

                <Specimen number={19} name="Time row" file="components/ui/TimeRow.tsx">
                    <TimeRow icon="alarm-outline" label="Remind me" value={time} accent={t.color.accent} onChange={setTime} />
                </Specimen>

                <Specimen number={20} name="Wheel" file="components/ui/Wheel.tsx">
                    <Wheel options={[5, 10, 15, 20, 25, 30, 45, 60].map(id => ({ id, label: `${id} min` }))} value={wheel} onChange={setWheel} />
                </Specimen>

                <Specimen number={21} name="View switcher" file="components/ui/ViewSwitcher.tsx">
                    <ViewSwitcher accent={t.color.accent} value={view} onChange={setView}
                        options={[{ id: 'list', label: 'List', icon: 'list' }, { id: 'grid', label: 'Grid', icon: 'grid-outline' }]} />
                </Specimen>

                <Specimen number={22} name="Swipe row" file="components/ui/SwipeRow.tsx" note="swipe it left or right">
                    <SwipeRow
                        left={{ icon: 'checkmark', label: 'Done', color: t.color.success, onPress: () => undefined }}
                        right={[{ icon: 'trash-outline', label: 'Delete', color: t.color.danger, onPress: () => undefined }]}
                    >
                        <VoidCard><View style={styles.swipeBody}><Text>Swipe me</Text></View></VoidCard>
                    </SwipeRow>
                </Specimen>

                {/* ───────────────────────── Content ───────────────────────── */}
                <CatalogSection title="Content" description="How things are shown: rows, numbers, rings, charts, labels." />

                <Specimen number={23} name="Habit and task row" file="components/ui/HabitRow.tsx" note="tap the circle">
                    <Variant letter="a" label="Habit"><HabitRow title="Read 10 pages" meta="Every day · 21:00" icon="book-outline" done={done} onToggle={() => setDone(value => !value)} trailing="3 in a row" /></Variant>
                    <Variant letter="b" label="Task"><HabitRow title="Send the invoice" meta="Today" kind="task" done={taskDone} onToggle={() => setTaskDone(value => !value)} /></Variant>
                </Specimen>

                <Specimen number={24} name="Badge" file="components/ui/Badge.tsx">
                    <View style={styles.wrap}>
                        <Badge label="Accent" />
                        <Badge label="On track" tone="success" dot />
                        <Badge label="Behind" tone="warning" dot />
                        <Badge label="Overdue" tone="danger" />
                        <Badge label="Neutral" tone="neutral" icon="time-outline" />
                    </View>
                </Specimen>

                <Specimen number={25} name="Stat" file="components/ui/StatTile.tsx">
                    <Variant letter="a" label="Row of stats">
                        <View style={styles.row}>
                            <StatTile value="12" label="Streak" icon="flame-outline" />
                            <StatTile value="84%" label="Kept" tone="success" />
                            <StatTile value="1,240" label="Marks" />
                        </View>
                    </Variant>
                    <Variant letter="b" label="Hero"><StatTile size="hero" value="62%" label="of your goal" detail="+4% this week" align="left" /></Variant>
                </Specimen>

                <Specimen number={26} name="Progress ring" file="components/ui/ProgressRing.tsx">
                    <View style={styles.row}>
                        <ProgressRing size="sm" progress={0.3} />
                        <ProgressRing size="md" progress={0.62} label="62%" tone="success" />
                        <ProgressRing size="md" progress={0.85} label="85%" tone="warning" />
                    </View>
                    <ProgressRing size="lg" progress={0.62} label="62%" />
                </Specimen>

                <Specimen number={27} name="Half-circle gauge" file="components/ui/HalfCircleProgress.tsx">
                    <HalfCircleProgress progress={62} size={160} strokeWidth={12} color={t.color.accent} backgroundColor={t.color.surfaceRaised} textColor={t.color.textPrimary} fontSize={20} />
                </Specimen>

                <Specimen number={28} name="Chart card" file="components/ui/ChartCard.tsx" note="drag across the chart">
                    <ChartCard value="62%" caption="done overall" series={SAMPLE_SERIES} legend={{ actual: 'Done', pace: 'On pace' }} />
                </Specimen>

                <Specimen number={29} name="Empty state" file="components/ui/EmptyState.tsx">
                    <EmptyState icon="flag-outline" title="No goals yet" message="A goal gives your habits somewhere to go." actionLabel="Add a goal" onAction={() => undefined} />
                </Specimen>

                <Specimen number={30} name="Divider" file="components/ui/Divider.tsx">
                    <Variant letter="a" label="Full width"><Divider /></Variant>
                    <Variant letter="b" label="Inset"><Divider inset /></Variant>
                </Specimen>

                <Specimen number={31} name="Icons" file="components/ui/AppIcon.tsx" note="the only way to draw an icon">
                    <View style={styles.wrap}>
                        {(['flame', 'checkmark-circle', 'flag', 'book-outline', 'barbell-outline', 'water-outline', 'moon-outline', 'people-outline', 'trophy-outline', 'time-outline'] as const).map(name => (
                            <AppIcon key={name} name={name} size={t.space['2xl']} color={t.color.textPrimary} />
                        ))}
                    </View>
                </Specimen>

                <Specimen number={32} name="Check pop" file="components/ui/CheckPop.tsx" note="tap to see it">
                    <View style={styles.row}>
                        <CheckPop active={done} color={t.color.success} size={t.space['4xl']}>
                            <IconButton icon={done ? 'checkmark-circle' : 'ellipse-outline'} label="Toggle" onPress={() => setDone(value => !value)} />
                        </CheckPop>
                        <Text tone="muted">{done ? 'Done' : 'Not done'}</Text>
                    </View>
                </Specimen>

                {/* ───────────────────────── Motion ───────────────────────── */}
                <CatalogSection title="Motion" description="How charts, bars and numbers move. Replay shows a page opening; Change shows a habit being ticked." />
                <View style={[styles.row, { paddingBottom: t.space.md }]}>
                    <View style={{ flex: 1 }}><AppButton label="Replay" icon="refresh" onPress={() => setReplay(value => value + 1)} /></View>
                    <View style={{ flex: 1 }}><AppButton label="Change" icon="swap-vertical" onPress={() => setLevel(value => (value > 0.5 ? 0.24 : 0.86))} /></View>
                </View>

                <View key={replay}>
                    <Specimen number={33} name="Bar fill" file="components/ui/Motion.tsx" note="AnimatedFill">
                        <View style={[styles.motionTrack, { backgroundColor: t.color.surfaceRaised }]}>
                            <AnimatedFill progress={level} style={[styles.motionFill, { backgroundColor: t.color.accent }]} />
                        </View>
                    </Specimen>

                    <Specimen number={34} name="Chart bars" file="components/ui/Motion.tsx" note="GrowBar">
                        <Svg width={t.space['4xl'] * 7} height={t.space['4xl'] * 2}>
                            {[0.4, 0.7, 0.55, 0.9, level, 0.3, 0.65].map((share, index) => (
                                <GrowBar key={index} x={index * t.space['4xl']} width={t.space['3xl']} floor={t.space['4xl'] * 2}
                                    height={share * t.space['4xl'] * 2} rx={t.radius.sm} fill={t.color.accent} delay={index * 35} />
                            ))}
                        </Svg>
                    </Specimen>

                    <Specimen number={35} name="Counting number" file="components/ui/Motion.tsx" note="CountUp">
                        <CountUp value={`${Math.round(level * 100)}%`} style={[t.type.display, { color: t.color.textPrimary }]} />
                    </Specimen>

                    <Specimen number={36} name="Line draw-in" file="components/ui/Motion.tsx" note="Reveal">
                        <Reveal>
                            <View style={{ width: t.space['4xl'] * 7, height: t.space.sm, borderRadius: t.radius.full, backgroundColor: t.color.accent }} />
                        </Reveal>
                    </Specimen>

                    <Specimen number={38} name="Goal milestones" file="components/Goal/GoalMilestones.tsx" note="A path of flags: reached, next, late, ahead. Tap a flag to reach it.">
                        <GoalMilestones color={t.color.accent} today={CATALOG_TODAY} milestones={catalogMilestones}
                            onToggle={milestone => setCatalogMilestones(list => list.map(item => item.id === milestone.id ? { ...item, doneAt: item.doneAt ? undefined : 'now' } : item))}
                            onOpen={() => setSheet(true)} />
                    </Specimen>
                    <Specimen number={39} name="First-run tour" file="components/ui/CoachMarks.tsx" note="In order across screens: Home's cards, making a first goal yourself, Roadmap, friends.">
                        <AppButton label="Start the tour" onPress={() => { router.navigate('/(root)/(tabs)/home'); setTimeout(startTour, 450); }} />
                    </Specimen>
                    <Specimen number={40} name="Opening a sheet or a window" file="theme/motion.ts" note="OVERLAY: every sheet, menu, filter and popup opens and closes the same way (260 ms in, 190 ms out, no bounce)">
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}><AppButton label="Sheet" icon="arrow-up" onPress={() => setSheet(true)} /></View>
                            <View style={{ flex: 1 }}><AppButton label="Window" icon="albums" onPress={() => setModal(true)} /></View>
                        </View>
                    </Specimen>
                    <Specimen number={41} name="Goal reached" file="components/Celebrations/GoalCompleteSequence.tsx" note="The ceremony: settle, gather, the beat, reveal, count, rest, return. Tap anywhere to skip. docs/motion-system.md §4.1">
                        <AppButton label="Play it" icon="trophy" onPress={() => setCeremony(value => value + 1)} />
                    </Specimen>
                    <Specimen number={37} name="Cells fading in" file="components/ui/Motion.tsx" note="PopIn">
                        <View style={styles.wrap}>
                            {Array.from({ length: 21 }, (_, index) => (
                                <PopIn key={index} index={index} style={[styles.popCell, { backgroundColor: index % 3 ? t.color.accent : t.color.surfaceRaised }]} />
                            ))}
                        </View>
                    </Specimen>
                </View>

                {/* ───────────────────────── People ───────────────────────── */}
                <CatalogSection title="People and headings" description="Faces, icon tiles and the heading over every section." />

                <Specimen number={42} name="Face" file="components/ui/Avatar.tsx" note="a photo or a first letter; a ring, a badge, dimmed">
                    <View style={styles.row}>
                        <Avatar name="Sam" size={t.space['4xl'] + t.space.md} />
                        <Avatar name="Lea" size={t.space['4xl'] + t.space.md} ring={t.color.accent} />
                        <Avatar name="Noah" size={t.space['4xl'] + t.space.md} badge={<View style={{ width: t.space.md, height: t.space.md, borderRadius: t.radius.full, backgroundColor: t.color.success }} />} />
                        <Avatar name="Ava" size={t.space['4xl'] + t.space.md} dim />
                    </View>
                </Specimen>

                <Specimen number={43} name="Faces together" file="components/ui/FaceStack.tsx" note="who is with you">
                    <FaceStack faces={faces} size={t.space['3xl']} ring={t.color.accent} />
                </Specimen>

                <Specimen number={44} name="Icon tile" file="components/ui/IconTile.tsx">
                    <View style={styles.row}>
                        <IconTile icon="flame" color={t.color.accent} />
                        <IconTile icon="book" color={t.color.cobalt} shape="square" />
                        <IconTile icon="checkmark" color={t.color.success} muted />
                    </View>
                </Specimen>

                <Specimen number={45} name="Section heading" file="components/ui/SectionTitle.tsx" note="with something on the right">
                    <SectionTitle first right={<Badge label="3 new" />}>This week</SectionTitle>
                </Specimen>

                <Specimen number={46} name="Whose progress" file="components/ui/PeopleFilter.tsx">
                    <PeopleFilter allColor={t.color.accent} value={person} onChange={setPerson}
                        people={[{ id: 'me', name: 'You', color: t.color.accent }, { id: 'sam', name: 'Sam', color: t.color.cobalt }, { id: 'lea', name: 'Lea', color: t.color.success }]} />
                </Specimen>

                {/* ───────────────────────── More controls ───────────────────────── */}
                <CatalogSection title="More controls" description="Surfaces, fields, pickers, sliders and menus." />

                <Specimen number={47} name="Matte surface" file="components/ui/MatteSurface.tsx" note="what every card, button, field and chip is made of">
                    <Variant letter="a" label="Flat"><MatteSurface radius={t.radius.lg} style={styles.cardBody}><Text>On the page</Text></MatteSurface></Variant>
                    <Variant letter="b" label="Floating"><MatteSurface radius={t.radius.lg} elevation="floating" style={styles.cardBody}><Text>Over the page</Text></MatteSurface></Variant>
                    <Variant letter="c" label="Tinted"><MatteSurface radius={t.radius.lg} tint={t.tint('subtle')} style={styles.cardBody}><Text>Chosen</Text></MatteSurface></Variant>
                </Specimen>

                <Specimen number={48} name="Input" file="components/ui/MatteInput.tsx" note="a field with no label">
                    <Variant letter="a" label="Field"><MatteInput placeholder="Search habits" value={text} onChangeText={setText} /></Variant>
                    <Variant letter="b" label="Invalid"><MatteInput placeholder="Name" invalid value="" onChangeText={() => undefined} /></Variant>
                </Specimen>

                <Specimen number={49} name="Choice pill" file="components/ui/ChoicePill.tsx">
                    <View style={styles.row}>
                        <ChoicePill label="On" icon="checkmark" on={pill} color={t.color.accent} onPress={() => setPill(true)} />
                        <ChoicePill label="Off" on={!pill} color={t.color.accent} onPress={() => setPill(false)} />
                    </View>
                </Specimen>

                <Specimen number={50} name="Choice sheet" file="components/ui/ChoiceSheet.tsx" note="a few choices in the app's own sheet">
                    <AppButton label="Open choices" onPress={() => setChoices(true)} />
                </Specimen>

                <Specimen number={51} name="Time wheels" file="components/ui/TimeWheels.tsx">
                    <TimeWheels value={time} onChange={setTime} />
                </Specimen>

                <Specimen number={52} name="Date wheels" file="components/ui/DateWheels.tsx">
                    <DateWheels value={birthday} onChange={setBirthday} />
                </Specimen>

                <Specimen number={53} name="Step slider" file="components/ui/StepSlider.tsx" note="drag or tap; a tick at each step">
                    <Variant letter="a" label="Slider"><StepSlider label="Length" values={[3, 7, 14] as const} value={days} onChange={setDays} say={value => `${value} days`} /></Variant>
                    <Variant letter="b" label="Compact"><StepSlider compact label="Importance" values={[3, 7, 14] as const} value={days} onChange={setDays} say={value => `${value}`} /></Variant>
                </Specimen>

                <Specimen number={54} name="Hold button" file="components/ui/HoldButton.tsx" note="touch and hold to confirm">
                    <HoldButton label="Hold to stake 25 Shards" icon="flash" onComplete={() => setReceipt(true)} />
                </Specimen>

                <Specimen number={55} name="Menu" file="components/ui/MorphMenu.tsx" note="the ⋯ grows into the menu">
                    <MorphMenu title="Morning run" titleIcon="flame" items={[
                        { label: 'Edit', icon: 'create-outline', onPress: () => undefined },
                        { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => undefined },
                    ]} />
                </Specimen>

                <Specimen number={56} name="Settings rows" file="components/ui/SettingsList.tsx">
                    <SettingsGroup title="Focus">
                        <SettingsRow icon="timer" color={t.color.cobalt} label="Clock" choices={[{ id: 'ring', label: 'Ring' }, { id: 'digits', label: 'Digits' }]} chosen="ring" onChoose={() => undefined} />
                        <SettingsRow icon="hand-left" color={t.color.danger} label="Block apps" toggle={on} onToggle={setOn} />
                        <SettingsRow icon="musical-notes" color={t.color.success} label="Sound" value="Rain" onPress={() => undefined} />
                    </SettingsGroup>
                </Specimen>

                <Specimen number={57} name="Page dots" file="components/ui/PageDots.tsx" note="pages you swipe between (Community)">
                    <PageDots progress={dots} current={dot} labels={['Accountability', 'Challenges']} fresh={[false, true]}
                        onPick={index => { setDot(index); dots.set(index); }} />
                </Specimen>

                <Specimen number={58} name="Microphone" file="components/ui/MicButton.tsx">
                    <MicButton listening={listening} onPress={() => setListening(value => !value)} />
                </Specimen>

                <Specimen number={59} name="Focus pill" file="components/ui/FocusPill.tsx">
                    <Variant letter="a" label="Pill"><FocusPill color={t.color.accent} label="25 min" onPress={() => undefined} /></Variant>
                    <Variant letter="b" label="Compact"><FocusPill color={t.color.accent} label="25 min" compact onPress={() => undefined} /></Variant>
                </Specimen>

                <Specimen number={60} name="Typing placeholder" file="components/ui/TypingPlaceholder.tsx" note="examples typed out in an empty field">
                    <TypingPlaceholder examples={['Read 10 pages', 'Call mum on Sunday', 'Run 5 km']}>
                        {placeholder => <MatteInput placeholder={placeholder} value="" onChangeText={() => undefined} />}
                    </TypingPlaceholder>
                </Specimen>

                {/* ───────────────────────── Community and games ───────────────────────── */}
                <CatalogSection title="Community and games" description="Posts, contests, receipts and the pieces they are made of." />

                <Specimen number={61} name="Bar in pieces" file="components/ui/SegmentBar.tsx">
                    <SegmentBar done={3} total={5} />
                </Specimen>

                <Specimen number={62} name="Versus bar" file="components/ui/VersusBar.tsx" note="a tug of war">
                    <VersusBar left={{ label: 'You', percent: 72, color: t.color.cobalt }} right={{ label: 'Sam', percent: 58, color: t.color.silver }} />
                </Specimen>

                <Specimen number={63} name="Game card" file="components/ui/GameCard.tsx">
                    <GameCard lead={<Avatar name="Sam" size={t.space['4xl']} />} title="Cold shower, with Sam" subtitle="Day 3 of 14 · 500 Shards" badge={{ label: 'Live', tone: 'cobalt', dot: true }}>
                        <VersusBar left={{ label: 'You', percent: 72, color: t.color.cobalt }} right={{ label: 'Sam', percent: 58, color: t.color.silver }} />
                    </GameCard>
                </Specimen>

                <Specimen number={64} name="Card rail" file="components/ui/CardRail.tsx" note="swipe through cards">
                    <CardRail>
                        {['Read 24 books', 'Run a marathon', 'Learn Spanish'].map(title => (
                            <GameCard key={title} lead={<IconTile icon="flag" color={t.color.accent} />} title={title} subtitle="Open to bets" />
                        ))}
                    </CardRail>
                </Specimen>

                <Specimen number={65} name="Post" file="components/ui/PostCard.tsx" note="one post in the feed">
                    <PostCard lead={<Avatar name="Sam" size={t.space['4xl']} />} name="Sam" rank={2} kind={{ icon: 'calendar', label: 'Daily' }} when="Yesterday 9:00 PM" score={0.6}
                        hero={<Text variant="title">3 of 5 done</Text>} stats={[{ icon: 'flame', value: '2', label: 'day streak' }, { icon: 'flag', value: '1', label: 'goal' }]}>
                        <SegmentBar done={3} total={5} />
                    </PostCard>
                </Specimen>

                <Specimen number={66} name="Receipt" file="components/ui/Receipt.tsx" note="after spending Shards">
                    <AppButton label="Show a receipt" onPress={() => setReceipt(true)} />
                </Specimen>

                <Specimen number={67} name="Pop-up card" file="components/ui/PopupCard.tsx">
                    <AppButton label="Open pop-up" onPress={() => setPopup(true)} />
                </Specimen>

                <Specimen number={68} name="Level tags" file="components/ui/LevelTags.tsx" note="urgent, hard, easy">
                    <LevelTags priority={1} difficulty={3} />
                    <LevelTags priority={3} difficulty={1} />
                </Specimen>

                <Specimen number={69} name="List row motion" file="components/ui/Motion.tsx" note="ListItem: adding, removing and reordering fade and slide">
                    {rows.map((row, index) => (
                        <ListItem key={row} index={index}>
                            <VoidCard><View style={styles.swipeBody}><Text>{row}</Text></View></VoidCard>
                        </ListItem>
                    ))}
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}><AppButton label="Shuffle" icon="shuffle" onPress={() => setRows(list => [...list.slice(1), list[0]])} /></View>
                        <View style={{ flex: 1 }}><AppButton label={rows.length > 2 ? 'Remove' : 'Add'} icon={rows.length > 2 ? 'remove' : 'add'}
                            onPress={() => setRows(list => (list.length > 2 ? list.slice(0, -1) : [...list, 'Deep work']))} /></View>
                    </View>
                </Specimen>

                {/* ───────────────────────── Moments ───────────────────────── */}
                <CatalogSection title="Moments" description="Echo, celebrations and the edges of the screen." />

                <Specimen number={70} name="Echo" file="components/ui/Echo.tsx" note="the guide's light">
                    <View style={[styles.row, { height: t.space['4xl'] * 4, justifyContent: 'space-around' }]}>
                        <Echo size="small" mood="speak" />
                        <Echo size="small" mood="celebrate" />
                    </View>
                </Specimen>

                <Specimen number={71} name="Confetti" file="components/ui/Confetti.tsx" note="once, for a perfect day">
                    <AppButton label="Throw confetti" icon="sparkles" onPress={() => setConfetti(value => value + 1)} />
                </Specimen>

                <Specimen number={72} name="Red edge" file="components/ui/DemonEdge.tsx" note="the screen's edge when something is badly behind">
                    <View style={{ height: t.space['4xl'] * 3, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.color.surface }}>
                        <DemonEdge on={demon} />
                    </View>
                    <Toggle label="Show it" value={demon} onChange={setDemon} />
                </Specimen>

                <Specimen number={73} name="Bottom fade" file="components/ui/BottomFade.tsx" note="where a list runs under the tab bar">
                    <View style={{ height: t.space['4xl'] * 3, borderRadius: t.radius.lg, overflow: 'hidden', backgroundColor: t.color.accent }}>
                        <BottomFade height={t.space['4xl'] * 2} />
                    </View>
                </Specimen>
            </ScrollView>

            {confetti ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}><Confetti key={confetti} colors={[t.color.accent, t.color.success, t.color.cobalt, t.color.textPrimary]} /></View> : null}
            <ChoiceSheet visible={choices} onClose={() => setChoices(false)} title="Morning run" caption="What should happen?" choices={[
                { label: 'Edit', icon: 'create-outline', onPress: () => undefined },
                { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => undefined },
            ]} />
            <PopupCard visible={popup} onClose={() => setPopup(false)} icon="trophy" iconColor={t.color.accent} title="Seven in a row" body="A week of perfect days. Your Marks now count double." />
            {receipt ? <Receipt title="Bet on Sam" amount={-25} line="Staked until Friday" onDone={() => setReceipt(false)} /> : null}
            {ceremony ? <GoalCompleteSequence key={ceremony} goal={{ name: 'Read 24 books', color: t.color.accent, icon: 'book', count: 3 }} onDone={() => setCeremony(0)} /> : null}
            <VoidModal visible={modal} onClose={() => setModal(false)}>
                <View style={{ gap: t.space.md }}>
                    <Text variant="title">Centred window</Text>
                    <Text tone="muted">Used for short questions and confirmations.</Text>
                    <AppButton label="Close" onPress={() => setModal(false)} />
                </View>
            </VoidModal>

            <VoidSheet visible={sheet} onClose={() => setSheet(false)} title="Bottom sheet" caption="Morning run"
                footer={<View style={styles.sheetBody}><AppButton label="Done" onPress={() => setSheet(false)} /></View>}>
                <View style={styles.sheetBody}>
                    <AppTextField label="Name" value={text} onChangeText={setText} placeholder="Type here: the sheet rides up over the keyboard" />
                    <Toggle label="Daily reminder" value={on} onChange={setOn} />
                </View>
            </VoidSheet>
        </SheetScreen>
    );
}

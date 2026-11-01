import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { AbyssEmblem } from '@/components/UpcomingUpdate/AbyssEmblem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { READABLE_WIDTH, useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing, Typography } from '@/theme/designSystem';

const KAIROS = [
    ['Vanta', 'Silver eyes in the dark. Silent. Intimidating.'],
    ['Cinder', 'Molten cracks and tiny embers of excitement.'],
    ['Veil', 'Violet mist, always disappearing and reforming.'],
    ['Static', 'Cyan fissures. Easily startled. Occasionally elsewhere.'],
    ['Halo', 'A white ring. Calm, elegant, slightly arrogant.'],
    ['Rift', 'Two halves, held together by violet energy.'],
    ['Gilt', 'Gold seams and carefully calculated movements.'],
    ['Drift', 'A blue teardrop that floats sideways through ripples.'],
    ['Thorn', 'An obsidian crown. Green eyes. Unimpressed.'],
    ['Pulse', 'A crimson core that races with the competition.'],
    ['Null', 'A white outline. The eyes arrive first.'],
    ['Prism', 'Black glass that catches unexpected colors.'],
    ['Frost', 'Icy eyes and a trail of frozen particles.'],
    ['Mirage', 'A violet silhouette followed by its own double.'],
    ['Orbit', 'Three tiny satellites. Endlessly curious.'],
    ['Hush', 'A long shadow with watchful, half-closed eyes.'],
    ['Fray', 'Dark ribbons, forever unravelling and reconnecting.'],
    ['Zenith', 'A tall silhouette, illuminated from within.'],
    ['Morrow', 'Black-glass armor, amber eyes, rotating segments.'],
    ['Paradox', 'Mismatched eyes. A ring turning the wrong way.'],
] as const;

const SOCIAL = [
    { icon: 'eye-off', title: 'Secret missions', body: 'Echo devises unexpected assignments around shared goals. Complete them, earn Marks, and await the reveal.' },
    { icon: 'trending-up', title: 'Friendly stakes', body: 'Wager virtual Marks on agreed, measurable outcomes. A little rivalry, with no real money involved.' },
    { icon: 'trophy', title: 'King of the Week', body: 'A rotating crown, weekly rivalries, and a little well-earned swagger for your Kairo.' },
    { icon: 'people', title: 'Personalities collide', body: 'Kairos celebrate, exchange knowing looks, and synchronize their time-rings when a crew succeeds.' },
];

export default function UpcomingUpdate() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { foreground } = useAccentGradient();
    const { horizontalPadding } = useResponsiveLayout();
    const { selectionFeedback } = useHaptics();
    const [showKairos, setShowKairos] = useState(false);
    const heading = [styles.heading, { color: colors.textPrimary }];
    const body = [styles.body, { color: colors.textSecondary }];
    const label = [styles.label, { color: foreground }];

    return (
        <SheetScreen title="The next chapter" onBack={() => router.canGoBack() ? router.back() : router.replace('/(root)/(tabs)/settings')}>
            <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <Text style={label}>An upcoming Habyss update</Text>
                    <AbyssEmblem accent={foreground} />
                    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Something is stirring{ '\n' }in the Abyss.</Text>
                    <Text style={[body, styles.center]}>A world shaped by your actions. A companion who knows your story. A little conspiracy among friends.</Text>
                    <Text style={[styles.quote, { color: colors.textPrimary }]}>Chronos is the time you’re given.{ '\n' }Kairo is what you make of it.</Text>
                </View>

                <View style={styles.section}>
                    <Text accessibilityRole="header" style={heading}>Your journey out of the Abyss</Text>
                    <Text style={body}>The Abyss is a world of distractions, lost time, and unrealized potential. Every meaningful action is a way upward. The next chapter brings that journey to life.</Text>
                    <Text style={[styles.note, { color: colors.textSecondary }]}>A first look at what we’re building. These features are in development; designs and details may change. No release date announced yet.</Text>
                </View>

                <VoidCard style={styles.card}>
                    <AppIcon name="planet" size={28} color={foreground} />
                    <Text style={label}>Kairo · Your will made visible</Text>
                    <Text accessibilityRole="header" style={heading}>A presence that’s yours.</Text>
                    <Text style={body}>Meet your personal character: obsidian, glowing eyes, and a fractured ring of time. Your Kairo will take the place of a conventional profile picture, with its own silhouette, personality, and reactions.</Text>
                    <Text style={body}>Achievements and shared experiences will unlock new ways to express yourself. Your Kairo represents your identity, not your productivity score. Struggling won’t make it less worthy.</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showKairos }} accessibilityLabel={showKairos ? 'Hide the 20 Kairo personalities' : 'Explore the 20 Kairo personalities'} activeOpacity={0.65}
                        onPress={() => { selectionFeedback(); setShowKairos(!showKairos); }} style={[styles.disclosure, { borderTopColor: colors.border }]}>
                        <Text style={[styles.action, { color: foreground }]}>{showKairos ? 'Close the Kairo collection' : 'Meet the 20 personalities'}</Text>
                        <AppIcon name={showKairos ? 'chevron-up' : 'chevron-down'} size={18} color={foreground} />
                    </TouchableOpacity>
                    {showKairos && <View style={styles.roster}>
                        <Text style={[styles.note, { color: colors.textSecondary }]}>An early glimpse. Final appearances and how you’ll discover each Kairo are still taking shape.</Text>
                        {KAIROS.map(([name, description]) => <View key={name} style={styles.variant}>
                            <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
                            <Text style={body}>{description}</Text>
                        </View>)}
                    </View>}
                </VoidCard>

                <View style={styles.section}>
                    <View style={styles.featureHeading}><AppIcon name="sparkles" size={24} color={foreground} /><Text accessibilityRole="header" style={heading}>Echo, your inner voice</Text></View>
                    <Text style={body}>A silver-white fragment of light with a sharp mind. Echo will guide your first steps, remember context you share, and help you understand what moves you forward.</Text>
                    <Text style={body}>Expect thoughtful coaching, personalized missions, and the occasional perfectly timed sarcastic remark.</Text>
                    <View style={[styles.aside, { borderLeftColor: foreground }]}>
                        <Text style={[styles.quoteSmall, { color: colors.textPrimary }]}>“An elaborate plot to help you finish something. How sinister.”</Text>
                        <Text style={[styles.note, { color: colors.textSecondary }]}>A taste of Echo</Text>
                    </View>
                </View>

                <VoidCard style={styles.card}>
                    <AppIcon name="eye-off" size={28} color={foreground} />
                    <Text style={label}>Introducing the Conspiracy</Text>
                    <Text accessibilityRole="header" style={heading}>Your friends are up to something good.</Text>
                    <Text style={body}>With everyone opted in, Echo secretly brings friends together to help someone make progress on a voluntarily shared goal.</Text>
                    {[
                        ['The invitation', 'One friend invites you to a focus session.'],
                        ['The quiet assist', 'Another offers to review the project you’ve been putting off.'],
                        ['The reveal', 'You make progress. Echo reveals the plot, and your accomplices earn Marks.'],
                    ].map(([title, description], index) => <View key={title} style={styles.step}>
                        <Text style={[styles.stepNumber, { color: foreground }]}>{index + 1}</Text>
                        <View style={styles.stepText}><Text style={[styles.name, { color: colors.textPrimary }]}>{title}</Text><Text style={body}>{description}</Text></View>
                    </View>)}
                    <Text style={[styles.note, { color: colors.textSecondary }]}>An example of the planned experience. Participation will be opt-in, with clear boundaries around what you share.</Text>
                </VoidCard>

                <View style={styles.section}>
                    <Text accessibilityRole="header" style={heading}>More than watching streaks</Text>
                    {SOCIAL.map(item => <View key={item.title} style={styles.feature}>
                        <AppIcon name={item.icon} size={22} color={foreground} />
                        <View style={styles.stepText}><Text style={[styles.name, { color: colors.textPrimary }]}>{item.title}</Text><Text style={body}>{item.body}</Text></View>
                    </View>)}
                </View>

                <View style={styles.section}>
                    <Text accessibilityRole="header" style={heading}>Two currencies. Different meanings.</Text>
                    <Text style={body}>In the upcoming chapter, Marks and Shards will have distinct roles.</Text>
                    <VoidCard style={styles.card}>
                        <View style={styles.featureHeading}><AppIcon name="medal" size={26} color={colors.textPrimary} /><Text style={[styles.name, { color: colors.textPrimary }]}>Marks · The stakes you share</Text></View>
                        <Text style={body}>Blackened metal, an engraved insignia. Earn and spend Marks through accomplishments, friend competitions, secret missions, and virtual bets.</Text>
                    </VoidCard>
                    <VoidCard style={styles.card}>
                        <View style={styles.featureHeading}><AppIcon name="diamond" size={26} color={foreground} /><Text style={[styles.name, { color: colors.textPrimary }]}>Shards · Time reclaimed</Text></View>
                        <Text style={body}>Rare fragments of smoky glass, lit from within. Reclaim them through meaningful progress to customize your Kairo, uncover the Abyss, and restore a mysterious broken clock.</Text>
                    </VoidCard>
                    <Text style={[styles.note, { color: colors.textSecondary }]}>This describes the planned economy, not today’s rules. Earning rates, unlocks, and transition details are still being worked out.</Text>
                </View>

                <View style={[styles.ending, { borderTopColor: colors.border }]}>
                    <AppIcon name="time" size={28} color={foreground} />
                    <Text style={label}>Chronos is waiting.</Text>
                    <Text style={[body, styles.center]}>The Keeper of Time never stops the clock. But time doesn’t disappear in the Abyss. It fractures.</Text>
                    <Text style={[styles.quote, { color: colors.textPrimary }]}>What will you reclaim?</Text>
                    <Text style={[styles.note, styles.center, { color: colors.textSecondary }]}>A new beginning with Echo. A Kairo of your own. A world you’ll discover through doing.</Text>
                </View>
            </ScrollView>
        </SheetScreen>
    );
}

const styles = StyleSheet.create({
    content: { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.bottom, gap: Spacing.section },
    hero: { alignItems: 'center', gap: Spacing.lg },
    title: { ...Typography.screenTitle, textAlign: 'center' },
    heading: { ...Typography.title, flexShrink: 1 },
    body: { ...Typography.body, fontSize: 16, lineHeight: 25 },
    label: { ...Typography.bodySmall, fontFamily: FontFamily.medium },
    center: { textAlign: 'center' },
    quote: { ...Typography.heading, textAlign: 'center', marginTop: Spacing.sm },
    quoteSmall: { ...Typography.heading },
    section: { gap: Spacing.lg },
    card: { padding: Spacing.xl, gap: Spacing.lg },
    note: { ...Typography.bodySmall },
    name: { ...Typography.heading, flexShrink: 1 },
    featureHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    feature: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start', paddingVertical: Spacing.xs },
    aside: { borderLeftWidth: 2, paddingLeft: Spacing.lg, gap: Spacing.sm },
    step: { flexDirection: 'row', gap: Spacing.md },
    stepNumber: { ...Typography.heading, minWidth: 20 },
    stepText: { flex: 1, gap: Spacing.xs },
    disclosure: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    action: { ...Typography.button, flex: 1 },
    roster: { gap: Spacing.xl },
    variant: { gap: Spacing.xs },
    ending: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.section, gap: Spacing.lg },
});

import { StyleSheet } from 'react-native';
import { FontFamily, Typography, UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/(tabs)/community.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
    headerTitle: Typography.screenTitle,
    headerSubtitle: Typography.label,
    sectionLabel: UIStyles.sectionTitle,
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        fontFamily: FontFamily.regular,
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLarge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    username: {
        fontSize: 13,
        fontFamily: FontFamily.semibold,
    },
    email: {
        fontSize: 11,
        fontFamily: FontFamily.regular,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    actionBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendName: {
        fontSize: 14,
        fontFamily: FontFamily.bold,
        marginBottom: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 10,
        fontFamily: FontFamily.regular,
    },
    progressDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    nudgeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    nudgeText: {
        fontSize: 9,
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
    },
    emptyText: {
        fontSize: 14,
        marginTop: 12,
        fontFamily: FontFamily.semibold,
    },
    emptySubtext: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: FontFamily.regular,
    },
    feed: { gap: 10, marginTop: 6 },
    feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
    feedTitle: { fontSize: 13, letterSpacing: 1.5, fontFamily: FontFamily.bold },
    feedSummary: { fontSize: 12, fontFamily: FontFamily.regular, flexShrink: 1, textAlign: 'right' },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10, // Tighter
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rankText: {
        fontSize: 14,
        width: 24,
        textAlign: 'center',
        fontFamily: FontFamily.bold,
    },
    leaderName: {
        flex: 1,
        fontSize: 13,
        marginLeft: 12,
        fontFamily: FontFamily.semibold,
    },
    leaderStreak: {
        fontSize: 13,
        marginLeft: 4,
        fontFamily: FontFamily.regular,
    },
});

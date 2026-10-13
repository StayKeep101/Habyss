import { Dimensions, StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/DesignSystem';

const { height, width } = Dimensions.get('window');

/** The look of app/(root)/goal-detail.tsx. Values are exactly what the screen used. */
export const styles = StyleSheet.create({
  heroClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  navHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 50,
  },
  blurBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center'
  },
  heroOverlay: {
    position: 'absolute',
    top: 88,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  heroContent: {
    paddingHorizontal: 24,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  heroEyebrowText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: FontFamily.semibold,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: '88%',
    fontFamily: FontFamily.regular,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  heroStatPill: {
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: FontFamily.medium,
  },
  panelWrap: {
    marginTop: 20,
    // The picture is no longer dimmed, so the panel has to separate itself
    // from it the way a real card would — by casting onto it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 16,
  },
  contentContainer: {
    minHeight: height,
    // backgroundColor set inline; the cap above draws the rounded top edge.
    paddingTop: 8,
  },
  progressBadgeContainer: {
    // Sits inside the dome, sharing its centre. Above the panel, so the ends
    // of the arc rest on its edge instead of being cut off by it.
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    elevation: 2,
  },
  goalTitle: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.5,
  },
  dashboardLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    marginBottom: 8,
    fontFamily: FontFamily.medium,
  },
  goalTarget: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  daysTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  daysTagText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },
  goalDescription: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 22,
  },
  dashboardCard: {
    width: (width - 52) / 2,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 22,
  },
  dashboardCardLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontFamily: FontFamily.medium,
  },
  dashboardCardValue: {
    fontSize: 28,
    marginTop: 8,
    fontFamily: FontFamily.bold,
  },
  dashboardCardHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
    fontFamily: FontFamily.regular,
  },
  miniActionBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 30,
    gap: 12,
  },
  tab: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'transparent'
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FontFamily.semibold,
  },
  todayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayDate: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 2 },
  todayCount: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  todayCountText: { fontSize: 12, fontFamily: FontFamily.semibold },
  restDay: { alignItems: 'center', paddingVertical: 26, gap: 6 },
  restTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
  restBody: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular, textAlign: 'center', paddingHorizontal: 12 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  addPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed' },
  addText: { fontSize: 13, fontFamily: FontFamily.medium },
  floatingRow: { position: 'absolute', left: 20, right: 20 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  swapped: { paddingBottom: 8 },
  mainPanel: {
    margin: 20,
    marginTop: 18,
    padding: 20,
    borderRadius: 26,
  },
  addBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  }
});

import { StyleSheet } from 'react-native';
import { Radius } from '@/theme/designSystem';
import { s } from '@/theme/scale';
import { GLASS_HEIGHT } from '@/components/Home/DayHourglass';

/**
 * Where Home's sheet starts below the fixed header: low enough that the day's
 * hourglass (half above the sheet's edge) clears the header with room to
 * breathe. From the screen's width, like the glass.
 */
export const SHEET_TOP = GLASS_HEIGHT / 2 + s(28);

/** The status bar and the header above the sheet: how far down the rank's light reaches before the sheet starts. */
export const HOME_BACKDROP = s(170);

/** The look of app/(root)/(tabs)/home.tsx's sheet. */
export const homeSheet = StyleSheet.create({
    // A raised sheet in the app's sheet material, sliding beneath the fixed header.
    sheet: {
        flexGrow: 1, minHeight: '100%', borderTopLeftRadius: Radius.sheet * 1.5, borderTopRightRadius: Radius.sheet * 1.5,
        borderTopWidth: StyleSheet.hairlineWidth, overflow: 'visible',
    },
    material: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: Radius.sheet * 1.5, borderTopRightRadius: Radius.sheet * 1.5 },
});

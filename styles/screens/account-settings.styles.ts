import { StyleSheet } from 'react-native';
import { Radius, Spacing } from '@/theme/designSystem';

/** The look of app/(root)/account-settings.tsx. */
const PHOTO = Spacing.section * 3;
export const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, gap: Spacing.xl, paddingTop: Spacing.md },
    photoWrap: { alignSelf: 'center' },
    photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    photoImage: { width: '100%', height: '100%' },
    camera: { position: 'absolute', right: 0, bottom: 0, width: Spacing.section, height: Spacing.section, borderRadius: Radius.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    fields: { gap: Spacing.md },
    floating: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: 0 },
    sheetBody: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.md },
    sheetFoot: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});

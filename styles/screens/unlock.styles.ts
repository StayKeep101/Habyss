import { StyleSheet } from 'react-native';
import { UIStyles } from '@/theme/designSystem';

/** The look of app/(root)/unlock.tsx (Earn your scroll: an hour for Shards). Spacing comes from tokens in the page. */
export const styles = StyleSheet.create({
    content: { ...UIStyles.screenContent },
    row: { flexDirection: 'row', alignItems: 'center' },
    title: { flex: 1 },
});

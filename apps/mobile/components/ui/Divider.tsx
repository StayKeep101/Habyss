import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTokens } from '@/hooks/useTokens';

/** A hairline between things that belong to the same group. */
export function Divider({ inset = false }: { inset?: boolean }) {
    const t = useTokens();
    return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.color.border, marginLeft: inset ? t.space['3xl'] + t.space.lg : 0 }} />;
}

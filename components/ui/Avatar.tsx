import React from 'react';
import { Image, View } from 'react-native';
import { AppIcon } from '@/components/Common/AppIcon';
import { useTokens } from '@/hooks/useTokens';

/** A person's picture in a circle, or a quiet placeholder without one. */
export function Avatar({ uri, size }: { uri?: string | null; size: number }) {
    const t = useTokens();
    return (
        <View style={{ width: size, height: size, borderRadius: t.radius.full, overflow: 'hidden', backgroundColor: t.color.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} /> : <AppIcon name="person" size={size * 0.4} color={t.color.textMuted} />}
        </View>
    );
}

import React from 'react';
import { View } from 'react-native';
import { useTokens } from '@/hooks/useTokens';
import type { SpaceToken } from '@/constants/tokens';

export interface StackProps {
    children: React.ReactNode;
    /** Side by side, or one under another (the default). */
    direction?: 'row' | 'column';
    gap?: SpaceToken;
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
    justify?: 'start' | 'center' | 'end' | 'between';
    /** Take the remaining space in the parent. */
    grow?: boolean;
    wrap?: boolean;
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const;
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;

/** Lays things out in a row or a column with a token gap, so screens never hand-write layout. */
export function Stack({ children, direction = 'column', gap, align, justify, grow, wrap }: StackProps) {
    const t = useTokens();
    return (
        <View style={{
            flexDirection: direction,
            gap: gap ? t.space[gap] : undefined,
            alignItems: align ? ALIGN[align] : direction === 'row' ? 'center' : undefined,
            justifyContent: justify ? JUSTIFY[justify] : undefined,
            flex: grow ? 1 : undefined,
            flexShrink: grow ? 1 : undefined,
            flexWrap: wrap ? 'wrap' : undefined,
        }}>
            {children}
        </View>
    );
}

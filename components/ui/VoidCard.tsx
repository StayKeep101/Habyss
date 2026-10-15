import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { Radius } from '@/theme/designSystem';
import { MatteSurface } from './MatteSurface';

interface VoidCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Kept so older screens still compile; every card is matte now. */
    glass?: boolean;
    /** Kept so older screens still compile; there is no blur any more. */
    intensity?: number;
    /** Kept so older screens still compile; every card is matte now. */
    matte?: boolean;
}

/**
 * The card: the matte surface (see MatteSurface) at card size — gradient,
 * one light edge, a soft shadow, large corners. One card for the whole app.
 */
export const VoidCard: React.FC<VoidCardProps> = ({ children, style }) => (
    <MatteSurface radius={Radius.card} style={style}>{children}</MatteSurface>
);

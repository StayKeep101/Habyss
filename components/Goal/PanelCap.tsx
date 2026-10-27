import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
    width: number;
    /** How far the dome rises above the panel's flat edge. */
    bump: number;
    corner: number;
    color: string;
    border: string;
}

/**
 * The top edge of the goal page's panel, with a dome in the middle.
 *
 * The progress arc used to float over the cover photo, so the photo showed
 * through the gap inside it. The panel now rises to meet the arc: one shape,
 * filled with the page's own background, with the arc sitting in the dome.
 * Every turn in the edge is a curve: the corners, and where the dome rises.
 */
export const PanelCap: React.FC<Props> = ({ width, bump, corner, color, border }) => {
    const height = bump + corner;
    const centre = width / 2;
    const edge = bump; // y of the flat part of the top edge

    // Where the flat edge meets the dome, a small curve turns one into the
    // other, so there is no corner there: a circle of radius `fillet` resting
    // on the edge and touching the dome. The dome itself stays a true circle,
    // so the progress arc inside it stays concentric.
    const fillet = Math.round(bump * 0.42);
    const reach = Math.sqrt((bump + fillet) ** 2 - fillet ** 2);
    const touchX = (reach * bump) / (bump + fillet);
    const touchY = edge - (fillet * bump) / (bump + fillet);
    const round = (n: number) => n.toFixed(2);

    const edgePath = ` M 0 ${edge + corner}`
        + ` A ${corner} ${corner} 0 0 1 ${corner} ${edge}`
        + ` L ${round(centre - reach)} ${edge}`
        + ` A ${fillet} ${fillet} 0 0 0 ${round(centre - touchX)} ${round(touchY)}`
        + ` A ${bump} ${bump} 0 0 1 ${round(centre + touchX)} ${round(touchY)}`
        + ` A ${fillet} ${fillet} 0 0 0 ${round(centre + reach)} ${edge}`
        + ` L ${width - corner} ${edge}`
        + ` A ${corner} ${corner} 0 0 1 ${width} ${edge + corner}`;
    const top = `M 0 ${height}${edgePath.replace(' M 0', ' L 0')} L ${width} ${height} Z`;

    return (
        <Svg width={width} height={height} style={styles.cap} pointerEvents="none">
            <Path d={top} fill={color} />
            {/* The edge as a faint hairline: there, but never a hard line against the photo. */}
            <Path d={edgePath} fill="none" stroke={border} strokeOpacity={0.5} strokeWidth={1} />
        </Svg>
    );
};

const styles = StyleSheet.create({
    cap: { position: 'absolute', top: 0, left: 0 },
});

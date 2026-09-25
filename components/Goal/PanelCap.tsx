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
 */
export const PanelCap: React.FC<Props> = ({ width, bump, corner, color, border }) => {
    const height = bump + corner;
    const centre = width / 2;
    const edge = bump; // y of the flat part of the top edge

    // Left corner, across to the dome, over it, across to the right corner.
    const top = `M 0 ${height}`
        + ` L 0 ${edge + corner}`
        + ` Q 0 ${edge} ${corner} ${edge}`
        + ` L ${centre - bump} ${edge}`
        + ` A ${bump} ${bump} 0 0 1 ${centre + bump} ${edge}`
        + ` L ${width - corner} ${edge}`
        + ` Q ${width} ${edge} ${width} ${edge + corner}`
        + ` L ${width} ${height} Z`;

    // The same edge again as a hairline, for the separation from the photo.
    const outline = `M 0 ${edge + corner}`
        + ` Q 0 ${edge} ${corner} ${edge}`
        + ` L ${centre - bump} ${edge}`
        + ` A ${bump} ${bump} 0 0 1 ${centre + bump} ${edge}`
        + ` L ${width - corner} ${edge}`
        + ` Q ${width} ${edge} ${width} ${edge + corner}`;

    return (
        <Svg width={width} height={height} style={styles.cap} pointerEvents="none">
            <Path d={top} fill={color} />
            <Path d={outline} fill="none" stroke={border} strokeWidth={1} />
        </Svg>
    );
};

const styles = StyleSheet.create({
    cap: { position: 'absolute', top: 0, left: 0 },
});

/**
 * The building blocks every screen is made of — the app's own look, gathered
 * in one place. Import from '@/components/ui'.
 *
 * Layout and surfaces
 *   VoidShell      a tab page's background and safe area
 *   SheetScreen    a pushed page with its header (title, back)
 *   ModalHeader    the header of a modal or sheet
 *   VoidCard       the card: glass, plain or matte
 *   SheetSection   a titled group inside a sheet
 *   VoidModal      a centred modal window
 *   VoidSheet      a bottom sheet with a grabber
 *
 * Controls
 *   AppButton, IconButton, AppTextField, Segmented, ChipPicker, Toggle,
 *   TimeRow, Wheel, ViewSwitcher, SwipeRow
 *
 * Content
 *   AppIcon (the only way to draw an icon), Text, Badge, Divider, EmptyState,
 *   StatTile, ChartCard, HabitRow, ProgressRing, HalfCircleProgress, CheckPop
 *
 * Motion (how charts, bars and numbers move — use these, never a still bar)
 *   AnimatedFill   a bar's fill that grows in and slides to new values
 *   GrowBar        an SVG chart bar that grows up from its floor
 *   Reveal         draws a line chart in from left to right
 *   PopIn          small pieces (heatmap cells) fading in one after another
 *   useProgress    a 0→value animated number to drive any style or SVG prop
 *   useCountUp     a figure as text that counts up and rolls to new values
 *   CountUp        the same, as a Text component
 *
 * Colours, fonts, corners and shadows come from theme/. Change a block here
 * and every screen that uses it changes with it.
 */
export { VoidShell } from './VoidShell';
export { SheetScreen } from './SheetScreen';
export { ModalHeader } from './ModalHeader';
export { VoidCard } from './VoidCard';
export { SheetSection } from './SheetSection';
export { VoidModal } from './VoidModal';
export { VoidSheet } from './VoidSheet';

export { AppButton } from './AppButton';
export { IconButton } from './IconButton';
export { AppTextField } from './AppTextField';
export { Segmented } from './Segmented';
export { ChipPicker } from './ChipPicker';
export { Toggle, type ToggleProps } from './Toggle';
export { TimeRow } from './TimeRow';
export { Wheel } from './Wheel';
export { ViewSwitcher } from './ViewSwitcher';
export { SwipeRow } from './SwipeRow';

export { AppIcon, type IconName } from './AppIcon';
export { Text, type UITextProps, type TextTone } from './Text';
export { Badge, type BadgeProps } from './Badge';
export { Divider } from './Divider';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { StatTile, type StatTileProps } from './StatTile';
export { ChartCard, type ChartCardProps } from './ChartCard';
export { HabitRow, type HabitRowProps } from './HabitRow';
export { ProgressRing, type ProgressRingProps } from './ProgressRing';
export { HalfCircleProgress } from './HalfCircleProgress';
export { CheckPop } from './CheckPop';
export { MOTION, CountUp, AnimatedFill, GrowBar, Reveal, PopIn, useProgress, useCountUp, AnimatedRect, AnimatedCircle, AnimatedPath } from './Motion';

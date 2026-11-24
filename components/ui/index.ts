/**
 * The building blocks every screen is made of — the app's own look, gathered
 * in one place. Import from '@/components/ui'.
 *
 * Layout and surfaces
 *   VoidShell      a tab page's background and safe area
 *   SheetScreen    a pushed page with its header (title, back)
 *   ModalHeader    the header of a modal or sheet
 *   MatteSurface   the one matte surface (gradient, edge, shadow) every piece is drawn with
 *   VoidCard       the card (MatteSurface at card size)
 *   SheetSection   a titled group inside a sheet
 *   SectionTitle   the heading over a section: large, bold, sentence case (the Stats-tab look)
 *   VoidModal      a centred modal window
 *   VoidSheet      a bottom sheet with a grabber
 *   PopupCard      the streak-popup card: rises from the bottom, big icon on its top edge
 *   NotePopup      a few words in a PopupCard: a roomy box, Skip and Keep it (every "how did it go?")
 *   Overlay        a layer over the whole app (menus, celebrations) without a second window
 *
 * Controls
 *   AppButton, HoldButton (hold to mean it: fills, buzz builds, lands with a thud), IconButton, AppTextField, ChoiceRow, ChipPicker, Toggle,
 *   StepSlider (a value chosen by sliding: gradient fill, snaps you feel, VoiceOver adjustable),
 *   TimeRow, Wheel, TimeWheels (a clock time on wheels), DateWheels (a date on wheels), ViewSwitcher, IconToggle (a header's two-way switch), Ornament (the hourglass's line ✦ line, as a divider), PageDots (pages you swipe between), SwipeRow, TypingPlaceholder,
 *   MorphMenu (a ⋯ button that grows into its own menu), MicButton (talk instead of typing),
 *   FocusPill (the solid "Focus" pill on whatever is on right now)
 *   DemonEdge (the red glow round the screen in Echo's demon mode)
 *   ChoiceSheet (the app's own sheet of a few choices, or asking for a name, instead of the system's)
 *   DragDropProvider, Draggable, DropTarget (touch and hold to carry something onto a place that takes it)
 *   CoachLayer (the first-run tour across screens: one real control lit up, a line and an arrow)
 *
 * Content
 *   Echo (Echo, drawn: the one look it has everywhere, in a mood; a Rive Echo would replace this file),
 *   Avatar (a face: photo or initial, optional ring and badge), FaceStack (a few friends' faces, overlapping), IconTile (an icon on a solid tile of its colour), AppIcon (the only way to draw an icon), Text, Badge, Divider, EmptyState,
 *   StatTile, ChartCard, WeekBars (a week as bars: goal dashed across, a finger reads a day), HabitRow, ProgressRing, HalfCircleProgress, CheckPop, ShardIcon (a Shard, the currency, as its faceted crystal), IrisFade (covers a view from the outside in as something scrolls), StruckTitle (a name dimmed and struck through as it is done, the line drawing across),
 *   GameCard (a bet, duel or challenge: face, name, a pill for how it stands, then the contest),
 *   VersusBar (two sides on one line, "22% Long ━━ 78% Short": the split glides, the leader in full colour),
 *   CardRail (cards swiped side by side, the next peeking in),
 *   PhotoStory (photos one at a time, like a story), ShutterButton (the camera shutter, over the photo), AppIcons (a habit's chosen apps, by their own icons), PostCard (a Community post of any kind: face, name, rank, kind; one big figure; a visual; stats; details on demand),
 *   PeopleFilter (whose progress to show on something shared: all together, or one person, each in their own colour),
 *   LevelTags (how urgent and how hard a habit or task is, on its card: "Urgent · Hard"; nothing when ordinary),
 *   SegmentBar (a bar in pieces, one per thing to do, lit in cobalt as it arrives),
 *   StepTrack (steps along a line: rings that fill in the accent as each is done, the line lighting behind),
 *   Receipt (the moment something is paid for: a ring closes, the tick lands with haptics and sound, the amount counts in),
 *   Confetti (falls once from the top, for the biggest moments; none with Reduce Motion)
 *
 * Motion (how charts, bars and numbers move — use these, never a still bar)
 *   AnimatedFill   a bar's fill that grows in and slides to new values
 *   GrowBar        an SVG chart bar that grows up from its floor
 *   Reveal         draws a line chart in from left to right
 *   PopIn          small pieces (heatmap cells) fading in one after another
 *   useProgress    a 0→value animated number to drive any style or SVG prop
 *   useCountUp     a figure as text that counts up and rolls to new values
 *   CountUp        the same, as a Text component
 *   ListItem       a habit, task or goal row: fades in and out, slides when the list changes
 *   (every one takes `replay`: pass what a switch changed — month, range, tab — to replay the intro)
 *
 * Colours, fonts, corners and shadows come from theme/. Change a block here
 * and every screen that uses it changes with it.
 *
 * Apple's floor, built into these blocks (see CLAUDE.md): text 11 pt or more,
 * contrast 4.5:1, a 44 pt tap area (hitSlop where the drawing is smaller),
 * a VoiceOver label on every control, Reduce Motion respected.
 */
export { VoidShell } from './VoidShell';
export { SheetScreen } from './SheetScreen';
export { ModalHeader } from './ModalHeader';
export { VoidCard } from './VoidCard';
export { IconTile } from './IconTile';
export { Avatar } from './Avatar';
export { FaceStack, type Face } from './FaceStack';
export { Overlay } from './Overlay';
export { Echo, type EchoMood } from './Echo';
export { ChoicePill } from './ChoicePill';
export { SettingsGroup, SettingsRow } from './SettingsList';
export { MatteSurface } from './MatteSurface';
export { MatteInput } from './MatteInput';
export { SheetSection } from './SheetSection';
export { SectionTitle } from './SectionTitle';
export { VoidModal } from './VoidModal';
export { VoidSheet } from './VoidSheet';

export { AppButton } from './AppButton';
export { HoldButton } from './HoldButton';
export { StepSlider } from './StepSlider';
export { IconButton } from './IconButton';
export { FocusPill } from './FocusPill';
export { AppTextField } from './AppTextField';
export { ChoiceRow } from './ChoiceRow';
export { ChipPicker } from './ChipPicker';
export { Toggle, type ToggleProps } from './Toggle';
export { TimeRow } from './TimeRow';
export { Wheel } from './Wheel';
export { MorphMenu, type MorphMenuItem } from './MorphMenu';
export { MicButton } from './MicButton';
export { ViewSwitcher } from './ViewSwitcher';
export { IconToggle } from './IconToggle';
export { Ornament } from './Ornament';
export { PageDots } from './PageDots';
export { SwipeRow } from './SwipeRow';
export { TypingPlaceholder } from './TypingPlaceholder';

export { AppIcon, type IconName } from './AppIcon';
export { Text, type UITextProps, type TextTone } from './Text';
export { Badge, type BadgeProps } from './Badge';
export { LevelTags } from './LevelTags';
export { PeopleFilter, type FilterPerson } from './PeopleFilter';
export { Divider } from './Divider';
export { GameCard } from './GameCard';
export { VersusBar, type VersusSide } from './VersusBar';
export { CardRail } from './CardRail';
export { PostCard, type PostStat } from './PostCard';
export { PhotoStory, type StoryPhoto } from './PhotoStory';
export { ShutterButton } from './ShutterButton';
export { AppIcons, appIconsSupported } from './AppIcons';
export { SegmentBar } from './SegmentBar';
export { StepTrack } from './StepTrack';
export { Receipt } from './Receipt';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { StatTile, type StatTileProps } from './StatTile';
export { WeekBars, type WeekBar } from './WeekBars';
export { ChartCard, type ChartCardProps } from './ChartCard';
export { HabitRow, type HabitRowProps } from './HabitRow';
export { ProgressRing, type ProgressRingProps } from './ProgressRing';
export { HalfCircleProgress } from './HalfCircleProgress';
export { CheckPop } from './CheckPop';
export { StruckTitle } from './StruckTitle';
export { MOTION, LIST_LAYOUT, ListItem, CountUp, AnimatedFill, GrowBar, Reveal, PopIn, useProgress, useCountUp, AnimatedRect, AnimatedCircle, AnimatedPath } from './Motion';
export { TimeWheels } from './TimeWheels';
export { DateWheels } from './DateWheels';
export { PopupCard } from './PopupCard';
export { NotePopup } from './NotePopup';
export { DemonEdge } from './DemonEdge';
export { DragDropProvider, Draggable, DropTarget } from './DragDrop';
export { ChoiceSheet, type Choice } from './ChoiceSheet';
export { CoachLayer } from './CoachMarks';
export { Confetti } from './Confetti';
export { ShardIcon } from './ShardIcon';
export { IrisFade } from './IrisFade';

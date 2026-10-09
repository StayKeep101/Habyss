# Habyss UI audit

Phase 1 of the design-system work: a read-only scan of `app/` and `components/` (135 source files, tests excluded), taken on 2026-10-09. Nothing in the app was changed to produce it. Counts are literal occurrences in source.

## Stack

- **Framework:** Expo SDK 57, React Native 0.86, React 19, Expo Router (file-based routes in `app/`), Reanimated 4.
- **Styling:** `StyleSheet.create` plus inline style objects. NativeWind/Tailwind is installed and configured (`tailwind.config.js`, `global.css`) but effectively unused: one `className` in the whole app (`app/_layout.tsx`).
- **Existing design files:**
  - `constants/Colors.ts`: per-theme palette (`light`, `abyss`, `trueDark`) with role names such as `textPrimary`, `border`, `success`.
  - `constants/DesignSystem.ts`: `FontFamily`, `Spacing`, `Radius`, `Control`, `Typography`, `Surfaces`, `Elevation`, `UIStyles`.
  - `constants/Layout.ts`: `s()`, `vs()`, `ms()` screen-scaling helpers.
  - `constants/AccentContext.tsx`: the user-chosen accent (`primary`, `foreground`, gradients).
- **Folders:** screens in `app/(root)/` and `app/(auth)/`; components grouped by feature in `components/` (`Home`, `Goal`, `Habit`, `Create`, `Community`, `Roadmap`, `Marks`, `Layout`, `Common`, and others). There is no `components/ui` primitives folder.

## Worst inconsistencies

1. **Tokens exist but most screens bypass them.** `Typography` is used in only 12 files; everywhere else text is styled by hand as `fontSize` plus `FontFamily` (52 distinct font-size expressions). `Spacing` and `Radius` are almost never referenced; raw numbers are used instead (87 distinct padding values, 82 radius values).
2. **Inline styles everywhere: 1,209 inline style objects.** 260 pure `style={{ }}` objects and 949 `style={[styles.x, { }]}` mixes. Worst files: `onboarding.tsx` (63), `goal-detail.tsx`, `MomentumModal.tsx` and `DayCard.tsx` (32 each), `MarksModal.tsx` and `GoalStatsView.tsx` (31), `ai-settings.tsx` (30).
3. **Three scaling systems for the same thing.** Some sizes are raw (`fontSize: 13`), some go through `ms()`, `s()` or `vs()` (`ms(13)`, `s(16)`, `vs(10)`), and a few are computed inline. The same visual size appears as `12` and `ms(12)` in neighbouring components.
4. **121 unique colour literals (458 uses)** alongside the theme palette. Semantic colours are retyped as hex instead of read from the theme: red `#EF4444` 13 times, amber `#F59E0B` 13, green `#10B981` 9. Translucent fills are hand-mixed per file: `rgba(255,255,255, 0.04 / 0.05 / 0.06 / 0.07 / 0.08 / 0.1 / 0.12)` and `rgba(15,23,42, 0.04 to 0.08)` all mean "a step above the background".
5. **Accent tints by string concatenation:** `accent + '22'`, `+ '20'`, `+ '1F'`, `+ '18'` and so on. 20 different alpha suffixes (table below) for what is really 3 or 4 levels: subtle fill, fill, border, strong.
6. **Duplicate components** (details below): 3 segmented controls, 3 chip pickers, 6+ local stat tiles, 4+ row implementations, 6 hand-styled card surfaces next to `VoidCard`, 6+ modal and sheet shells, 10 separate progress-ring drawings, 6+ hand-built charts, 2 toggle styles.
7. **Three ways to get the accent colour:** `useAccentGradient().primary`, `colors.primary`, and hard-coded hex (`#6B8AF5`, `#3B82F6`, `#8B5CF6`).
8. **Shadows are one-offs:** 12 different `shadowRadius` values and 10 `shadowOpacity` values, although `Elevation` already defines `card` and `floating`.
9. **Radius has no scale in practice:** 999 (pill) is most common, then 12, 16, 14, 20, 11, 10, 8, 18, 22, 13, 9, 6, 4, 3 and 2 are all in active use. `Radius` defines only 12, 18, 22, 24 and 999.

## Colours

121 unique literals, 458 uses. Top 40:

| Value | Uses | Note |
|---|---:|---|
| `#FFF` | 40 | white |
| `#000` | 30 | black |
| `rgba(255,255,255,0.05)` | 27 |  |
| `rgba(15,23,42,0.05)` | 26 |  |
| `#FFFFFF` | 23 | white |
| `rgba(255,255,255,0.06)` | 20 |  |
| `rgba(255,255,255,0.08)` | 18 |  |
| `#EF4444` | 13 | = colors.error |
| `rgba(15,23,42,0.04)` | 13 |  |
| `#F59E0B` | 13 | = TASK_COLOR / warning |
| `rgba(15,23,42,0.08)` | 12 |  |
| `rgba(255,255,255,0.04)` | 10 |  |
| `#10B981` | 9 | = colors.success |
| `#F97316` | 8 | streak orange (no token) |
| `rgba(255,255,255,0.12)` | 7 |  |
| `rgba(255,255,255,0.1)` | 7 |  |
| `#8B5CF6` | 7 | violet (no token) |
| `#000000` | 7 | black |
| `rgba(15,23,42,0.07)` | 6 |  |
| `rgba(255,255,255,0.07)` | 6 |  |
| `rgba(15,23,42,0.06)` | 6 |  |
| `rgba(0,0,0,0.08)` | 6 |  |
| `#6B8AF5` | 6 | default goal colour |
| `#3B82F6` | 5 | light-theme primary |
| `rgba(0,0,0,0.05)` | 5 |  |
| `hsl(${(hue+shift)` | 4 |  |
| `#EC4899` | 4 |  |
| `rgba(255,255,255,0.7)` | 3 |  |
| `rgba(15,23,42,0.1)` | 3 |  |
| `rgba(0,0,0,0.5)` | 3 |  |
| `#FBBF24` | 3 |  |
| `rgba(15,23,42,0.10)` | 3 |  |
| `rgba(255,255,255,0.10)` | 2 |  |
| `#F9731618` | 2 |  |
| `#050505` | 2 |  |
| `rgba(15,23,42,0.12)` | 2 |  |
| `rgba(255,255,255,0.14)` | 2 |  |
| `rgba(255,255,255,0.86)` | 2 |  |
| `#2DD4BF` | 2 |  |
| `rgba(255,255,255,0.09)` | 2 |  |

### Accent alpha suffixes (`color + 'XX'`)

| Suffix | Uses |
|---|---:|
| `22` | 19 |
| `20` | 18 |
| `55` | 17 |
| `18` | 11 |
| `66` | 11 |
| `1F` | 10 |
| `44` | 10 |
| `14` | 8 |
| `30` | 7 |
| `15` | 6 |
| `1A` | 3 |
| `12` | 2 |
| `88` | 2 |
| `24` | 2 |
| `25` | 2 |
| `1C` | 2 |
| `26` | 2 |
| `10` | 1 |
| `50` | 1 |
| `38` | 1 |
| `08` | 1 |
| `0D` | 1 |
| `CC` | 1 |
| `99` | 1 |
| `4D` | 1 |

### Theme colour reads (for comparison)

Already tokenised, and worth keeping: `colors.textTertiary` 329, `colors.textSecondary` 235, `colors.textPrimary` 212, `colors.border` 122, `colors.success` 55, `colors.error` 54, `colors.surfaceSecondary` 53, `colors.primary` 29, `colors.background` 29, `colors.warning` 18.

## Typography

- **Families:** all through `FontFamily` (regular 211, semibold 130, bold 118, medium 112, display 7). One literal: `'Courier'`. `fontWeight` is never used, which is right: weight comes from the font file.
- **Font sizes:** 52 distinct expressions.

| fontSize | Uses |
|---|---:|
| `12` | 81 |
| `13` | 69 |
| `14` | 58 |
| `15` | 47 |
| `10` | 33 |
| `11` | 32 |
| `ms(11)` | 32 |
| `ms(12)` | 25 |
| `16` | 24 |
| `ms(14)` | 22 |
| `9` | 20 |
| `ms(10)` | 17 |
| `ms(13)` | 14 |
| `18` | 10 |
| `ms(15)` | 10 |
| `17` | 8 |
| `20` | 7 |
| `28` | 6 |
| `24` | 6 |
| `ms(16)` | 6 |
| `22` | 5 |
| `ms(24)` | 5 |
| `ms(9)` | 4 |
| `isSmall ? 9 : 11` | 4 |
| `ms(20)` | 4 |
| `ms(8)` | 3 |
| `ms(46)` | 3 |
| `ms(17)` | 3 |
| `44` | 2 |
| `48` | 2 |
| `ms(22)` | 2 |
| `30` | 2 |
| `26` | 2 |
| `ms(18)` | 2 |
| `46` | 1 |
| `19` | 1 |
| `ms(64)` | 1 |
| `isCompactWidth ? 26 : 30` | 1 |
| `27` | 1 |
| `32` | 1 |

### Line height

| lineHeight | Uses |
|---|---:|
| `ms(16)` | 16 |
| `17` | 14 |
| `20` | 12 |
| `ms(20)` | 11 |
| `18` | 8 |
| `ms(18)` | 7 |
| `ms(17)` | 6 |
| `ms(19)` | 6 |
| `19` | 5 |
| `22` | 5 |
| `ms(15)` | 4 |
| `24` | 3 |
| `ms(24)` | 3 |
| `16` | 2 |
| `ms(54)` | 2 |
| `ms(26)` | 2 |
| `26` | 1 |
| `cell` | 1 |
| `ms(70)` | 1 |
| `ms(22)` | 1 |

### Letter spacing

| letterSpacing | Uses |
|---|---:|
| `1` | 16 |
| `1.2` | 12 |
| `1.5` | 8 |
| `-0.5` | 7 |
| `1.4` | 5 |
| `2` | 5 |
| `-1.5` | 4 |
| `1.6` | 4 |
| `1.1` | 2 |
| `-0.3` | 2 |
| `-1.2` | 2 |
| `0.5` | 2 |
| `-1` | 2 |
| `1.8` | 2 |
| `0` | 2 |

## Spacing

### Padding (87 distinct)

| padding* | Uses |
|---|---:|
| `16` | 60 |
| `14` | 53 |
| `12` | 42 |
| `8` | 39 |
| `20` | 31 |
| `10` | 29 |
| `6` | 26 |
| `4` | 25 |
| `24` | 15 |
| `7` | 11 |
| `40` | 10 |
| `s(20)` | 10 |
| `9` | 9 |
| `13` | 9 |
| `vs(4)` | 9 |
| `s(16)` | 9 |
| `2` | 8 |
| `s(14)` | 8 |
| `s(10)` | 8 |
| `vs(8)` | 8 |
| `15` | 7 |
| `vs(40)` | 7 |
| `vs(6)` | 7 |
| `18` | 6 |
| `horizontalPadding` | 6 |
| `5` | 5 |
| `11` | 5 |
| `3` | 5 |
| `s(15)` | 5 |
| `32` | 4 |

### Margin (70 distinct)

| margin* | Uses |
|---|---:|
| `4` | 41 |
| `8` | 40 |
| `12` | 28 |
| `2` | 27 |
| `10` | 26 |
| `6` | 25 |
| `16` | 22 |
| `24` | 17 |
| `20` | 16 |
| `40` | 13 |
| `14` | 11 |
| `22` | 9 |
| `3` | 9 |
| `vs(2)` | 8 |
| `18` | 7 |
| `0` | 6 |
| `1` | 6 |
| `vs(4)` | 5 |
| `vs(10)` | 5 |
| `vs(8)` | 4 |
| `vs(14)` | 4 |
| `32` | 4 |
| `30` | 3 |
| `vs(40)` | 3 |
| `s(20)` | 3 |

### Gap (44 distinct)

| gap | Uses |
|---|---:|
| `8` | 70 |
| `10` | 56 |
| `6` | 42 |
| `12` | 42 |
| `s(8)` | 14 |
| `4` | 13 |
| `vs(2)` | 11 |
| `vs(10)` | 9 |
| `s(6)` | 9 |
| `s(12)` | 8 |
| `s(10)` | 8 |
| `14` | 7 |
| `2` | 7 |
| `20` | 6 |
| `vs(4)` | 6 |
| `vs(12)` | 6 |
| `vs(8)` | 6 |
| `5` | 6 |
| `vs(6)` | 6 |
| `s(7)` | 5 |
| `18` | 5 |
| `s(4)` | 5 |
| `1` | 4 |
| `s(5)` | 4 |
| `s(2)` | 4 |

Off-grid values in regular use: 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 18, 22.

## Radius (82 distinct)

| borderRadius | Uses |
|---|---:|
| `999` | 42 |
| `12` | 37 |
| `16` | 32 |
| `14` | 19 |
| `2` | 16 |
| `20` | 15 |
| `11` | 15 |
| `3` | 14 |
| `10` | 12 |
| `8` | 12 |
| `18` | 10 |
| `Radius.card` | 9 |
| `s(3)` | 8 |
| `4` | 8 |
| `size / 2` | 7 |
| `9` | 6 |
| `6` | 5 |
| `s(12)` | 5 |
| `22` | 4 |
| `13` | 4 |
| `s(2)` | 4 |
| `60` | 4 |
| `s(18)` | 4 |
| `s(17)` | 4 |
| `s(24)` | 4 |
| `s(19)` | 3 |
| `s(10)` | 3 |
| `28` | 3 |
| `30` | 3 |
| `(size - stroke * 2 - s(3)) / 2` | 3 |

## Shadows and elevation

| shadowRadius | Uses |
|---|---:|
| `20` | 4 |
| `12` | 3 |
| `22` | 2 |
| `8` | 2 |
| `6` | 1 |
| `18` | 1 |
| `16` | 1 |
| `28` | 1 |
| `24` | 1 |
| `14` | 1 |
| `3` | 1 |
| `2` | 1 |

| shadowOpacity | Uses |
|---|---:|
| `0.3` | 5 |
| `0.5` | 3 |
| `0.4` | 3 |
| `0.45` | 2 |
| `0.35` | 1 |
| `0.34` | 1 |
| `0.35 * dragLift.get()` | 1 |
| `0.16` | 1 |
| `0.2` | 1 |
| `0.06` | 1 |
| `0.12` | 1 |

| elevation | Uses |
|---|---:|
| `10` | 4 |
| `8` | 3 |
| `12` | 2 |
| `16` | 1 |
| `2` | 1 |
| `6` | 1 |
| `14` | 1 |
| `3` | 1 |

## Inline styles by file (top 15)

| File | Inline style objects |
|---|---:|
| `app/(auth)/onboarding.tsx` | 63 |
| `app/(root)/goal-detail.tsx` | 32 |
| `components/Home/MomentumModal.tsx` | 32 |
| `components/Community/DayCard.tsx` | 32 |
| `components/Marks/MarksModal.tsx` | 31 |
| `components/Goal/GoalStatsView.tsx` | 31 |
| `app/(root)/ai-settings.tsx` | 30 |
| `app/(root)/notifications.tsx` | 27 |
| `components/Create/HabitSheet.tsx` | 27 |
| `components/Goal/GoalPlanView.tsx` | 27 |
| `components/Create/GoalSheet.tsx` | 26 |
| `app/(root)/(tabs)/roadmap.tsx` | 25 |
| `components/Roadmap/DayPlanCard.tsx` | 25 |
| `app/(root)/(tabs)/settings.tsx` | 24 |
| `components/Habit/HabitProgressCard.tsx` | 24 |

## Duplicate components

| Role | Implementations |
|---|---|
| Segmented control | `components/Common/Segmented.tsx`; a private `Segmented` in `components/Home/RoadmapFilters.tsx`; `ChipPicker`; `Choices` in `components/Create/DetailBar.tsx` |
| Chips / choices | `Choices` (DetailBar), `Chip` (RoadmapFilters), `ChipPicker` (Common), ad-hoc chips in `GoalSheet`, `TaskFormModal`, `LeadTime`, `RepeatPicker` |
| Stat tile | local `Stat` in `progress.tsx`, `HabitCalendarMap.tsx`, `MomentumModal.tsx`, `RecoveryModal.tsx`, `DayPlanCard.tsx`; `Tile` in `GoalStatsView.tsx`; stat blocks in `GoalPace.tsx` and `MarksModal.tsx` |
| List row | `Row` in `settings.tsx`, `task-stats.tsx`, `RoadmapFilters.tsx`; `ToggleRow` and `Group` in `ai-settings.tsx`; `FeedbackRow`; `TimeRow`; `GoalHabitRow` |
| Card surface | `VoidCard` (glass and matte), plus hand-styled cards in `goals-overview.tsx`, `MarksBoard.tsx`, `DayPlanCard.tsx`, `GoalPace.tsx`, `HabitCalendarMap.tsx`, `task-stats.tsx` |
| Modal / sheet shell | `VoidModal`, `VoidSheet`, `SheetScreen`, `SettingsModal`, `ComposerModal`, `ScrollPickerModal`, plus custom overlays (the `MarksModal` info window, the `RoadmapFilters` menu) |
| Progress ring / arc | `HalfCircleProgress`, `ProgressAvatar`, `FocusDial`, the `HabitProgressCard` dial, `ProgressRing` in `HabitGraphRenderer`, rings in `progress.tsx`, `CalendarStrip`, `SwipeableHabitItem`, `Pulse`, `DayCard` |
| Chart | `GoalProgressChart`, `HabitGraphRenderer`, bars in `MomentumModal`, `task-stats.tsx` and `progress.tsx`; heatmaps in `DetailedHeatmap`, `HabitCalendarMap` and `task-stats.tsx` |
| Toggle | React Native `Switch` (`notifications`, `privacy`, `sharing`, `integrations`) vs the custom switch in `ToggleRow` (`ai-settings.tsx`) |
| Button | `AppButton`, `IconButton`, `ShareButton`, `AppleAuthButton`, plus many hand-built `Pressable` buttons (each composer's save button, "Add step", "More details") |
| Section heading | `SectionLabel` (GoalRows), `UIStyles.sectionTitle`, and per-screen letter-spaced label styles in most screens |
| Empty state | separate inline versions in `goals-overview`, `GoalPlanView`, `goal-detail`, `DailyFocusCard`, `community` |

## Already good, worth keeping

- `colors.*` role names in `Colors.ts`, used about 1,100 times.
- `FontFamily`: every font already goes through it.
- `Surfaces`, `Elevation`, `surfaceFor` and `elevationFor` in `DesignSystem.ts`: a considered surface recipe that is under-used.
- `VoidCard`, `ModalHeader`, `SheetScreen`, `IconButton`, `AppButton` and `Segmented` are reasonable bases for the Phase 3 primitives.

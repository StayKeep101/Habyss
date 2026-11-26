# Habyss app improvements

Working checklist from the September 16, 2026 hands-on review. Items are checked
only after implementation and static verification. Nothing here has been
exercised on a device yet — see Validation.

## Stability and shared controls
- [x] Habit editor appears above the detail screen and closes without leaving a touch-blocking overlay.
- [x] Moving habits between goals responds immediately and handles failed saves.
- [x] Analytics use one themed, functional share action.
- [x] Goal and habit collaboration use matching Add friend actions and a clearer invitation sheet.

## Home
- [x] Friendly, compact streak celebration with a weekly check-in row.
- [x] Goal progress: remove Mission Control and “Not enough real data”.
- [x] Streaks: goal swiping, goal-specific statistics and interactive activity map; remove large hero.
- [x] Consistency: remove large report; retain mission breakdown.
- [x] Completion: compact overview with bounded detail scrolling.
- [x] Focus: daily history and configurable active day (default 08:30–22:00), time left, and useful supporting metrics.
- [x] Remove routines from the app experience.
- [x] Life Matrix: clearly explained real habit data and useful drilldown.

## Roadmap
- [x] Compact deselectable Show / Focus / Goal filters, reversible standard sorting, intuitive expand control.
- [x] Goal detail: remove background text and dashboard filler; Add friend action.
- [x] Habit detail: clear structure and accessible editing.

## Creation
- [x] Creation menu contains Habit and Goal choices without “Start with” copy.
- [x] Habit form: essential fields visible together, optional settings disclosed when needed.

## Profile and preferences
- [x] Plain profile editor without background photo.
- [x] Gender picker without nested virtualized lists.
- [x] Birthday input and derived age; preserve existing profile information.
- [x] Compact AI configuration and personality controls.

## Fixed along the way
- Personality icons are emoji but were rendered through `Ionicons`, so every
  personality tile showed a blank icon.
- `SwipeableHabitItem` gated the “Focus now” badge behind a `routineName` no
  caller ever passed, so that badge could never appear.
- The goal share sheet reported success before doing any work, so a failed
  share was indistinguishable from a successful one.
- `goal-detail` and `habit-detail` called `useGlobalSearchParams` while
  importing `useLocalSearchParams`, which did not compile.

## Scope notes
- Community had no requested changes. Notifications, Appearance, and goal creation were marked satisfactory.
- Routine records are preserved in storage; only the runtime and UI were removed.
- No production database changes, outbound invitations, or publishing were required.

## Validation
- Baseline `npm run type-check`: passed before changes.
- Current tree: `npx tsc --noEmit` clean, `npx jest --ci` 39 tests across 4 suites passing,
  `npx expo export --platform ios` bundles without unresolved modules.
- 13 new tests cover the focus day window and session grouping; 14 earlier tests
  cover habit scheduling and life-area summaries.
- **Not yet verified on a device.** Local native builds are currently blocked by a
  missing watchOS 26.5 simulator runtime, which is unrelated to this work. The
  JS changes reach the existing dev build through Metro without a rebuild.

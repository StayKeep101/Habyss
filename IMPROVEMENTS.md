# Habyss app improvements

Working checklist from the September 16, 2026 hands-on review. Items are checked only after implementation and relevant verification; native-device checks are recorded separately.

## Stability and shared controls
- [ ] Habit editor appears above the detail screen and closes without leaving a touch-blocking overlay.
- [ ] Moving habits between goals responds immediately and handles failed saves.
- [ ] Analytics use one themed, functional share action.
- [ ] Goal and habit collaboration use matching Add friend actions and a clearer invitation sheet.

## Home
- [ ] Friendly, compact streak celebration with a weekly check-in row.
- [ ] Goal progress: remove Mission Control and “Not enough real data”.
- [ ] Streaks: goal swiping, goal-specific statistics and interactive activity map; remove large hero.
- [ ] Consistency: remove large report; retain mission breakdown.
- [ ] Completion: compact overview with bounded detail scrolling.
- [ ] Focus: daily history and configurable active day (default 08:30–22:00), time left, and useful supporting metrics.
- [ ] Remove routines from the app experience.
- [ ] Life Matrix: clearly explained real habit data and useful drilldown (Astra review requested).

## Roadmap
- [ ] Compact deselectable Show / Focus / Goal filters, reversible standard sorting, intuitive expand control.
- [ ] Goal detail: remove background text and dashboard filler; Add friend action.
- [ ] Habit detail: clear structure and accessible editing.

## Creation
- [ ] Creation menu contains Habit and Goal choices without “Start with” copy.
- [ ] Habit form: essential fields visible together, optional settings disclosed when needed.

## Profile and preferences
- [ ] Plain profile editor without background photo.
- [ ] Gender picker without nested virtualized lists.
- [ ] Birthday input and derived age; preserve existing profile information.
- [ ] Compact AI configuration and personality controls.

## Scope notes
- Community had no requested changes. Notifications, Appearance, and goal creation were marked satisfactory.
- Preserve existing routine records for recovery; remove active UI and runtime entry points.
- No production database changes, outbound invitations, or publishing are required to implement this work.

## Validation
- Baseline `npm run type-check`: passed before changes.
- Final checks and any native-only limitations will be recorded here.

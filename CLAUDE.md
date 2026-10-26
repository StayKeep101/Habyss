# Habyss — UI rules

These rules keep every screen consistent. They apply to every change that touches what the user sees.

## Project structure

```
app/              pages (Expo Router routes) only — no styles, no shared pieces
components/ui/    the building blocks every page is made of (the app's own look)
components/<Area>/  pieces for one area: Home, Habit, Goal, Roadmap, Community, …
styles/screens/   each page's StyleSheet, one file per page
theme/            the look: colors.ts, designSystem.ts (fonts, surfaces, radius,
                  shadows), scale.ts (s/vs/ms), navigation.ts, tokens.ts (names)
context/          app-wide state: theme, accent, settings, AI personality, focus timer
hooks/  lib/      logic and data
constants/        true constants only (brand, features, AI personalities)
docs/             notes, the UI audit, old SQL
```

## Design system

- The look lives in `theme/`: `colors.ts` (colours per theme) and `designSystem.ts` (fonts, surfaces, radius, shadows, type styles). `theme/tokens.ts` names those values as roles (`surface`, `textMuted`, `radius.lg`, …) — it reads from them and holds no colours of its own. Read tokens in components with `useTokens()` (`hooks/useTokens.ts`).
- Components: `components/ui` — the list is at the top of `components/ui/index.ts`. Import from `@/components/ui`.
- Surfaces: every card, button disc, field, chip and the tab bar is drawn with `MatteSurface` (Phantom-style matte: soft top-light gradient, faint edge, shadow). Text inputs are `MatteInput` or `AppTextField`, never a bare `TextInput` with its own box. A chosen chip is a solid accent fill.
- Screen styles: `styles/screens/` — each page's StyleSheet, moved out of `app/` unchanged (see `styles/README.md`). A page's look is edited there, not in the page file. Never put a style file inside `app/` (Expo Router would treat it as a route).
- Audit of where the app started: `docs/ui-audit.md`.

## Rules

- Never use raw hex/rgb colors, px numbers, or inline styles in screens. Use tokens only.
- Screens are composed from `/components/ui`. Never style a screen from scratch.
- If a needed component doesn't exist, create it in `/components/ui` first, from tokens, then use it.
- Never add a new token without asking the user.
- New screens must match the layout, spacing and hierarchy of the existing screens around them, built from the same `components/ui` pieces.
- Before finishing any UI task, check the changed files for raw values and fix them.
- Every UI change is reviewed with the `apple-design` skill (Apple's Human Interface Guidelines). The floor, enforced in `components/ui` so every screen gets it:
  - text at least 11 pt (`npm run check:ui` fails below that); body around 15–17 pt;
  - text contrast at least 4.5:1 (3:1 for 18 pt+ or bold), in every theme;
  - anything tappable at least 44×44 pt, using `hitSlop` when the drawing is smaller;
  - every icon-only control has an `accessibilityLabel`; toggles and ticks say their state;
  - meaning never by colour alone; motion follows Reduce Motion (already in `Motion.tsx`).
  Fix it in the shared piece in `components/ui`, not on one screen, so it applies app-wide.

## Building a new feature — where each part goes

Every new feature follows the structure above. No UI anywhere else.

1. **Page** → `app/<name>.tsx`. Only what the page does and which pieces it shows. No `StyleSheet` in the file.
2. **Page styles** → `styles/screens/<name>.styles.ts`, imported as `styles`. Values from tokens (`theme/`), never raw numbers or colours.
3. **Pieces for this feature** → `components/<Area>/` (e.g. `components/Goal/`), built from `components/ui`.
4. **A piece other features could use** → `components/ui/`, added to the list in `components/ui/index.ts`.
5. **Look first, reuse always**: before making anything new, check `components/ui` for an existing piece (card, sheet, header, button, field, row) and use it as is.
6. **Logic and data** → `lib/` (plain functions, with tests in `lib/__tests__`) and `hooks/`. App-wide state → `context/`.
7. **Colours, fonts, corners, shadows** → only from `theme/`. A value that does not exist there yet: ask the user before adding it.
8. **Everything that shows data moves**, using `components/ui/Motion.tsx`:
   - Every figure that is data uses `CountUp`/`useCountUp`; bars `AnimatedFill`/`GrowBar`; rings and arcs `useProgress`; line charts `Reveal`; grids `PopIn`.
   - They grow in when a page opens and glide when a habit, task or goal changes.
   - Any switch that changes data (month, 1W/All, 30/90 days, a tab) passes what it switched as `replay`, so the intro plays again.
   - Every row in a list of habits, tasks or goals is wrapped in `ListItem`, so adding, removing and reordering fade and slide.
   - Never draw a still bar, a figure that jumps, or a list that snaps.
9. **Data and numbers**: pages read habits, tasks and history only through the shared hooks — `useData`, `useTasks`, `useHistory`, `useGoalsInsights` (one in-memory copy in `lib/dataStore.ts`). Never query the database from a page, and never compute a stat a second way: streaks come from `streakFrom`, goal progress from `goalInsights`, momentum and recovery from their `lib/` files. What a habit is doing (focusing, paused, done, skipped, focus now) comes only from `habitStatus` in `lib/habitStatus.ts`.
10. After building, add the page to the table in `styles/README.md`.

## Working in this repo

- Expo SDK 57 with a committed `ios/` folder: never run `expo prebuild --clean` (it deletes the widgets and the Watch app). Native changes need an EAS build; JavaScript changes ship with `eas update --channel preview`.
- The update runtime is fixed in `app.json` (`runtimeVersion`) and `ios/Habyss/Supporting/Expo.plist` (`EXUpdatesRuntimeVersion`); bump both whenever native code changes. `ios/` is built as is (no prebuild), so `app.json` `ios.infoPlist`, entitlements and plugin settings do not reach the build: edit `ios/Habyss/Info.plist` and the `.entitlements` files, and mirror them in `app.json`.
- Install packages with `npx expo install <pkg>`.
- Checks: `npm run type-check`, `npm run test:ci`, `npm run check:ui`.

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
- Screen styles: `styles/screens/` — each page's StyleSheet, moved out of `app/` unchanged (see `styles/README.md`). A page's look is edited there, not in the page file. Never put a style file inside `app/` (Expo Router would treat it as a route).
- Audit of where the app started: `docs/ui-audit.md`.

## Rules

- Never use raw hex/rgb colors, px numbers, or inline styles in screens. Use tokens only.
- Screens are composed from `/components/ui`. Never style a screen from scratch.
- If a needed component doesn't exist, create it in `/components/ui` first, from tokens, then use it.
- Never add a new token without asking the user.
- New screens must match the layout, spacing and hierarchy of the existing screens around them, built from the same `components/ui` pieces.
- Before finishing any UI task, check the changed files for raw values and fix them.

## Building a new feature — where each part goes

Every new feature follows the structure above. No UI anywhere else.

1. **Page** → `app/<name>.tsx`. Only what the page does and which pieces it shows. No `StyleSheet` in the file.
2. **Page styles** → `styles/screens/<name>.styles.ts`, imported as `styles`. Values from tokens (`theme/`), never raw numbers or colours.
3. **Pieces for this feature** → `components/<Area>/` (e.g. `components/Goal/`), built from `components/ui`.
4. **A piece other features could use** → `components/ui/`, added to the list in `components/ui/index.ts`.
5. **Look first, reuse always**: before making anything new, check `components/ui` for an existing piece (card, sheet, header, button, field, row) and use it as is.
6. **Logic and data** → `lib/` (plain functions, with tests in `lib/__tests__`) and `hooks/`. App-wide state → `context/`.
7. **Colours, fonts, corners, shadows** → only from `theme/`. A value that does not exist there yet: ask the user before adding it.
8. After building, add the page to the table in `styles/README.md`.

## Working in this repo

- Expo SDK 57 with a committed `ios/` folder: never run `expo prebuild --clean` (it deletes the widgets and the Watch app). Native changes need an EAS build; JavaScript changes ship with `eas update --channel preview`.
- The update runtime is fixed at `1.0.0` in `app.json`. Bump it whenever native code changes.
- Install packages with `npx expo install <pkg>`.
- Checks: `npm run type-check`, `npm run test:ci`, `npm run check:ui`.

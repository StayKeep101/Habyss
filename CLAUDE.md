# Habyss — UI rules

These rules keep every screen consistent. They apply to every change that touches what the user sees.

## Design system

- Tokens: `constants/tokens.ts` — colour roles per theme, accent tints, spacing, radius, type scale, elevation. Read them in components with `useTokens()` (`hooks/useTokens.ts`).
- Components: `components/ui` — Screen, Text, Button, Card, Input, Toggle, Badge, Divider, Sheet, EmptyState, StatTile, ChartCard, HabitRow, ProgressRing, Segmented. Import from `@/components/ui`.
- Audit of where the app started: `docs/ui-audit.md`.

## Rules

- Never use raw hex/rgb colors, px numbers, or inline styles in screens. Use tokens only.
- Screens are composed from `/components/ui`. Never style a screen from scratch.
- If a needed component doesn't exist, create it in `/components/ui` first, from tokens, then use it.
- Never add a new token without asking the user.
- Reference screen: [set after Phase 5]. New screens must match its layout, spacing and hierarchy.
- Before finishing any UI task, check the changed files for raw values and fix them.

## Working in this repo

- Expo SDK 57 with a committed `ios/` folder: never run `expo prebuild --clean` (it deletes the widgets and the Watch app). Native changes need an EAS build; JavaScript changes ship with `eas update --channel preview`.
- The update runtime is fixed at `1.0.0` in `app.json`. Bump it whenever native code changes.
- Install packages with `npx expo install <pkg>`.
- Checks: `npm run type-check`, `npm run test:ci`, `npm run check:ui`.

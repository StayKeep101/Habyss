# Habyss UI conventions

Keep the existing Habyss glass and blue identity. The shared UI primitives are
responsible for visual consistency; individual screens should not redefine them.

- **Icons:** `AppIcon` from `components/Common/AppIcon` is the only interface icon
  source. It renders Ionicons. Prefer outline glyphs for actions and navigation;
  filled counterparts can indicate a selected tab or completed state. Give icon
  buttons an accessible label. Saved images remain user content; emoji in prose
  are content, not interface icons. Unknown saved glyphs fall back safely.
- **Typography:** use `Typography` for standard text and `FontFamily` for custom
  metrics. Use the loaded font file for each weight; do not pair custom fonts with
  `fontWeight`. Space Grotesk is reserved for the brand and large display metrics.
- **Colors:** read the resolved theme from `useTheme` and `Colors[theme]`. Read
  the selected accent from `useAccentGradient`. Use `foreground` for accent text
  on the page, `buttonColors` for white-label primary buttons, and status colors
  only for status. User-selected habit/goal colors and service logos retain their
  own meanings.
- **Layout:** use `Spacing`, `Radius`, `Control`, and `UIStyles`. Standard screen
  gutters are 20, cards use a 22 radius, controls use an 18 radius and 54 minimum
  height, and icon targets are at least 44. Content can grow with larger text.
  Main tabs use `useResponsiveLayout` for compact-device spacing and dock clearance.
- **Screens:** routed page sheets use `SheetScreen`; component sheets use
  `VoidModal` and `ModalHeader`. Register routed sheets with modal presentation.
  `SheetSection`, `VoidCard`, `AppButton`, `AppTextField`, and `IconButton` provide
  the common headings, surfaces, and controls. Scroll settings content.

Run `npm run check:ui` before adding or changing screens. ESLint also rejects
imports from other icon packs. Type-check and export the native bundle after
shared component changes. Manually verify light, Habyss, True Dark, bright/dark
accents, compact screens, larger text, keyboard states, and sheet dismissal.

The boot screen appears before appearance preferences load, and third-party
RevenueCat purchase layouts are configured separately from the app's primitives.

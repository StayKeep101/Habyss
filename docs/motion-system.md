# Habyss motion system

How Habyss moves, and why. Every animation in the app reads its timing from
`theme/motion.ts`; this document is the reasoning behind those numbers, the
storyboards for the moments that matter, and what has to be designed outside
code. The first full implementation is the goal-completion sequence
(`components/Celebrations/GoalCompleteSequence.tsx`).

## 1. Audit (October 2026)

| Area | Found | Verdict |
| --- | --- | --- |
| Libraries | Reanimated 4.5, react-native-svg 15, gesture-handler 2.32, expo-haptics, expo-audio, expo-linear-gradient, expo-blur. No Rive, no Skia, no Lottie. | Enough for state-driven UI motion today. Authored art needs Rive (see §6). |
| Data motion | `components/ui/Motion.tsx`: CountUp, AnimatedFill, GrowBar, PopIn, ListItem, an intro gate. One timing (`MOTION`). | Solid. Keep. |
| Overlays | VoidSheet 260/190 ms, MorphMenu 240/170, RoadmapFilters 220/150 (no Reduce Motion), PopupCard a spring with bounce, celebration 520 ms. | Each invented its own. Unified on the overlay tokens below. |
| Pages | Native stack: push, modal, formSheet, fullScreenModal. | Native transitions stay native: they are the platform's and the fastest. |
| Celebrations | Orbs (Marks), confetti, a goal card with rays. Shown with a root Modal (froze over modal pages) until moved to `Overlay`. | The goal moment had no build-up and no ending: it appeared and was dismissed. Rebuilt as a sequence (§4). |
| Feedback | Haptics in most taps; sound only for achievements (`useAppSounds`). | Good rule. Sound and haptics now land on the same beat as the motion. |

## 2. Principles

1. **Frequency decides intensity.** The more often something happens, the
   quieter it is. A tick happens dozens of times a day; a goal is reached a
   few times a year.

   | Tier | Frequency | Examples | Motion | Haptic | Sound |
   | --- | --- | --- | --- | --- | --- |
   | 0 Instant | constant | scrolling, typing, scrubbing a strip | none | none | none |
   | 1 Feedback | many a day | tick a habit, switch a tab, open a sheet | 120 to 260 ms, transform and opacity only | selection or light | tick only |
   | 2 Reward | a few a day | task done, Marks earned, focus summary | 300 to 700 ms, one staged reveal | medium, then success | complete |
   | 3 Moment | weekly | crew quest reached, streak record, day kept | up to 1.5 s, skippable | success | celebrate |
   | 4 Ceremony | rare | goal reached, a Core evolution | up to 3 s, staged, skippable, Reduce Motion path | a composed pattern | level up |

2. **Anticipation, action, follow-through.** A big moment has a small build-up
   (the screen settles, the subject gathers), the event (one clear beat where
   haptic and sound land together), and a tail (things settle, numbers roll,
   the interface returns).
3. **One subject at a time.** Staged reveals: the eye goes to one thing, then
   the next. Never three things arriving at once.
4. **No bounce in the interface.** Springs are critically damped (no overshoot)
   for controls and pages. Overshoot is allowed once, on the single "landing"
   beat of a Tier 3 or 4 moment.
5. **Exits are quicker and smaller than entrances.** The user has already moved on.
6. **Transform and opacity only.** Never width, height or position on the UI
   thread hot path. Numbers count on the JS thread at 60 fps, which is fine.
7. **Reduce Motion is a full path, not an afterthought.** Every sequence has a
   still version: the final state, a cross-fade, the same haptic.
8. **Always skippable.** A tap anywhere jumps a Tier 3 or 4 sequence to its
   final state. Nobody waits for a celebration.

## 3. Tokens (`theme/motion.ts`)

- **Durations:** `tap` 120, `quick` 180, `base` 260, `exit` 190, `emphasis` 420, `reward` 700.
- **Easings:** `enter` (out cubic), `exit` (in cubic), `move` (in-out cubic), `land` (out back 1.4, Tier 3 and 4 only).
- **Overlay:** `overlayIn` and `overlayOut` (sheets, menus, filters, pop-up cards).
- **Stagger:** `stagger` 35 ms between list rows, `stage` 160 ms between story beats.
- **Ceremony timeline:** the beats of §4, in one place, so sound and haptics can be timed to them.

`components/ui/Motion.tsx` reads its `MOTION` from here; nothing else
defines a duration of its own.

## 4. Storyboards

### 4.1 Goal reached (Tier 4, built)

| Beat | Time | What happens | Haptic | Sound |
| --- | --- | --- | --- | --- |
| 0 Trigger | 0 | The last tick or log that reaches the goal. The orbs fly from the finger as usual. | (the tick's own) | (the tick's own) |
| 1 Settle | 0 to 300 ms | The app dims behind a scrim, everything else stops. | light | none |
| 2 Gather | 300 to 1,100 ms | A ring in the goal's colour draws itself closed around the goal's icon, from 0 to 100%. | soft ticks at 25, 50, 75% | none |
| 3 The beat | 1,100 ms | The ring closes and flashes, the icon turns into the trophy and lands (one overshoot), light breaks outward in rays. | success | level up |
| 4 Reveal | 1,250 to 1,900 ms | "Goal reached", then the goal's name, then the line, rising one after another. | none | none |
| 5 Count | 1,900 ms | The trophy count rolls from n−1 to n (TrophyCount). | light at the roll | none |
| 6 Rest | until dismissed | Confetti once (not looped), the button. | | |
| 7 Return | on "Take it in" | The card shrinks a little and fades, the scrim lifts. The goal leaves the active list with the list's own exit (ListItem). | light | none |

- **Tap anywhere** during beats 1 to 5: jump to beat 6.
- **Reduce Motion:** the final state fades in at once (no ring draw, no rays, no confetti), with the success haptic and the sound.

### 4.2 Habit tick (Tier 1, existing, kept)

The check fills (CheckPop), a selection haptic, the tick sound, and the orbs rise
from the finger to the Marks total. Nothing else moves.

### 4.3 Milestone unlocked (Tier 3, next)

The milestone's dot on the goal's timeline lights up and travels along the
line to the next milestone (Reanimated path), the progress bar extends, and
"+30 Marks" lands. About 1.2 s. Success haptic.

### 4.4 Daily summary, the day kept (Tier 3, next)

The day's ring closes on the streak card, the streak number rolls up, and
yesterday's flame passes the light to today's. Uses the streak card's existing shape.

### 4.5 Social (Tier 2 and 3, next)

- **Reaction received:** the reaction's pill drifts up from the card's foot, about 600 ms.
- **The Drop:** cards flip open one after another (built), 140 ms apart.
- **Crown taken:** the crown lifts off the old holder's face and settles on the new one, about 1.2 s, Tier 3.

## 5. The Core (design brief)

An evolving visual object that grows with real progress: the emotional
centre the user returns to.

- **Inputs:** days kept (structure), goals reached (new layers), the streak
  (inner light), Marks (glow), focus minutes (density).
- **States:** dormant, a seed, growing (rank by rank, about 10 stages), radiant
  on a perfect day, dimmed after missed days. It never dies: it recovers.
- **Reactions:** a tick pulses it once, a goal adds a permanent layer (an
  evolution: Tier 4), a missed day dims it slightly.
- **Placement:** Home, beside Marks; the profile, full size; the Live Activity, small.

This needs authored art; see §6.

## 6. Libraries and assets

| Tool | Use for | Verdict |
| --- | --- | --- |
| Reanimated 4 | Every interface transition, gestures, sequences, numbers | **Use now.** Installed. All of §4.1 runs on it. |
| react-native-svg | Rings, rays, the progress paths | **Use now.** Installed. |
| Rive (`rive-react-native`) | The Core: one artboard, a state machine driven by numbers (streak, rank, mood). Small files, interactive at runtime. | **Recommended for the Core.** Needs a native build and an authored `.riv`. |
| Skia (`@shopify/react-native-skia`) | Glows, blur, particles and shaders beyond what Views can do (the Core's light, a richer burst) | **Add when the Core is built.** Needs a native build; about 6 MB. |
| Lottie | Prerecorded authored loops | **Not recommended.** Not interactive with app state; Rive does the same job better. |

**Assets that must be designed outside code (not generated here):**
1. **The Core:** a Rive file with the state machine described in §5, about 10
   growth stages, inputs for streak, rank and mood, a one-shot evolution trigger. Designer: 2 to 4 weeks.
2. **A sound set:** tick, complete, celebrate, level up, evolution, crown. One family, short (under 1.2 s), mastered quiet. The current files are placeholders from the same family.
3. **A Core evolution moment:** a Rive one-shot that plays when a goal adds a layer.

## 7. Performance budgets

- 60 fps on iPhone 11 (the oldest worth targeting): animate transform and opacity on the UI thread only.
- At most 48 confetti pieces; at most 12 rays; at most 1 full-screen overlay at a time.
- A sequence holds no timers after it ends; everything is cancelled on unmount.
- No looping animation anywhere in the interface (the Core's slow idle, later, is the single exception, and pauses when off screen).

## 8. Accessibility

- Reduce Motion: every Tier 2 to 4 sequence has a still path (`useReducedMotion`, `ReduceMotion.System` on every timing).
- Skippable: a tap anywhere jumps to the final state.
- Meaning is never carried by motion alone: the text says what happened ("Goal reached").
- VoiceOver: the sequence announces its result once it is at rest.

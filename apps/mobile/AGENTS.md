# Habyss — what every change is for

Read this before designing or building anything in Habyss. The UI rules (structure, tokens, components, accessibility floor) are in `CLAUDE.md`; this is the why behind them.

## What Habyss is

A productivity app for habits, tasks and goals, and for planning the day around them. Its promise is time: **time is money**, and Habyss gives people theirs back. The world it is told in: the **Abyss** (the place in everyone's head where time is lost and plans never start), **Chronos** (time itself, the one constant, the same 24 hours for everyone) and **Echo** (the companion, a ripple in time, that pulls you out).

## The position

- **Very simple on the outside, very complex on the inside.**
- **People should never need to open the app**, unless they want to, or at the end of the day.
- **Systems and automations, outcome-based, not time-based.**
- **Make everything super funny, but genuinely super high quality.**

## Voice: funny, bold, and still useful

Habyss talks like dbrand: confident, deadpan, a little cheeky, never cute. The jokes are as carefully made as the UI.

- **The joke goes in the title; the line under it stays plain and useful** (what happened, what to do). Someone in a hurry gets the help; someone reading gets the laugh.
- **Roast the habit, never the person.** Doomscrolling, procrastinating, empty plans are fair game. Someone's worth, body or bad day is not.
- **Short.** One line, a few words. No emoji, no exclamation marks, no memes that date.
- **Self-aware.** The app can joke about being an app, and own its own mistakes ("That one's on us").
- **Never funny** when Shards or money are taken, something is deleted or can't be undone, privacy and security, time off (sick, vacation), or in accessibility labels. Those stay plain and kind.
- **Echo keeps its own chosen personality.** This is the app's voice; Echo's is the user's choice.
- Recurring moments (something didn't save, a permission is needed) take their titles from `lib/voice.ts`, so the app says them one way, and never the same line twice in a row.

| Plain | Habyss |
| --- | --- |
| No goals yet | No goals. Bold strategy. |
| Error | Well, that's embarrassing |
| Wait 24 hours? | Having second thoughts? |
| Earn your scroll | Nice try. |

## 0. Design first

Design is the first principle, before features and before copy. Every input and every number should be something you can see and touch, not a form:

- set a value by moving it on a visual that shows what it means, not by typing it or spinning a generic wheel. Example: changing the sleep schedule is a clock face where you drag the bedtime and wake-up handles round to the right hour and minute, with the night drawn between them; not two scroll wheels;
- use sliders, dials, rings, gradients and direct manipulation wherever a value has a range, a time or an amount;
- show data as visuals (rings, bars, cubes, timelines) that move, so the meaning is clear before anything is read;
- the more intuitive control wins even if it takes longer to build: the goal is an app that is interesting to touch and obvious to use.

## 1. Speed from thought to action

Every UX decision starts here. The path is:

**an idea, thought or desire in the user's head → knowing exactly what to do → doing it.**

Planning is the biggest friction, so planning must be close to effortless. Judge every flow by how many steps, taps, fields and decisions stand between the thought and the action, and remove them:

- capture first, details later (or never): speak, type one sentence, or tap once; the app works out the rest (dates, times, lengths, which goal) and lets the user correct it;
- sensible defaults over questions (a task takes 90 minutes, a habit 30; the timeline lays out the day by itself);
- the next action is always obvious: what is now, what is next, one tap to start or tick it;
- nothing between the user and their day: no confirmation dialogs for undoable actions, no forms where a choice will do, no screens that only explain.

If a feature adds a step, it has to save more time than it costs.

## 2. Beautiful, magical, premium, minimal

Habyss should have some of the most beautiful UI on the App Store: calm, dark, matte, precise, with moments of magic. Minimal means **as little text as possible**:

- keep text where it labels something that would otherwise be unclear;
- anything an icon, a layout, a visual, a number or motion can say instead, it should say instead;
- one short line beats a paragraph; no word that doesn't earn its place; no explaining what the design already shows;
- spend boldness in one place per screen; everything around it stays quiet;
- motion is part of the magic but never decoration: purposeful, quick, Reduce Motion respected (`docs/motion-system.md`).

Minimal never means less usable: accessibility labels, contrast, 44 pt targets and VoiceOver stay (see `CLAUDE.md`).

## 3. How to decide

When two options compete, choose in this order:

1. the one that is more visual and more direct to touch (design first);
2. the one that gets the user from thought to action faster;
3. the one with less text and fewer elements;
4. the one that fits the existing system (`components/ui`, `theme/`) rather than a one-off.

# Preview delivery

- After each completed set of app edits, run the relevant checks and update the EAS preview so the user can try the changes.
- For compatible JavaScript, styling, and asset changes, publish an EAS Update to the `preview` channel using the `preview` environment. Verify the installed preview runtime and target platforms first.
- If changes require native code or configuration, create an EAS build with the `preview` profile instead of publishing an incompatible OTA update.
- Report the update or build link and any verification limitations. Never publish to production unless explicitly requested.

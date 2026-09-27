# Open work — round three

From the list of 2026-09-27 (evening). Rounds one and two are in `docs/TODO.md`
and `docs/TODO-2.md`; anything still open there is still open.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Correctness

- [x] **The streak read zero on Home while the card said 3.** Two calculations
      answering one question. Home counted it per goal — a day counted only if
      every habit under some goal was done — and never looked at tasks at all,
      so finishing today's three things moved nothing. Home now uses the same
      `streakFrom` the card uses. The flame's heat is computed separately from
      how much of today is done, which is what it was really showing.

## Carried over from round two

- [x] Look tab (`components/Create/GoalLookPicker.tsx`): all 42 icons are on
      screen with the search always visible — "Browse all 42 icons" was a tap
      to reach the thing the tab is for — inside a panel with a ceiling so the
      sentence you are writing never scrolls away. The colour wheel now sits
      behind a circle of the spectrum at the end of the swatch row, where the
      eye is already looking for a colour, instead of a text link reading
      "Custom color". The 48-point preview on the left is gone; the "Look"
      chip above the keyboard already shows the icon and colour.
- [x] Reminders lead by a real duration (`lib/leadTime.ts`,
      `components/Create/LeadTime.tsx`): minutes, hours or days, where the unit
      chooses which five amounts are on screen rather than showing nineteen
      buttons. Everything is still stored in the `reminder_offset` column as
      minutes, so **no migration and no habit changes** — hours and days are a
      way of saying a number of minutes. A lead is read back in the unit it was
      set in, exactly: 90 minutes stays 90 minutes rather than rounding to an
      hour and quietly moving the reminder.
- [x] Places work in both directions. `locationReminders` entries carry
      `trigger: 'arrive' | 'leave'` — absent means arriving, which is what every
      place saved before this already did, and it rides in the existing JSON
      column so **no migration** here either. A region is registered for one
      direction only (`notifyOnEnter` / `notifyOnExit`), and the crossing is
      checked again when it fires, because a stale region keeps reporting until
      the next refresh. Tapping a place chip turns it round; the × removes it.
      The daily dedupe is now per place and per direction, so a habit with two
      places can still catch you at the second one.
- [ ] The keyboard still flickers on leaving a create sheet. One attempt has
      been made (`ComposerModal` now outlives `visible` by a slide and
      dismisses the keyboard first); it needs checking on a device to see what
      is still firing. **This is the one thing on the list I cannot finish from
      here** — it is a frame-timing problem between iOS's keyboard animation
      and the modal's, and the only honest way to fix it is to watch it happen.

## Still open, and why

- **Messages between friends** (round one) needs a `friend_messages` table, so
  it waits on the migration below. Notes on a day could be local because a note
  is still a record of what you thought; a message that never leaves the phone
  is a conversation with nobody, and building a fake inbox would be worse than
  building nothing.
- **Two migrations are written and not applied**, which is the only thing
  standing between the social tab and being real:
  `20260927_feed_reactions_and_proof.sql` and
  `20260926_habit_reminder_message.sql`. They need
  `SUPABASE_ACCESS_TOKEN=sbp_...` in `.env.local` (gitignored — it is not there
  now), then `node scripts/apply-migration.mjs <file>`.
- **The app-slowdown diagnosis** is last, as you said.

## Goals

- [x] Tapping a goal opens its chart **in place** — the same chart as the one
      at the top of the page, with ranges and a line you can drag across. The
      card's status line becomes the scrub readout while you drag, so the
      number you are looking for is where you were already looking. Tapping
      again closes it; a long press still opens the full stats page.

## Lock screen

- [x] Echo speaks hourly on the lock screen — as a **widget**, not a Live
      Activity. A Live Activity needs a start, an end and something happening
      in between; "a line, on the hour, all day" is a timeline, which is what a
      widget is for. `lib/echoLockScreen.ts` writes one line per waking hour
      into the App Group and `ios/Widget/EchoWidget.swift` reads whichever the
      hour has reached (`accessoryRectangular`, `accessoryInline`, plus small
      and medium for the Home Screen).
      Two things worth knowing: the lines are picked with a **seeded** shuffle,
      so rebuilding the plan does not rewrite the afternoon and take away the
      line you were half-reading; and sleeping hours are skipped rather than
      filled, so a phone picked up at four in the morning keeps the last line
      instead of being given a pep talk. Add it from the lock screen's widget
      gallery — there is nothing to switch on in Settings.

## Task flow — Date tab

- [x] Today / Tomorrow / Next week now sit under the calendar, and the
      calendar's own "Today" link is hidden there so the word does not appear
      twice a few points apart.
- [x] "No date" removed. **Consequence worth knowing:** a task created without
      touching this row is still undated, but once a date is set the sheet has
      no way to unset it. Say the word if you want a way back.

## Habits and tasks — Time

- [x] One Time row for both sheets (`components/Create/TimeRange.tsx`): a start
      and an optional end. The wheel is on screen the moment the row opens —
      hiding it behind "Set a start time" cost a tap to reach the thing the row
      exists for.
- [x] 15 / 30 / 45 / 1 hour kept; "No length" and "Not set" gone. Tapping the
      length already chosen takes it off, which is what tapping a chosen thing
      should do anyway.
- [x] The chip reads "06:00 → 06:45" rather than a start and a length.

## Profile page

Deliberately rough — the user says it is a work in progress and not worth much
energy yet.

- [x] "Make it yours" and the Details card are gone — nobody else sees your
      theme settings, so they do not belong on the page that shows what others
      see. Birthday and gender went with the Details card; if you want them
      back they belong in Settings.
- [x] Six metrics, streak first, because that is the number people actually
      ask each other about: day streak, momentum, recovery, habits, finished,
      best run. The streak uses the same `streakFrom` as Home and the day card.
- [x] The banner layout from the reference: a wide cover running to both edges,
      the avatar sitting half on it and half off, name, age, habits and bio
      centred beneath. The cover is its own image (`profile_cover`, picked at
      16:9) and falls back to the accent wash the rest of the app is drawn with
      rather than an empty grey rectangle. The bio lost its box — a sentence
      about someone should read as a sentence, not as a filled field — and both
      images can be removed again.

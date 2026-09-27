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
- [ ] Reminders: a real duration before — minutes, hours or days — and
      location triggers in both directions, arriving and leaving.
- [ ] The keyboard still flickers on leaving a create sheet. One attempt has
      been made (`ComposerModal` now outlives `visible` by a slide and
      dismisses the keyboard first); it needs checking on a device to see what
      is still firing.

## Goals

- [x] Tapping a goal opens its chart **in place** — the same chart as the one
      at the top of the page, with ranges and a line you can drag across. The
      card's status line becomes the scrub readout while you drag, so the
      number you are looking for is where you were already looking. Tapping
      again closes it; a long press still opens the full stats page.

## Lock screen

- [ ] Echo speaks hourly: a line on the lock screen, the way there is one on
      Home. (`lib/echoAlive.ts` and the scheduled-activities work are the
      places to start; the Live Activity already renders text.)

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
- [ ] **Still to do:** the banner layout from the reference — a wide header
      image with the avatar overlapping it, name and bio centred beneath. The
      page is currently a left-aligned identity card. Left deliberately, since
      you said this page is a work in progress.

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

- [ ] Look tab: custom icon, a rainbow circle that opens the colour wheel, the
      whole icon collection with search, and drop the preview on the left —
      the "Look" chip already shows the change.
- [ ] Reminders: a real duration before — minutes, hours or days — and
      location triggers in both directions, arriving and leaving.
- [ ] The keyboard still flickers on leaving a create sheet. One attempt has
      been made (`ComposerModal` now outlives `visible` by a slide and
      dismisses the keyboard first); it needs checking on a device to see what
      is still firing.

## Goals

- [ ] Tapping a goal in Goals Progress should show its graph in place, not
      open the goal detail page. The small graph should scrub like the big one.

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

- [ ] Remove "Make it yours" and the Details card.
- [ ] Show exactly what another person sees: avatar over a wide header image,
      name, a line of bio, then the metrics worth showing — streak first.
- [ ] Reference shot: avatar overlapping a banner, name and bio centred, a row
      of actions, then cards below. Keep the Habyss aesthetic rather than
      copying the reference's styling.

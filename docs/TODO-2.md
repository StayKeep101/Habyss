# Open work — round two

From the list of 2026-09-27. Round one lives in `docs/TODO.md`.

Throughout: keep the Habyss aesthetic, push the information-to-space ratio,
and use morphing transitions wherever something changes shape.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Roadmap cards

- [x] A habit or task with a reminder shows a bell on its card — now at every
      card size, including compact, where it had been hidden.
- [x] High priority shows **!!** in red, read instantly in any language. Low
      shows a quiet down-arrow. Normal shows nothing: it is the default, and
      once the other two are marked its absence is the answer.

## Goal creation — the Look tab

- [x] A goal or habit can take your own icon: a picture from the photo
      library, or an emoji typed into the icon search. Both are taught to
      `AppIcon`, which every card, row and chip in the app draws through, so
      they work everywhere rather than only in the picker.
- [x] Redraw the tab in the app's own language — cards, buttons, spacing.
- [x] Colour: a circle of the spectrum at the end of the swatch row opens the
      wheel, in place of a text link reading "Custom color".
- [x] Icons: all 42 on screen with the search always visible, inside a panel
      with a ceiling so the sentence being typed never scrolls away.
- [x] The 48-point preview on the left is gone; the "Look" chip above the
      keyboard already shows the icon and the colour.

## Goal creation — By when

- [x] Swipe-to-change-month removed. The arrows already did it, and a
      horizontal pager inside a sheet that scrolls vertically fights the
      gesture. The grid now morphs to the new month's height, so a five-row
      month no longer jolts into a six-row one.

## Creation flows — the keyboard

- [ ] Leaving a Goal / Habit / Task flow still flickers the keyboard up and
      down. It should fall once, with the sheet, in one motion.

## Habit flow — Repeat

- [x] The **grammar** is built and tested (`lib/recurrence.ts`, 25 tests): every
      N hours / days / weeks / months / years, weekly on chosen days, monthly
      on set dates or on the {first…fifth, last} {weekday, day, weekday-kind,
      weekend}, and yearly with months plus the same ordinal option. It can
      match a date and describe itself in English — "Every 2 months on the
      third Sunday". Intervals count from the habit's start so a fortnightly
      rule never drifts, and the 31st lands on the last day of a short month
      rather than being skipped.
- [x] `createHabitSchedule` reads the rule when a habit carries one, and keeps
      the old weekday reading for habits saved before it. A rule that will not
      parse falls back rather than costing the habit its schedule. Stored in
      schema v12 (`habits.recurrence`), local-only for the same reason as the
      reminder message.
- [x] The picker: seven presets on top — Daily, Weekdays, Weekends, Weekly,
      Monthly, Yearly, Hourly — and each one opens only the detail it needs.
      Monthly offers "Each" with a 1–31 grid or "On the {first…fifth, last}
      {Mon…Sun, day, weekday, weekend}"; yearly offers months plus the same.
      Underneath, one sentence saying what the rule means.
- [x] The chip grows to fit. Its 190pt cap is gone — the row scrolls sideways,
      so "Every 2 months on the third Sunday" is no longer cut to "Every 2
      mont…".

## Reminders — habits and tasks

- [x] "A certain time before", with a real amount: minutes, hours or days
      (`lib/leadTime.ts`). Still stored as minutes, so no migration.
- [x] Location triggers, both directions: arriving and leaving. Tapping a
      place chip turns it round.

## Goal detail

- [x] Background image: laid out at the picture's own proportions, screen-width
      wide, so it is never enlarged — the height comes from the image and the
      screen width, not from a constant per device, and it frames identically
      on every phone. A wide photo now letterboxes rather than crops, which is
      the honest consequence of "no zoom".
- [x] Stats tab: goal name under "Target" removed.
- [x] Roadmap tab: goal name and the date-range line removed.
- [x] Roadmap tab: "+ Habit" and "+ Task" removed.
- [x] Roadmap tab: a **countdown** replaces the sentence — the days left as the
      headline, over a ruler of the whole run where spent marks dim, today's
      mark stands tall, and what is left is lit. It turns amber in the last
      tenth (or last week, whichever is longer) and red once the day has gone.
- [x] Today tab: habit and task buttons removed. Building the plan belongs on
      the roadmap; Today is for what today asks of you.
- [ ] Roadmap tab: moving a task to another day should be the only action.

## Habit detail — redesign

- [x] Keep the Today / Stats split; it works — left alone.
- [x] Units are grouped by what they measure (`lib/unitKind.ts`, 16 tests):
      Volume, Distance, Weight, Money, Time, and Count for anything a person
      names themselves — which is the honest bucket for pages, homeworks and
      sales calls, and gets a plain counter.
      The real fix is that the **buttons now come from the unit, not from the
      size of the number**: a glass of water is 250ml whether the target is one
      or eight, and 500ml no longer offers the same increments as 500 pages.
      A unit the app has never heard of falls back to the target's magnitude.
- [x] The same grouping drives the picker. `UNIT_GROUPS` used to be a
      hand-written list that disagreed with the measurement logic — its
      "Health" group held both kilograms and millilitres. It is now derived
      from `kindOf`, so the tab you pick a unit in and the control you then get
      reason from one answer. The picker is already shared by the Habit and
      Goal sheets.
- [ ] Habit detail: three ways to know a habit is done — HealthKit, manual
      input, timer — and nothing else.

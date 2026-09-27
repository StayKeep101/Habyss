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

- [ ] A goal can take your own icon.
- [ ] Redraw the tab in the app's own language — cards, buttons, spacing.
- [ ] Colour: replace the dropdown with a rainbow circle that opens the wheel.
- [ ] Icons: drop the "more" dropdown. Show the whole collection with search.
- [ ] Remove the icon on the left — the "Look" tab already previews the change.

## Goal creation — By when

- [ ] Remove swipe-to-change-month.

## Creation flows — the keyboard

- [ ] Leaving a Goal / Habit / Task flow still flickers the keyboard up and
      down. It should fall once, with the sheet, in one motion.

## Habit flow — Repeat

- [ ] Rebuild the options so they are actually logical:
      Daily · Weekdays · Weekends · Weekly · Monthly · Yearly · Custom.
- [ ] Custom takes a unit and an interval — every N hours / days / weeks /
      months / years:
      - **Weekly** — every N, on chosen weekdays.
      - **Monthly** — every N, either "on the {first…fifth, last}
        {Mon…Sun, day, weekday, weekend}" or "each" with a 1–31 grid.
      - **Yearly** — every N, months of the year, plus the same ordinal +
        weekday option.
      So: every 2 months on the third Sunday; every 3 months on the last
      weekend; the 27th of each month.
- [ ] The chip above the keyboard must grow to fit whatever the rule reads as,
      however long that gets.

## Reminders — habits and tasks

- [ ] "A certain time before", with a real amount: minutes, hours or days.
- [ ] Location triggers, both directions: when I arrive at, and when I leave.

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
- [ ] Today tab: remove the habit and task buttons.
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

# Timeline rules

How `lib/dayFlow.ts` lays out a day. Two rules, nothing else decides where
anything goes. Tests: `lib/__tests__/dayFlow.test.ts`.

## The rules

1. **Meals and events do not move.**
2. **Everything else goes in this order:**
   - tasks before habits;
   - tasks by **deadline** (soonest first; a task with no "due by" uses the day it is planned for), then **urgency**, then **difficulty**;
   - habits by **urgency**, then **difficulty**.

   Urgency: urgent, normal, not urgent. Difficulty: hard, medium, easy. Still tied: by name, so the order never flips.

## How the line is drawn

These are not rules about order. They only say how the two rules are put on the page.

- The line starts when you wake.
- Each thing starts the minute the one before it ends.
- Something that would run into a meal or event starts when that meal or event ends.
- Something with no length takes 30 minutes.
- The clock never moves anything. It only marks what is **now** (its slot contains this minute) and what is **next** (the first open thing after now).
- Ticking something never moves anything. Done things keep their place in the order.
- Every day is laid out the same way, today included. Opening the app late never changes a start.

## Not used any more

These rules are gone: a given time holding a habit or task, exact time,
best hours, flexible meals waiting, running over, cutting to fit bedtime,
placing from now, and the remembered slots deciding placement.

The settings for them still exist in the habit and task forms, but the line
ignores them for now.

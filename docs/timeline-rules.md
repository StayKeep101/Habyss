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
3. **Exact time stays at its time.** A habit or task set to an exact time keeps that time and shows a lock. Like a meal, nothing is placed on it, but it can still be ticked.
4. **Too long for the time before a block, it splits.** Something that does not fit before a meal, an event or an exact-time thing takes the time that is left before it, and the rest goes straight after. Each part shows "1 of 2", "2 of 2".
5. **Swipe to reschedule.** Pulling a habit or task from left to right (today only, not a meal, an exact-time thing or something done) reschedules it at that minute. It, and everything still open from that minute on, is laid out again from then, in rule 2's order. What comes before that minute stays where it is. Kept for the day on the phone (`lib/reschedule.ts`).
6. **Done early, the next one starts.** A habit or task ticked before its end ends at the tick, and everything still open after it starts from that moment, in rule 2's order. Ticked before it even began, it takes no time where it was, and the next one starts at its start.

Rules 5 and 6 happen in the order of their moments, so a reschedule at 10:00 and a tick at 10:20 each re-lay what is open after them.

## How the line is drawn

These are not rules about order. They only say how the rules are put on the page.

- The line starts when you wake.
- Each thing starts the minute the one before it ends.
- Something with no length takes 30 minutes.
- The clock never moves anything. It only marks what is **now** (its slot contains this minute) and what is **next** (the first open thing after now).
- Ticking something on time or late never moves anything (rule 6 is the only change a tick makes).
- Every day is laid out the same way, today included. Opening the app late never changes a start.

## Not used any more

These rules are gone: a given time holding a flexible habit or task, best
hours, flexible meals waiting, running over, cutting to fit bedtime, placing
from now, and the remembered slots deciding placement.

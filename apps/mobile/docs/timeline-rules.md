# Timeline rules

How `lib/dayFlow.ts` lays out a day. These rules, nothing else decides where
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
5. **Moving by hand.** There is no swipe to reschedule on the timeline (removed 2026-11-03). Hold a habit or task and drag it: let go between two things and it takes that time, exact from then on (with Auto-reschedule on), and the rest of the day lays out around it. A reschedule saved earlier that day (`lib/reschedule.ts`) still counts until the day ends.
6. **Done early, the next one starts.** A habit or task ticked before its end ends at the tick, and everything still open after it starts from that moment, in rule 2's order. Ticked before it even began, it takes no time where it was, and the next one starts at its start.

7. **Nothing that moves goes past bedtime.** When the day is too full, the last habit or task before bedtime is cut short to end at bedtime, with a scissors mark ("cut short from 30 min"). Anything with no room left at all waits under the line in "No room before bedtime". Meals, events, exact-time things and anything already done stay where they are. A bedtime after midnight is that night's.

   A ticked item that has not been settled yet (ticked before it began) moves up with the open ones, so it closes where it is showing, never at a slot it has left.

Rules 5 and 6 happen in the order of their moments, so a reschedule at 10:00 and a tick at 10:20 each re-lay what is open after them.

## How the line is drawn

These are not rules about order. They only say how the rules are put on the page.

- The line starts when you wake.
- Each thing starts the minute the one before it ends.
- Something with no length takes 90 minutes for a task, 30 for a habit.
- With Auto-reschedule off (Settings), the timeline is a plain calendar, like Structured: every habit and task with a time sits at that time for its whole length, ticked or not; exact and flexible mean nothing, so nothing shows a lock and the forms do not ask; rules 2 and 4–7 move nothing. What has no time is not placed: it waits in **Anytime** above the line, by name (tap to tick, long press to open). Urgency and difficulty order nothing, but stay on the cards and in the forms.
- The clock never moves anything. It only marks what is **now** (its slot contains this minute) and what is **next** (the first open thing after now).
- Ticking something on time or late never moves anything (rule 6 is the only change a tick makes).
- Every day is laid out the same way, today included. Opening the app late never changes a start.

## Not used any more

These rules are gone: a given time holding a flexible habit or task, best
hours, flexible meals waiting, running over, placing
from now, and the remembered slots deciding placement.

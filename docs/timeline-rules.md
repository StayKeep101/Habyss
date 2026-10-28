# Timeline rules

How `lib/dayFlow.ts` lays out a day, written as the rules it follows today.
Every rule has a number so a change can name what it replaces. The section
at the end lists where two rules disagree.

Times are minutes from midnight. "Now" is only known for today; any other
day is laid out with no now.

## 1. What goes on the timeline

| Kind | What it is | Moves? |
| --- | --- | --- |
| Fixed | Meals (Settings → Timeline) and calendar events | Never |
| Exact time | A habit or task with "exact time" on (`locked`) | Never |
| Flexible | Every other habit or task, with or without a time given | Yes |
| Done | Anything ticked today | Never, once ticked |

## 2. Walls and lengths

- **R2.1** Waking and bedtime are walls. Nothing is placed before waking or after bedtime.
- **R2.2** Something pushed past bedtime is fitted again inside the day.
- **R2.3** When the day is too short, the last flexible thing is cut to the time left, never below 10 minutes (`MIN_CUT`). It shows scissors.
- **R2.4** What still has no room is listed under the timeline as "no room". Nothing is moved to another day.
- **R2.5** Something with no length takes 30 minutes (`DEFAULT_MINUTES`).
- **R2.6** No breaks: the next placed thing starts the minute the last one ends (`breakAfter = 0`).

## 3. Fixed blocks

- **R3.1** Meals and events stay at their time and never shift.
- **R3.2** Nothing overlaps them. Whatever would land on one is pushed to its end.
- **R3.3** Flexible meals (setting): only when the day cannot fit everything, a meal may wait 15 minutes at a time, up to 2 hours (`MEAL_DELAY`). The wait that leaves the least cut or unfit wins.

## 4. Exact time

- **R4.1** It stays at its time, done or missed, and is "now" while it lasts.
- **R4.2** Flexible things are fitted around it, the same as a fixed block.

## 5. Done

- **R5.1** A done thing never moves.
- **R5.2** Its slot is its own time if it has one, else where it was planned just before the tick, else where it was last shown.
- **R5.3** Finished partway through (Study 3–5, done at 3:30): it keeps its start and ends at the tick. The rest of its slot goes to what is next.
- **R5.4** Ticked before its start: it takes no time and sits where it was planned when ticked (7:30–7:30). It never jumps to the tick time.
- **R5.5** Never placed and nothing known: it ends at the tick time.

## 6. Order of flexible things

- **R6.1** They are placed one at a time, in this order, each rule deciding only when everything above is tied:
  1. tasks before habits;
  2. more urgent first: urgent, normal, not urgent (overdue or a deadline within a day or two counts as urgent);
  3. harder first: hard, medium, easy;
  4. finer urgency (how overdue, how close the deadline);
  5. the time it was given (earlier first);
  6. the longer one first;
  7. the name.
- **R6.2** Best hours (learned by Echo): a hard thing goes into them while they are still ahead. Everything else takes the first free place.
- **R6.3** A flexible thing's own time only orders it (R6.1.5). It never holds it at that time. This applies the same on every day.

## 7. Where flexible things start

- **R7.1** Another day (tomorrow, or later): placed from waking, by R6.
- **R7.2** Today: whatever has not begun is placed from now, rounded up to 5 minutes.
- **R7.3** The first one can start up to 10 minutes early (`EARLY`). If it is due within 10 minutes, it starts now instead.
- **R7.4** "Begun": a flexible thing, not done, whose anchor is at or before now. The anchor is where it was placed today (R8), else the time it was given.
- **R7.5** Of everything begun, one is "the one you are on": the one being focused on, else the first by R6.
- **R7.6** The one you are on keeps its start and runs past its end until it is ticked.
- **R7.7** It stops at the next fixed block that begins inside its time. If that block has already begun, it is fitted again after the block.
- **R7.8** Anything else that had begun is fitted again from now and gets a dot ("moved").

## 8. What the day remembers

- **R8.1** Where each thing was placed today is saved on the phone (`kept`), and so is where each done thing was just before its tick (`planned`). Both reset each new day.
- **R8.2** A dot marks something pushed 10 minutes or more later since it was last seen (`MOVE_MINUTES`). Moving up because something finished early is not a move.
- **R8.3** A remembered slot that ends before waking is ignored. It came from a layout built before the day loaded.

## 9. Notices

- **R9.1** The plan alert fires 10 minutes after something should have ended (`GRACE`).

---

## Conflicts to settle

**C1. Opening the app late pushes the start** (R7.2 against what the timeline promised).
Yesterday, tomorrow's plan showed Answer mom at 9:00. Nothing is remembered for a new day (R8.1), so opening at 9:12 places it from now (R7.2). It reads 9:12–9:42.

*Proposed:* the first time today is opened, it is laid out from waking, as it was shown the day before (R7.1). Anything whose planned start has passed keeps that start (R7.6), and only its end gives. After that first look, R8 holds the day, and something new is placed from now.

**C2. The time given to a flexible thing is both "only an order" and "an anchor"** (R6.3 against R7.4).
R6.3 lets Fix 50 bugs, given 1 PM, move to 11:30. R7.4 still uses that same 1 PM as its start once 1 PM has passed, so Study given 4 PM reads "4:00 onwards" at 4:42 even if the plan had it at 2.

*Proposed:* a flexible thing's anchor is only where the plan placed it (R8, or the first-look plan from C1). A given time is never a start, only an order. Something that must start at a time uses exact time (R4).

**C3. How long can "the one you are on" run over?** (R7.6 with C1).
With C1, opening at 3 PM with nothing done would show the 9:00 task running over for 6 hours.

*Proposed:* it holds its start only while it is within its own length plus 10 minutes (`GRACE`). Later than that, it counts as missed: it is fitted again from now, with the dot. A session you actually started (Focus) always holds.

**C4. Leftovers from the old timed layout** (`flowTimed`: `CHAIN_GAP` of 15 minutes, "late pushes, early only pulls a chain").
Flexible things no longer go through it, apart from the one you are on. These rules now apply almost nowhere and make the code harder to follow.

*Proposed:* remove them once C1 to C3 are in.

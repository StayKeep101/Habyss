# Echo — how the coach works

Echo is on-device and deterministic first. Every number it shows is counted in
`lib/` from the same habits, tasks and check-ins every screen reads; the
on-device model (Apple Intelligence, when ready) is only ever asked to *word*
a first step, and its answer is checked before use. Nothing runs in the
background: insights are computed when a screen opens, from data already in
memory, so Echo adds no queries, timers or network calls.

## What already existed (kept as is)

- Voices: Friendly, Normal, Dad Mode, Bully Mode (`constants/AIPersonalities.ts`).
  For coaching they map to supportive / direct / challenging (`lib/echoInsights.ts`).
- Lines on Home and the lock screen (`lib/echoLines.ts`, `lib/echoLockScreen.ts`),
  morning and evening check-ins, Echo Alive, model-written reminders (`lib/echoWriter.ts`).

## What was added

| Piece | Where | What it does |
|---|---|---|
| Insights | `lib/echoInsights.ts` | Never-miss-twice, stuck tasks, heavy days (against what this person usually finishes), slipping habits, goals with no steps, real wins, weekday/weekend patterns. Each carries its evidence; nothing is produced without enough data. |
| Memory | `lib/echoMemory.ts`, `app/(root)/echo-memory.tsx` | Notes the person told Echo vs patterns Echo noticed (with evidence). All visible, editable, deletable; "Forget everything". On this phone only. |
| Learning what helps | `lib/echoMemory.ts` (`recordHelp`, `settleHelps`, `helpRanking`) | Each two-minute start, five-minute session or plan is logged, then marked done/not from the record. The help that has worked is offered first. |
| Weekly review | `lib/weeklyReview.ts`, `app/(root)/week-review.tsx`, `lib/weeklyReviewNotice.ts` | Kept rate vs last week, what held, what got harder, bounce-backs, obstacles, at most two things to try. One optional notification on the week's last evening. |
| Experiments (logic only, no screen now) | `lib/echoExperiments.ts` | 7-day tests (earlier time, or a smaller target) for a slipping habit. Applied only after confirmation; baseline = the habit's last 14 days; verdict states its uncertainty; "Go back" restores the habit exactly. |
| Safety | `lib/echoSafety.ts` | Clear statements of crisis in anything typed to Echo replace coaching with a calm message and 988 / emergency numbers. No diagnosis. |
| Energy | `hooks/useEchoCoach.ts` | Today's energy answer (pull-down question); low energy lowers the bar (heavy-day threshold, smallest-version wording). |
| Easter eggs | `lib/echoEggs.ts`, `components/Echo/EggPopup.tsx` | About one Home visit in eight (at most daily) Echo's line is a door: help a friend (send a streak freeze), a memory, or the vault (secret words, collected on the Echo page). |
| Quick questions | `lib/checkIns.ts`, `components/Echo/CheckInPopup.tsx` | After a pull down on Home, sometimes "How's your mood / energy?". When to ask is learned from answers vs dismissals and the hours answers come. |
| Mood & energy | `lib/moodEnergy.ts` | Daily averages, week vs last week, kept rate on high- vs low-energy days (only with 3+ of each), best time of day. Feeds Echo's energy. |
| Streak freezes | `lib/streakFreeze.ts`, migration `20261018000100` | Gifted by friends (friends only, once a week each, 5 max, server-enforced); one covers a missed yesterday automatically. |

Entry points: Echo's line on Home (tappable only when it is an easter egg,
"✦ tap me"), pull down on Home for questions, Settings → Echo → Coaching
(What Echo remembers, Your week), and your own profile (streak freezes,
private). The Echo page (insights, Can't start?, experiments, mood & energy)
was removed at the user's request; its logic in `lib/` stays, unused by any
screen.

## Limits, on purpose

- No chat. Echo leads to actions, not conversations.
- Patterns are correlations from the person's own record; experiments say
  "a hint, not proof".
- A goal's deadline penalty and experiments on boolean habits without a
  time are not handled (no honest, simple change to propose).
- `lib/aiAgentService.ts` is left from a removed chat; only
  `normalizeAIPersonality` is still used.

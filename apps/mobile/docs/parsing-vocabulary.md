# What a sentence can set

Every setting a habit, a task or a goal has, and the words that set it when typed
or said. The parsers take each phrase out of the name, so "Gym right after work,
45 min" becomes a habit called **Gym**.

Where each phrase is read:

- `lib/habitParser.ts`, `lib/taskParser.ts`, `lib/goalParser.ts`: one per kind.
- `lib/dateWords.ts`: dates, deadlines, priority, difficulty and timing, shared by all three.
- `lib/settingWords.ts`: link, reminder, tracking, goal and subtasks.

Tests: `lib/__tests__/settingWords.test.ts` and each parser's own test file.

Phrases are read in a fixed order:

1. reminder, tracking and goal;
2. deadline and start date;
3. link;
4. priority, difficulty and timing;
5. days and times;
6. lengths and amounts.

Reminders are read first so that "remind me 10 min before" is never read as a
10-minute habit, and "remind me at 8pm" is never read as its time.

## Habit

| Setting | Said as |
|---|---|
| **Days** | every day, daily, each day · weekdays, workdays, Monday to Friday · weekends · Mon, Wed and Fri; Mondays · every other day · 4 times a week, twice a week (any days) · once a month · the last Sunday of each month · weeknights |
| **Times a day** | 3 times a day, twice daily, morning and night · **every 2 hours** (8 times across a waking day) |
| **Time** | at 7, at 7am, 7:30 pm, 19:00 · at seven thirty · in the morning, each morning, every night (08:00, 14:00, 19:00, 21:00) · at the end of each day · **now** or right now (this minute, kept there) |
| **Length** | 20 minutes, 1 hour, 90 min, an hour, for 45 min · from 7 to 8am, between noon and 2pm |
| **Anytime** (no set hour) | anytime, any time of day · whenever, whenever I can · sometime, sometime today · at some point · no set time · when I'm free · flexible, roughly, around |
| **At its exact time** | sharp, exactly, precisely, on the dot, on time, set time, fixed time, not flexible, no matter what |
| **Link** (right before or right after) | right after work · just before my class · straight after Gym · immediately after dinner · as soon as I finish work · once I get back from school · when I get out of Accounting · after my run · before the meeting · after each meal · after lunch / before Accounting (any event, meal, habit or task the day has) |
| **Amount** | 20 pages, 8 glasses, 50 push-ups, 5 km, 10,000 steps, ten minutes · 8 times |
| **Reminder** | remind me 10 min before · notify me an hour ahead · remind me half an hour before · with a 15 minute heads-up · remind me at 8am · reminder at 9:30 pm · remind me (10 min before) · Remind me to … (at the start) · no reminder, don't remind me |
| **Tracking** | from Apple Health · with my Apple Watch · on Strava, Bevel, Oura, Whoop, Garmin, Fitbit, Hevy, Strong, Peloton… (Health) · on Libby, in Kindle, using Audible, in Duolingo, in the Calm app… (time in apps) · at the gym, at the library, in the pool, at the park… (time at a place) · auto-track it, track it automatically |
| **Goal** | for my Marathon goal · towards the Marathon · part of Fitness · under Business · counts towards Launch |
| **Importance** | urgent, ASAP, high priority, top priority, must-do, crucial, essential, time-sensitive, important, !! · low priority, no rush, not urgent, if I have time, nice to have, optional, someday, on the back burner, eventually |
| **Difficulty** | hard, difficult, tough, challenging, brutal, intense, hardcore, demanding, gruelling, heavy · easy, simple, light, chill, low effort, no-brainer, piece of cake, quick win · medium, moderate |
| **Starts** | starting January 1, from Monday, beginning tomorrow, as of next week |
| **Ends** | until Friday, until Dec 1 · for 30 days, for 2 weeks, for the next 3 months |
| **Breaking a habit** | Avoid…, Quit…, Stop…, No…, Don't…, Never…, Limit…, Cut out…, Give up…, Stay off… |

Set only in the sheet, never from words: the look (icon and colour), notes, and
the exact place on the map for a place reminder or place tracking. A place that
is named ("at the gym") chooses Place in Tracking, and the map then asks where it is.

## Task

| Setting | Said as |
|---|---|
| **Day** | today, tonight, tomorrow, tmr, the day after tomorrow · Friday, next Monday, this Saturday · Dec 5, 5 December, 12/5 · in 3 days, next week · "Tuesday, wait, Thursday" (the last one counts) |
| **Time** | at 3, at 3pm, 15:30, at four thirty · noon, midnight (the end of the day) · morning, afternoon, evening, tonight · **now** or right now |
| **Window** | from 2 to 4pm, 2–3:30pm, between noon and 5 PM |
| **Length** | 30 min, 2 hours, 1h30, an hour and a half |
| **Deadline** (must be done by) | due Friday, due by Dec 5, by Monday, before next week |
| **Anytime / exact** | the same words as for a habit (above) |
| **Importance** | the same words as for a habit (above) |
| **Difficulty** | the same words as for a habit (above) |
| **Steps** (subtasks) | Groceries: milk, eggs and bread · Trip — book flights, pack, get cash · steps: draft, edit, send · checklist: boxes; tape; van |
| **Reminder** | the same words as for a habit (above) |
| **Goal** | the same words as for a habit (above) |
| **Amount** | 20 pages, 3 emails (counted), 2 hours (timed) |

Set only in the form: notes, section, the place on the map.

## Goal

| Setting | Said as |
|---|---|
| **Kind** | an amount ("2000 calls", "50 km"), a project to finish ("Launch Habyss by Jan 1"), time put in ("100 hours of piano") |
| **Target and unit** | 50km, 10k dollars, 100 hours, 75 kg, 20 books · units normalised (kilometres → km, hrs → hours) |
| **Direction** | at least (the default) · no more than, at most, under, less than, limit (for example "no more than 1 hour on TikTok a day") · reach, get to, down to (a value to arrive at, such as a weight) · lose 5 kg (a change from where you are) |
| **Period** | a day, a week, a month (recurring) · this month, next week, next year · by Christmas, by Dec 1, in 90 days (a fixed end) |
| **Start** | from today unless said · starting next month |
| **Where you are now** | asked once when it is needed ("what do you weigh now?") |
| **Linked habit** | matched by meaning to a habit you already have, or one suggested |

A goal the words can't make measurable ("read more") is never saved vaguely.
Echo asks one question instead.

## Adding a phrase

1. Add the words to the reader that owns the setting (see the top of this page).
2. Add a test with the sentence as people type it, including a sentence that must
   **not** match (for example, "before 9 AM" is a time, not a link).
3. Add the phrase to the table above.

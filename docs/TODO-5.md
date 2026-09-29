# Open work — round five

From the list of 2026-09-30. Rounds one to four are in `docs/TODO.md` …
`docs/TODO-4.md`; anything still open there is still open.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Broken

- [ ] **Edit goal freezes the whole app.** Console shows
      `[com.apple.CFNetwork] SocketStream write error 1 32`.
- [x] `No route named "create"` — a `Stack.Screen` for a file deleted long ago.
- [x] `InteractionManager has been deprecated` — `lib/afterPaint.ts` wraps
      `requestIdleCallback`, which returns a bare number and has no `cancel`, in
      the shape the effects already returned. It carries a 500ms deadline
      because an idle callback is allowed never to fire while a screen keeps
      animating, and a goal's progress that is never calculated is worse than
      one calculated a frame early.
- [x] `HALC_ProxyObjectMap ... there is no system object` — Home claimed a
      CoreAudio session on **every mount**, for sound effects that are not
      bundled. Nothing claims one now until a sound that will actually play is
      played.

## The day, as a card people can react to

- [ ] A card each day showing what somebody **said they would do** and what they
      **actually did**, for friends to see and react to. The feed has the second
      half; the promise is the missing part.

## Creation flow — habits, and then tasks and goals

- [ ] Time: a real end time, with 15 / 30 / 45 / 1 hr as shortcuts to it.
- [ ] Reminder: at the start time, a **wheel** for how long before (days, hours,
      minutes), and arriving at / leaving a place.
- [ ] Look: more icons.
- [ ] Notes: the keyboard opens with the row.
- [ ] Repeat: one option visible at a time on a wheel — Daily, Weekdays,
      Weekends, Weekly, Monthly, Yearly, Hourly — rather than every option at
      once. Monthly and Yearly "on the" becomes **two wheels side by side**.
- [ ] The same Time and Notes rows on a task; the same Notes row on a goal
      ("Why it matters").

## Shared habits and tasks

- [ ] The card shows the profile picture of everybody who has access to it.
- [ ] It is not complete until **all of them** have completed it. (Asked for
      twice now; the streak question is the part to settle — see below.)

## Text

- [ ] The goal sentence parser needs to read more of what people write.

## Community

- [ ] Replace the spinning Habyss logo with an ordinary spinner.
- [ ] A friend's profile should be the page you see for yourself.
- [ ] Inbox: swipe left to delete a notification.
- [ ] Show the **profile name**, not the username, when inviting or viewing.

## Home

- [ ] Drop the notification icon — it lives on Community now.
- [ ] Echo's line moves up beside the profile picture.
- [ ] A red dot on the Community tab when something has happened.

## Habit detail

- [ ] Stats: the heatmap only, from the day the habit was made, respecting how
      often it actually repeats.
- [ ] Today: drop the streak / consistency / check-ins row.
- [ ] Swipe left and right between Today and Stats.

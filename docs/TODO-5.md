# Open work — round five

From the list of 2026-09-30. Rounds one to four are in `docs/TODO.md` …
`docs/TODO-4.md`; anything still open there is still open.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Broken

- [~] **Edit goal freezes the whole app.** Not reproducible from here, so two
      plausible causes were removed rather than one confirmed:
      1. It emitted `show_goal_quick_add`, which raises the sheet mounted at the
         *root* — and goal-detail is itself a modal route. The habit sheet on
         that same screen has always been mounted locally; the goal was the one
         that got away. It is local now.
      2. Opening it to edit fills the field with the goal's own title, which
         woke the on-device model 650ms later to re-read a sentence whose answer
         both sheets then throw away. `useSmartParse` is no longer even
         scheduled for text the user has not touched.
      The `SocketStream write error ... 1 32` is EPIPE on the dev server's
      socket — a symptom of the JavaScript thread having stopped answering,
      not the cause. **Say if it still freezes.**
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

- [x] The card shows everybody's face, overlapping, always on the row rather
      than behind a tap — the point of sharing is seeing who is holding it up.
      A ringed face has done their half. Deliberately not a count: "3 people"
      tells you nothing you can act on; a face tells you whom to message.
- [x] It is not complete until **all of them** have completed it. The row reads
      as finished only when nobody is being waited on.
      **What I did not change, and you should overrule me if you disagree:**
      your own tick still counts for your own streak. The row's *claim* is
      shared; your record is not. One friend's quiet week ending a streak you
      kept perfectly is a much heavier promise than it sounds, and it should be
      a decision taken on purpose rather than one that arrives with a feature.

## Text

- [ ] The goal sentence parser needs to read more of what people write.

## Community

- [x] The spinning logo is an ordinary spinner. A brand animation is not what
      waiting is for.
- [ ] A friend's profile should be the page you see for yourself.
- [x] Inbox: swipe left to clear. An **open friend request** deliberately has
      no swipe — it is answered, not swept away, and the buttons are the reason
      it is there.
- [ ] Show the **profile name**, not the username, when inviting or viewing.

## Home

- [x] The Home bell is gone — **and so is the second inbox behind it**. It
      opened a separate list of the app's own notifications, so there were two
      places to check "did anything happen" and the answer was split between
      them. They are one list now, in Community.
- [x] Echo's line sits beside the ring, in the room the bell left.
- [x] A red dot on the Community tab. It lives in the dock, which is the one
      component on screen whatever anybody is doing, so it appears the moment
      something arrives rather than the next time that tab is opened.

## Habit detail

- [ ] Stats: the heatmap only, from the day the habit was made, respecting how
      often it actually repeats.
- [ ] Today: drop the streak / consistency / check-ins row.
- [ ] Swipe left and right between Today and Stats.

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

- [x] The day card now names things rather than only counting them: what the
      two of you are doing together, ticked as they do it, with where *you*
      stand on the same thing beside it — so the row is about the pair of you
      rather than about them. Reactions and notes were already there.
      **The limit, and it is deliberate.** Only habits actually shared between
      you appear by name. A friend's other habits are none of your business, and
      the fact that the server *could* report them is exactly the reason it
      does not.
      If you want every habit named in the feed, that is a privacy decision to
      take on purpose, and it changes what `friend_stats` is allowed to return.
- [x] **It is the whole day now, not the third of it that is habits.**
      `friend_stats` counted habit completions only, so a card meant to show
      somebody's progress showed a third of one — and tasks are most of what a
      day in this app actually is. It returns tasks done, tasks due, goals
      active and goals moved; the ring counts habits and tasks together, and
      the card draws the three strands under it as bars.
      **Goals are reported as *moved today*, not as a percentage.** A goal's
      progress is worked out in the client from weights and history;
      reproducing that in SQL would give two answers to one question and the
      server's would be the wrong one. A bar that barely moves in a day is also
      a bar nobody reads, where "2 goals moved" changes daily.
      **A strand nobody reported is left off rather than drawn at zero.** An
      older server and a friend who has turned progress off both send nothing,
      and "no answer" must not read to their friends as "did none of it". The
      sharing switch is enforced inside `friend_stats` itself: hiding something
      in the client while the server still hands it over is not privacy, it is
      decoration.
- [x] **Shared tasks actually work now**, which they did not. `useSharedItems`
      asked `shared_habits` about every id it was given, so a task id found
      nobody — which reads as "not shared" rather than as a wrong question, and
      a shared task completed on one person's tick. It takes a kind; ticking a
      task publishes and announces the way a habit does; "shared only" filters
      tasks as well as habits.

## Creation flow — habits, and then tasks and goals

- [x] Time: a real end time on its own, with 15 / 30 / 45 / 1 hr as shortcuts
      to it. Stored as a **length**, so a habit that moves keeps how long it
      takes rather than when it used to finish, and an end before the start
      reads as the next day rather than a negative length.
- [x] Reminder: two wheels, how much and of what, reading left to right as the
      phrase they make. Nineteen chips across three units wrapped onto three
      lines and stopped being a control — and there is room on a wheel for the
      ordinary answers, so "40 minutes before" no longer rounds to 45. Arriving
      at and leaving a place were already there.
- [x] Look: 42 icons became 100, every one checked against the font. Chosen
      because somebody would plausibly make a habit of each — a picker holding
      every glyph in Ionicons is one nobody can find anything in.
- [x] Notes: the keyboard opens with the row — on a habit, a task, and the
      goal's "Why it matters".
- [x] Repeat is a wheel. `components/Common/Wheel.tsx` is a ScrollView rather
      than a native picker: there is none in this project's dependencies,
      adding one means a native rebuild for forty lines of snapping, and two
      ScrollViews will agree about their height where two `UIPickerView`s make
      it surprisingly hard. Rows are **tappable as well as turnable**, which is
      what a UIPickerView does and the only way somebody using a screen reader
      can reach a row. "On the" is two wheels side by side, reading as the
      phrase they make: the / third / Sunday.
- [x] The same Notes behaviour on a task and a goal. The task Time row already
      shares `TimeRange`, so the end time arrived there with it.

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

- [x] **A rail of faces across the top.** The feed showed about one and a half
      cards on a phone, so with a dozen friends "who is about today" cost a
      dozen scrolls. Each face is ringed by that person's day, and tapping one
      takes the feed to their card — which is what earns the vertical space. A
      rail you can only look at is decoration.
      **Ordered by who needs you, not by who is doing best.** Somebody waiting
      on your half of a shared habit is the one fact on this screen you can act
      on; sorting by achievement would bury them behind whoever tracks the
      least demanding things, which is the leaderboard's failure rebuilt
      smaller. The only badge is that — not a streak and not a score, because
      those say how somebody is doing and this says there is something only you
      can do. You are always last: it is a list of other people.
      The line above the feed reads "2 people are waiting on you" when that is
      true, and how the group is going when it is not.
- [x] The spinning logo is an ordinary spinner. A brand animation is not what
      waiting is for.
- [x] A friend's profile is the page you see for yourself —
      `components/Profile/ProfileView.tsx`, rendered by both. The only
      difference is whether the fields can be typed in, and read-only is not a
      greyed-out version of editable: the camera badges and "Add a cover image"
      belong to whoever owns the page, and showing them to a friend would be
      offering something they cannot have.
      **The numbers differ, and honestly.** Yours are momentum, recovery and
      the rest, all worked out from habit history only you can read. A friend's
      are the ones `friend_stats` actually returns: streak, done today, habits.
      Showing them zeros for the others would be worse than showing three real
      numbers.
- [x] Inbox: swipe left to clear. An **open friend request** deliberately has
      no swipe — it is answered, not swept away, and the buttons are the reason
      it is there.
- [x] The name from your profile is what friends see. It had only ever been in
      AsyncStorage, so everybody was shown a handle and the name somebody wrote
      for themselves was visible only to them. `profiles.display_name` is a
      **second column, not a rename**: a username is the address — unique,
      lowercase, how somebody is found — and a name is what a person is called.
      Both travel; the interface picks, and the handle stays visible under the
      name so it can still be typed by somebody looking for you.
- [x] **The profile picture travels.** It had been a local `file://` URI, which
      means nothing to anybody else's phone. It is uploaded to the `avatars`
      bucket and the public URL is what `profiles.avatar_url` carries, so a
      friend sees the picture on their card, on the rail and on your page.

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

- [x] Stats: the heatmap only, from the day the habit was made. Everything
      before the start date is **left out** rather than drawn as an empty
      square, so a habit made last week no longer opens on eleven months of
      blanks that read as eleven months of failure. Days it was never due were
      already drawn differently from days it was missed.
- [x] Today: the streak / consistency / check-ins row is gone.
- [x] Swipe left and right between Today and Stats. Horizontal only — a
      vertical drag goes to the page, so scrolling never changes the tab.
- [ ] **Consequence:** `HabitGraphRenderer` is now unreachable. It is a real,
      tested chart with a stored `graphStyle` behind it, so it has been left in
      place rather than deleted — say if it should go, or come back somewhere.

## Still open

- [ ] **The goal sentence parser needs to read more of what people write.**
      The one item on this round's list that has not been touched.
- [ ] `HabitGraphRenderer` is unreachable since Stats became the heatmap alone.
      A real, tested chart with a stored `graphStyle` behind it, so it has been
      left in place rather than deleted — say if it should go, or come back
      somewhere.
- [ ] **Native warnings are fixed but unverified.** No installed simulator
      matches the iOS 27 deployment target — every one here is 18.5 — so the
      app target cannot be built on this machine. The WidgetExtension builds
      clean. This needs a run on your device to confirm.
- [ ] Keyboard flicker on sheet exit. Needs a device to see.
- [ ] Messaging between friends. Deliberately not faked with a stub.
- [ ] `pacts` and `ember_ledger` are still on the server, empty and unused by
      any build. Say the word and they go.

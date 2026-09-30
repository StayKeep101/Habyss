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
- [ ] **Still device-only: the profile picture.** `profiles.avatar_url` exists,
      but the app stores a local `file://` URI, which means nothing to anybody
      else's phone. Showing a friend your picture needs the image uploaded to
      storage first — a real piece of work, not a line.

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

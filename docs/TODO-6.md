# Open work — round six

From the lists of 2026-09-30. Earlier rounds are in `docs/TODO.md` …
`docs/TODO-5.md`; anything still open there is still open.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Fixed

- [x] **Red screen on every tap in the appearance tab.** Two of the hundred
      icons were both `sunny-outline`, which React reports as a duplicate key.
      A test now reads the catalogue from source and asserts no name repeats and
      every one is a glyph Ionicons actually has.
- [x] **A buzz that cannot happen became a red screen.** `useHaptics` dropped
      every `Haptics.*Async` promise, and a dropped rejection is an *unhandled*
      one, which React Native raises as a red box — so on hardware with no
      haptic engine an ordinary tap became a crash report. Four direct calls in
      EditProfileModal and AddFriendModal had the same fault plus a second one:
      they buzzed for somebody who had turned haptics off.
- [x] **The brightness slider stopped part way across.** Its width was the
      constant 160 inside a row as wide as the sheet. It is measured now, and
      the thumb's own width comes out of the travel so both ends are reachable
      and it no longer hangs half off the bar.
- [x] **The multicolour tick was lopsided.** It was pushed over the gradient
      with `absoluteFill`, which stretches a text glyph across the whole box.
      The gradient is the absolute layer now and the tick sits on a dark disc —
      no single colour reads on a rainbow. Plain swatches take black or white
      by contrast rather than always black, which vanished on the indigo one.
- [x] **Profiles never reached anybody.** Three reasons, each enough alone:
      Edit profile wrote the AsyncStorage keys by hand and so never called
      `pushProfile`; the backfill ran before Supabase had restored the session
      and so found nobody signed in, every launch, forever; and the upload used
      `fetch('file://…').arrayBuffer()`, which on React Native resolves *empty*
      rather than failing — a zero-byte picture nothing reports.
- [x] **Asking again after a refusal did nothing, silently.** A declined row
      still existed, so every later attempt found it and returned success. That
      pairing was permanently impossible and neither side could tell.
- [x] **The invitation arrived twice** — once as an answerable card, once as a
      notification saying the same thing.
- [x] **Goals were not offers at all**: inserted as `accepted`, announced to
      nobody.
- [x] **No push could ever be delivered.** The token went to AsyncStorage and
      nothing even called the registration. `profiles.push_token` and a trigger
      on `notifications` that posts through pg_net, server-side so no phone can
      read its friends' tokens.
- [x] **Accepting a share put the habit nowhere.** It changed a status and
      stopped. `adoptShared` copies it over with the owner's id, which is what
      both sides publish completions against.
- [x] **The goal chart cleared the instant you let go**, so the only way to read
      a value was to hold a finger over it.
- [x] **Habit detail swapped tabs on release** rather than following the finger.
      Both pages are one strip now.
- [x] `--:--` for a habit with no time. A placeholder shaped like a clock
      reading nothing, where plenty of habits have no time on purpose.
- [x] The heatmap heading ran into its own count, and the count was "/ year" for
      a map that starts the day the habit was made.

## Changed

- [x] **A bottom sheet exists.** `components/Layout/VoidSheet.tsx`. Everything
      used `VoidModal`, a UIKit page sheet, so asking which two friends to share
      with took the whole phone and hid the habit being shared.
- [x] **Sharing is in all three creation flows**, held until the item has an id.
- [x] **The share sheet's paragraph is gone** — it said "nobody is sent an
      invitation", which stopped being true — and the rows show pictures and
      chosen names.
- [x] **Filters**: no more "All", "Any", "Any goal" or "Everything". Choosing
      what is chosen turns it off. Tasks are filterable. "Tap again to reverse"
      is gone.
- [x] **Faces appear the moment you share**, dimmed with a dotted ring until
      answered — and deliberately not counted, or an item would be impossible
      to finish until a friend replied.
- [x] **A friend's day shows names**, up to five of today's tasks, behind its
      own sharing switch.
- [x] **The rules are written down** — `docs/SHARING.md`.

## Still open

- [ ] **The widgets.** Untouched on purpose: another agent has thirteen
      uncommitted files across `ios/Widget/*`, `lib/widget*.ts` and the widget
      tests, all modified today. Editing them would overwrite work in progress.
      What was asked for: one widget listing three to five of today's tasks,
      tappable to complete; one showing the heatmap of a chosen habit; one
      showing goal progress for all goals or a chosen one.
- [ ] **Habit detail, the Today page.** The heatmap heading and the swipe are
      fixed; the page itself is still a large ring, a loud button and a lot of
      empty space below. Worth doing, but it is a redesign rather than a repair
      and the shape of it should be agreed first — the streak row that used to
      fill that space was removed on purpose in round five.
- [ ] The goal sentence parser still needs to read more of what people write.
- [ ] `HabitGraphRenderer` is still unreachable.
- [ ] Native warnings remain unverified: no simulator here matches the iOS 27
      deployment target, so the app target cannot be built on this machine.

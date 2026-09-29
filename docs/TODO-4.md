# Open work — round four

From the list of 2026-09-29: the charts, read the way a finance app's are.

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Charts you read with your finger

- [x] **The streak page** (`app/(root)/progress.tsx`). The month's bars are now
      scrubbed rather than looked at: the day under the finger lights up, a
      crosshair follows it, and the date and the day's tally are written above
      the chart as you move. Lifting opens that day's card, which grows out of
      the bar you released on.
- [x] **Momentum** (`components/Home/MomentumModal.tsx`). Same gesture, same
      readout. The habit-by-habit panel underneath waits for the finger to lift
      before it opens — its contents are a list, and re-rendering a list thirty
      times across one flick is what makes a drag feel cheap.
- [x] **Goal progress** (`components/Goal/GoalProgressChart.tsx`) — the reset
      while dragging is fixed. See below; it was not a drawing problem.

## Why the goal chart kept resetting

It used React Native's **responder system** (`onResponderMove`). A ScrollView
can take the responder away from a child mid-gesture, and when it does, the
child gets `onResponderTerminate` — which the chart handled by clearing the
crosshair. That is the bar jumping back to today while a finger was still on it.
`onResponderTerminationRequest: () => false` is a request, not a veto.

It is a `Gesture.Pan` now, with `failOffsetY` giving vertical movement to the
page and `activeOffsetX` keeping horizontal movement for the chart, so neither
has to take anything from the other. `shouldCancelWhenOutside(false)` means
sliding above or below the chart keeps reading it, the way a portfolio does.

## How the smoothness is actually achieved

Worth writing down, because it is the part that is easy to undo by accident.

- **Nothing calls `setState` while the finger moves.** The crosshair, the dot,
  the lit bar and the readout text all animate from shared values on the UI
  thread. A drag across a whole month is zero React renders.
- Text cannot be set from a worklet, so the readouts are read-only `TextInput`s
  whose `text` prop Reanimated writes directly (`components/Common/ScrubReadout.tsx`).
  Everything they can say is handed over as an array up front; the worklet picks,
  it never formats — formatting a date on that side would be slow and would
  ignore the phone's own idea of how a date reads.
- The lit bar under the finger is **unanimated on purpose**. A 200ms ease would
  always be trailing where the finger actually is. The *pinned* bar, chosen by a
  tap, still animates.
- A tap and a drag are told apart (`onStart` only fires on activation), because
  the bars are also buttons: a release handler that could not tell the difference
  would reopen every day a tap had just closed.
- The slot arithmetic accounts for the gaps between bars (`hooks/useScrub.ts`,
  14 tests). Dividing the width by the number of bars walks the mark off the bar
  it names — about a point by the end of a month here, more wherever the gaps are
  wider or the bars fewer.

## Not done

- [ ] The habit detail graph (`HabitGraphRenderer`) is still tap-only. It was not
      on the list; say the word and it takes the same treatment, since the hook
      and the readout are now shared.

# Tracking engine

## Inputs and states

The native adapter delivers UTC milliseconds, monotonic uptime milliseconds, aggregate system idle duration, foreground application bundle/name/PID, optional AX window title/identifier, permission availability and lifecycle state. States are active, idle, paused, locked, display_sleep, sleeping, unknown and excluded.

App activation and lifecycle notifications supplement a one-second native timer. AX observers watch focused-window changes and focused-window title changes; unsupported notifications fall back to reconciliation. AX calls use a short messaging timeout. No raw keyboard or mouse events are recorded, only whether input happened in each tick. Browser names and optionally titles are ordinary application contexts; titles are never treated as reliable URLs.

## Transition accounting

- Each observation extends the current context or closes it and starts a new one.
- Duplicate or out-of-order monotonic samples produce no duration.
- A change of window metadata creates a context transition, not an application switch metric.
- At the idle threshold, the native last-input estimate is used to trim all recent active intervals across app changes and begin idle at that earlier point.
- Explicit inactive/privacy states reset the boundary for retroactive attribution.
- Delivery gaps greater than five seconds and wall/monotonic discontinuities greater than 1.5 seconds conservatively close at the last observation and leave unknown time blank.
- Backward wall-clock jumps suppress new attribution until UTC catches up, avoiding overlapping persisted wall-time ranges.

## Depth signals

- **Websites.** For Safari, Chrome, Arc, Brave, Edge, Vivaldi, Opera and Chromium, the front tab's URL is read over Apple Events on a background queue (macOS asks once per browser for Automation consent). Reads are cached per app and title and refreshed every 3 s at most, so a slow browser never delays the tick. The URL keeps only scheme, host and path: credentials, query and fragment are dropped before storage, and non-web schemes keep only the scheme. Navigating to another page starts a new context, as a title change does. URLs follow the window-titles opt-in.
- **Documents.** The focused window's `AXDocument` path is recorded when the app exposes it, under the same opt-in.
- **Input counts.** Each tick records whether the keyboard and whether the pointer were used since the previous sample, from `CGEventSource` idle times (no event tap, no Input Monitoring permission, never what was typed). Spans accumulate `typing_ms` and `pointer_ms`.
- **Calls and video.** A tick counts as a call while the default input device is running somewhere (CoreAudio, no microphone permission), and as video while the front app holds a display-sleep assertion. Either one keeps the span active through the idle threshold, and idle cannot backdate past the last such tick. Spans accumulate `meeting_ms` and `media_ms`.
- These live in `interval_details` (migration 005) beside `intervals`, so older builds still read and write the file.

## Categories

Apps get a built-in category on first sight (only while still uncategorized), and well-known sites set a browser span's category, matching the most specific domain first (`mail.google.com` before `google.com`). A span that is mostly a call reads as Meetings. A user's category override on the app always wins. Migration 005 adds Productivity, Writing and Learning (productive), Meetings, Utilities and Browsing (neutral), and Social media, Entertainment, News and Shopping (unproductive). Existing categories keep the user's classification.

This approach favors undercounting over inventing work. Suspended or heavily delayed event delivery can therefore leave gaps. There is approximately one-second reconciliation resolution, not a promise of perfect event timestamp accuracy.

## Transactions and recovery

The service clones the engine before processing a sample. On a transition or 15-second checkpoint, it deletes the former open-row checkpoint, trims retroactive idle, inserts completed spans, persists the new open span and updates the checkpoint in one SQLite transaction. Only successful commits advance the proposed transition. A failure appears in the UI and diagnostic stderr; no success is fabricated. Previously durable rows survive interruption.

An open interval is stored only through its last observed endpoint. Restart never extends it to the new launch time. At most the uncommitted heartbeat tail can be lost. A running focus session is marked interrupted at the durable checkpoint. A second process cannot acquire the writer lock.

## Metrics

All interval aggregation clips boundaries to the requested half-open UTC range. Local day boundaries are computed with calendar dates, so DST days can contain 23 or 25 hours. A timezone change reinterprets display/aggregation, not stored timestamps.

Active time: sum of observed active interval overlap. Idle time: intervals explicitly labeled idle; sleep and unknown gaps are separate. Application switches: adjacent active contexts with different bundle IDs. Longest active stretch: contiguous active intervals, even if the application changes. Context count includes title changes and is not called a launch count.

Declared focus: wall-clock duration of user-started sessions. Observed during focus: intersections of those sessions with active intervals. Neither proves concentration. Targets are reminders represented in the UI; sessions continue until stopped. Pause/resume of a focus session is not implemented. Tracking pause is independent of a declared focus session.

## Tests

`engine.rs` covers fast and ordinary app switching, duplicates, window changes, unavailable title metadata, idle backdating, pause/resume, lock/wake, long delivery gaps, clock jumps, range clipping and non-overlap across a long synthetic sequence. Storage tests cover rollback on injected SQL failure, recovery and cross-application idle trimming. Service tests cover duplicate writer exclusion. Synthetic observations occur only inside tests.

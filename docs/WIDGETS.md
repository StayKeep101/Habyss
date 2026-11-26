# Widgets and Live Activities

The widget and the Live Activity are native targets that live in the committed
Xcode project (`ios/Habyss.xcodeproj`), not in a config plugin:

- `ios/Widget/HabyssWidget.swift` — Daily Tasks (3 small / 5 medium) and lock screen task counts
- `ios/Widget/DashboardWidgets.swift` — Heatmap & Streak
- `ios/Widget/WidgetShared.swift` — shared snapshot reader and task completion intent
- `ios/Widget/WidgetLiveActivity.swift` — the Lock Screen / Dynamic Island card
- `ios/Widget/WidgetBundle.swift` — registers widgets, Echo and Live Activities
- `modules/habyss-live-activity/` — the Expo module the app starts activities with
- `ios/Habyss/SharedDefaults.swift` — the bridge to the app group

**`npx expo prebuild --clean` deletes them.** It regenerates `ios/` from
`app.json`, and there is no config plugin that adds the widget target, the watch
app or the app group wiring back. Build from the checked-in project instead. If
`ios/` ever has to be regenerated, the widget target must be added back in Xcode
by hand (target → Widget Extension → App Groups: `group.com.habyss.data`).

## The Home Screen widgets

- **Daily Tasks:** Tasks-list items only, ordered like the app: overdue, today,
  then undated, with priority and duration breaking ties. Small shows three,
  medium five. Tap anywhere on a row to complete it without opening Habyss.
  Future, cancelled and completed tasks are not offered as actions.
- **Heatmap & Streak:** scheduled habit check-ins over seven weeks (small) or
  thirteen weeks (medium), plus the same daily streak computed by the app.
- **Quick Add:** a widget cannot hold a text field, so the nearest thing is one
  tap to the composer with the keyboard up. Small and Lock Screen open a new
  task; medium has Task and Habit halves. Daily Tasks (medium) carries the same
  + Task / + Habit links in its header. All open `habyss://add?kind=task|habit`
  (`app/add.tsx`). To add one *without* opening Habyss: "Add a task in Habyss"
  (or "Add a habit…") to Siri, Spotlight, the Action button or a Shortcut —
  `AddTaskIntent` / `AddHabitIntent` ask for the name in the system prompt and
  queue it in `pending_quick_adds`, which `drainQuickAdds()` turns into rows the
  next time the app runs.

Gallery previews contain examples. Installed widgets use only shared app data;
missing data asks the user to open Habyss. A genuinely empty Tasks list remains
empty even if the user has habits.

## Synchronization

`lib/widgetSync.ts` reads SQLite and publishes through `lib/widgetService.ts`
and the native `SharedDefaults` bridge into `group.com.habyss.data`.
App launch, foreground, task/habit edits, restoration and daily-target
changes refresh it. Leaving the app flushes a pending debounced refresh.

| Storage | Contents |
| --- | --- |
| `widgetDashboard.json` | Atomic snapshot: eight task days, heatmap, streak, each habit's streak (`goals` stays as an empty list for widgets from older builds) |
| `widget-events/<UUID>.json` | Durable completion actions with task ID, local day, state and timestamp |
| `widgetDashboard` UserDefaults | Compatibility copy, read only if the snapshot file is absent |
| `habitsData`, `siriHabitsData`, `widgetSummary`, `dayKey`, `streakCount`, `topHabitName` | Legacy/Siri/Echo data; these are not the Daily Tasks widget's data source |
| `activeHabitName`, `timerEndDate` | Focus timer data from `lib/liveActivityService.ts` |

The widget overlays queued actions immediately, removing completed rows. Repeated completion taps are idempotent.
`drainWidgetToggles()` applies actions to SQLite when the app next runs its
intent/foreground checks, preserving the tap timestamp. Actions are acknowledged
only after the database commits and the replacement snapshot is published;
storage failures retain them for retry. Legacy defaults actions are still read.
The heatmap and streak are recomputed when the app publishes the new snapshot.

The task snapshot caches twelve candidates per day while keeping full counts.
After exhausting those candidates without reopening Habyss, the widget asks to
refresh rather than claiming all tasks are complete. Eight days of timeline
entries support midnight rollover; expired task data asks for a refresh.
WidgetKit controls delivery of app-requested reloads.

Clearing the snapshot writes a tombstone so another process cannot resurrect
old account data from its cached UserDefaults.

## Build and verify

These are native changes: a Metro reload or Expo Go cannot install them.
Open `ios/Habyss.xcworkspace`, select the **Habyss** scheme and the iPhone, then
Run. Open Habyss once after installation. Add Daily Tasks and Heatmap & Streak
from the iOS widget gallery.
Both the app and WidgetExtension must retain the App Group entitlement.

Automated checks:

```sh
npm run type-check
npx jest lib/__tests__/widgetDashboard.test.ts lib/__tests__/widgetSync.test.ts lib/__tests__/widgetActions.test.ts lib/__tests__/widgetService.test.ts --runInBand --watch=false
node scripts/check-widget-snapshot.mjs
```

On the iPhone, verify a task edit appears after returning Home; complete a task
from each widget size and confirm the app shows it done; check the heatmap and
streak against Progress; and repeat a task tap with Habyss closed. Include reopening the following day to
check completion history. Native visual and interaction checks remain necessary
even when the TypeScript and Swift model checks pass.

The September 29 sandbox allowed Swift type-checking of the three widget files
against the iOS SDK, but blocked Xcode's Swift macro processes during a full
build. The updated native build has not been installed or verified on the phone.

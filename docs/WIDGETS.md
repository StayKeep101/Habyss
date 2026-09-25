# Widgets and Live Activities

The widget and the Live Activity are native targets that live in the committed
Xcode project (`ios/Habyss.xcodeproj`), not in a config plugin:

- `ios/Widget/HabyssWidget.swift` — the home screen and lock screen widget
- `ios/Widget/WidgetLiveActivity.swift` — the Lock Screen / Dynamic Island card
- `ios/Widget/WidgetBundle.swift` — registers both
- `modules/habyss-live-activity/` — the Expo module the app starts activities with
- `ios/Habyss/SharedDefaults.swift` — the bridge to the app group

**`npx expo prebuild --clean` deletes them.** It regenerates `ios/` from
`app.json`, and there is no config plugin that adds the widget target, the watch
app or the app group wiring back. Build from the checked-in project instead. If
`ios/` ever has to be regenerated, the widget target must be added back in Xcode
by hand (target → Widget Extension → App Groups: `group.com.habyss.data`).

## What the app writes

Everything the widget draws comes from one payload, written by
`lib/widgetSync.ts` through `lib/widgetService.ts` into the app group:

| Key | What it is |
| --- | --- |
| `habitsData` | Today's rows: `[{ id, name, isCompleted }]`, ids prefixed `habit:` or `task:` |
| `widgetSummary` | `{ total, completed }` for the ring |
| `dayKey` | The day those rows are for (`YYYY-MM-DD`) |
| `streakCount` | Days finished in a row |
| `topHabitName` | The first thing still to do |
| `activeHabitName`, `timerEndDate` | The focus timer, written by `lib/liveActivityService.ts` |
| `pending_widget_toggles` | Written by the *widget*: `"<id>\|1"` or `"<id>\|0"` |

`dayKey` matters: the widget cannot work out a habit's schedule on its own, so
once the stored day is not today it shows "Open Habyss for today" rather than
yesterday's list. The timeline also refreshes at midnight for that reason.

Rows ticked on the widget are applied by `drainWidgetToggles()` when the app
next becomes active. It records the state the user chose rather than a toggle,
so ticking something on and off again cannot leave the two disagreeing.

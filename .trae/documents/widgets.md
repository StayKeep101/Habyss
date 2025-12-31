
# 📌 Habyss Widgets System — Gemini Implementation Guide

**Gemini must build fully functional home screen widgets** for the Expo React Native app named **Habyss**.

Widgets must:

* Display key habit progress
* Support quick actions
* Refresh automatically
* Look beautiful and minimal
* Work on:

  * iOS Widgets
  * Android Widgets

Widgets are NOT optional in this spec. Gemini must implement them.

---

## 🎯 Widget Core Purposes

Gemini must implement widgets that allow users to:

* View today’s habits
* See streak progress
* See today’s completion percentage
* Tap to open the app instantly
* (Optional Tier) Complete habits from widget

---

# 1️⃣ General Technical Rules Gemini Must Follow

Gemini must:

* Detect platform (iOS / Android)
* Use official platform widget APIs:

  * **iOS → WidgetKit**
  * **Android → Glance Widgets**
* Use **Expo Config Plugins** setup
* Ensure widgets stay synced with in-app data
* Use shared storage for widget data:

  * SecureStore
  * AsyncStorage
  * Or platform-shared storage container

Gemini must NOT use hacky approaches.

---

# 2️⃣ iOS Widget Implementation (WidgetKit)

### iOS Requirements Gemini Must Implement

Gemini must:

* Create a WidgetKit Extension
* Create `.swift` widget files
* Connect widget data to Habyss app
* Display:

  * Today habits count
  * Completed count
  * Streak visual
* Provide multiple widget sizes:

  * Small
  * Medium
  * Large

Gemini must configure `app.json`:

```
{
 "expo": {
   "ios": {
     "bundleIdentifier": "com.habyss.app",
     "supportsTablet": true,
     "widgets": [
       {
         "name": "HabyssTodayWidget",
         "family": "systemMedium"
       }
     ]
   }
 }
}
```

Gemini must ensure:

* Widget refreshes automatically
* Tapping widget opens Habyss app

---

# 3️⃣ Android Widget Implementation

Gemini must use **Android Glance Widgets**.

Widget must display:

* Today’s habit completion %
* Streak rings or bar
* “Tap to open”

Gemini must configure Android:

* Add widget provider
* Add metadata
* Ensure adaptive layouts

Gemini must ensure:

* Widget refresh interval logic exists
* Performance is efficient
* Battery friendly

---

# 4️⃣ Shared Data Layer Requirement

Widgets MUST read real habit data.

Gemini must implement:

* Shared data sync between app + widget
* Data format:

```
{
 completedHabitsToday: number,
 totalHabitsToday: number,
 streakDays: number,
 lastUpdated: timestamp
}
```

Gemini must:

* Sync when user completes habit
* Sync on app open
* Sync periodically

---

# 5️⃣ Widget Refresh Rules

Gemini must ensure widgets refresh when:

* Habit completed
* App opened
* Time crosses a new day
* Periodic update (every few hours ideally)

Widgets MUST NOT update too frequently (battery policy).

---

# 6️⃣ Widget UI Requirements

Gemini must ensure widgets are:

* Clean
* Minimal
* Motivational
* On-brand

### At Minimum Widget Must Show:

```
HABYSS
Today: X / Y habits done
Streak: 🔥 N days
Progress bar or ring
```

Optional (if Gemini can):

* Habit names in medium/large widget
* Motivational text
* Emoji streak indicator

---

# 7️⃣ Interaction Behavior Gemini Must Implement

Tapping widget must:

* Open Habyss
* Navigate to Today screen

Gemini MUST add deep links:

```
habyss://today
```

If deep links do not exist:
Gemini must create them.

---

# 8️⃣ Gemini Must Create Utility Sync File

Gemini must create file:

```
/src/utils/widgetSync.ts
```

Containing:

### `updateWidgetData(data)`

Stores latest progress

### `getWidgetData()`

Retrieves progress

### `refreshWidgets()`

Forces OS refresh where allowed

---

# 9️⃣ Failure Handling Rules

Gemini must handle:

If no data:

* Show message:
  “Start a habit today 👋”

If permissions missing:

* Show soft notice

If widget errors:

* Widget must NOT crash
* Must show fallback design

---

# 🔧 Gemini Must Deliver:

Gemini must produce:

* iOS WidgetKit files
* Android Glance widget files
* Shared storage logic
* Expo configuration changes
* Deep linking support
* Data sync utilities

---

# 🧪 Testing Gemini Must Perform

Gemini must verify:

* iOS widgets display correct data
* Android widgets display correct data
* Widgets refresh on habit completion
* Widgets refresh daily
* Tapping opens app
* Streak shows correctly
* Works in production build
* No infinite refresh loops
* No battery drain

---

# 🏁 Success Criteria

Gemini implementation is **SUCCESSFUL ONLY IF**:

✔ Widgets work on iOS
✔ Widgets work on Android
✔ Data stays accurate
✔ Widgets refresh reliably
✔ UI feels premium
✔ No crashes
✔ No spam updates

---

# ✅ Gemini Final Execution Instruction

Gemini must:

1️⃣ Detect platform + project structure
2️⃣ Implement iOS + Android widgets
3️⃣ Implement shared storage
4️⃣ Connect real habit data
5️⃣ Deliver working production-ready widgets

Gemini must treat this file as a **strict execution order**.

---


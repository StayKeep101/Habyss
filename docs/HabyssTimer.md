# 🌀 HABYSS DEEP FOCUS ENGINE

## The Ultimate Habit-Integrated Pomodoro & Timer System

### Full Product Specification — v1.0

---

> *"You don't rise to the level of your habits. You fall to the level of your systems."*
>
> — James Clear, Atomic Habits

---

## TABLE OF CONTENTS

1. [Philosophy &amp; Design Principles](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#1-philosophy--design-principles)
2. [Core Architecture](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#2-core-architecture)
3. [The Five Timer Modes](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#3-the-five-timer-modes)
4. [Habit-Timer Integration](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#4-habit-timer-integration)
5. [Session Intelligence Engine](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#5-session-intelligence-engine)
6. [Dynamic Island Integration](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#6-dynamic-island-integration)
7. [Live Activities &amp; StandBy Mode](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#7-live-activities--standby-mode)
8. [Always-On Display &amp; Lock Screen](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#8-always-on-display--lock-screen)
9. [App Lockdown &amp; Focus Enforcement](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#9-app-lockdown--focus-enforcement)
10. [Soundscapes &amp; Haptic Engine](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#10-soundscapes--haptic-engine)
11. [Analytics &amp; Insight Layer](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#11-analytics--insight-layer)
12. [Notification Architecture](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#12-notification-architecture)
13. [Widgets &amp; Home Screen](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#13-widgets--home-screen)
14. [Multi-Device &amp; Continuity](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#14-multi-device--continuity)
15. [Accessibility &amp; Adaptive UX](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#15-accessibility--adaptive-ux)
16. [Technical Implementation Guide](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#16-technical-implementation-guide)
17. [State Machine Specification](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#17-state-machine-specification)
18. [Data Models](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#18-data-models)
19. [API Surface &amp; Protocols](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#19-api-surface--protocols)
20. [Roadmap &amp; Feature Flags](https://claude.ai/chat/0bd199b9-1ee1-4846-9ebd-45554177f4d4#20-roadmap--feature-flags)

---

## 1. PHILOSOPHY & DESIGN PRINCIPLES

### 1.1 The Habyss Deep Focus Doctrine

The Deep Focus Engine is not merely a timer. It is a **behavioral operating system** — a system that understands *which habit* is being worked on, *how deep* the user historically goes,  *when they typically break* , and  *what conditions produce their best sessions* . Every pixel, every vibration, every sound is engineered with a single intention: **get the user into deep work and keep them there.**

### 1.2 Core Design Pillars

| Pillar                             | Meaning                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Invisible Infrastructure** | The timer should disappear into the background. It should require zero thought to operate, yet be always present when glanced at.    |
| **Habit-Aware**              | The timer knows*which*habit it's serving. Session duration, break ratio, and intensity adapt per habit type.                       |
| **Psychologically Safe**     | Failing a session is never punished. Incomplete sessions still count. Streaks are preserved through partial credit.                  |
| **Ruthlessly Focused**       | When a session is active, distractions are eliminated at the OS level. Not hidden —*eliminated.*                                  |
| **Observable Everywhere**    | Dynamic Island, Lock Screen, StandBy, Live Activity, Apple Watch — the session is visible on every surface.                         |
| **Respectful of Energy**     | Sessions adapt to cognitive load. The system knows the difference between a 25-minute meditation and a 90-minute deep coding sprint. |

### 1.3 The Abyss Metaphor

The name "Habyss" implies depth — going deep into a habit. The timer system should reinforce this. Sessions are not "tasks" or "timers" — they are  **Dives** . The deeper you go (the longer the uninterrupted session), the more "depth" you accumulate. Visual language reflects going deeper: darker hues, deeper rings, lower ambient sounds. Coming up for air (breaks) is celebrated, not just tolerated.

---

## 2. CORE ARCHITECTURE

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                    HABYSS DEEP FOCUS ENGINE              │
├─────────────────┬───────────────────┬───────────────────┤
│   SESSION LAYER │   DISPLAY LAYER   │  ENFORCEMENT LAYER│
│                 │                   │                   │
│  • TimerEngine  │  • MainView       │  • FocusFilter    │
│  • SessionMgr   │  • DynamicIsland  │  • AppBlocker     │
│  • HabitBridge  │  • LiveActivity   │  • ScreenTime API │
│  • AIPredictor  │  • LockScreen     │  • Nudge Engine   │
│  • BreakPlanner │  • StandByView    │  • BreakGating    │
│  • StatsEngine  │  • WatchFace      │  • WillpowerScore │
└─────────────────┴───────────────────┴───────────────────┘
```

### 2.2 Timer Engine Core

The `TimerEngine` is a headless, background-persistent service. It runs even when the app is in the background, terminated from the app switcher, or the device is locked.

**Implementation:** Uses `BGProcessingTask` + `BGAppRefreshTask` + `UNUserNotificationCenter` for persistence. For sub-second accuracy, uses `CMTime` with `monotonic` clock via `CACurrentMediaTime()` —  **never `Date()` alone** , which drifts with system sleep.

```swift
// Core timer precision strategy
actor TimerEngine {
    private var sessionStartMonotonicTime: CFAbsoluteTime = 0
    private var pauseAccumulator: TimeInterval = 0
    private var state: TimerState = .idle
  
    // Elapsed time calculation — drift-proof
    var elapsed: TimeInterval {
        guard state == .running else { return pauseAccumulator }
        return pauseAccumulator + (CACurrentMediaTime() - sessionStartMonotonicTime)
    }
}
```

### 2.3 Persistence Strategy

Sessions survive app kills and device reboots through a multi-layer persistence strategy:

1. **UserDefaults (immediate)** — session start time, state, habitID written on every state change
2. **SwiftData (structured)** — full session record with all metadata
3. **CloudKit (sync)** — session synced across devices within 500ms
4. **Background Task (recovery)** — on next app launch, any incomplete session is recovered and resumed or marked as partial

---

## 3. THE FIVE TIMER MODES

Habyss supports five distinct session modes, each tuned for different habits and cognitive states.

### 3.1 Classic Pomodoro Mode

The gold standard. Strict, reliable, proven.

| Parameter                  | Default | Range      |
| -------------------------- | ------- | ---------- |
| Focus Duration             | 25 min  | 5–120 min |
| Short Break                | 5 min   | 1–30 min  |
| Long Break                 | 15 min  | 5–60 min  |
| Sessions before Long Break | 4       | 2–8       |
| Auto-start next session    | Off     | On/Off     |
| Auto-start breaks          | Off     | On/Off     |

**Behavior:**

* Four focus blocks = one **Cycle**
* After each cycle, a long break is awarded
* Cycle count persists across calendar days (rolling window)
* Completed cycles are displayed on the habit card as flame icons 🔥

### 3.2 Deep Work Mode (Ultradian Rhythm)

Based on Huberman/Newport research. Aligns with the brain's 90-minute ultradian cycle.

| Parameter      | Default      | Range         |
| -------------- | ------------ | ------------- |
| Focus Duration | 90 min       | 60–120 min   |
| Break Duration | 20 min       | 10–30 min    |
| Ramp-up Period | First 10 min | Configurable  |
| Peak Zone      | Min 30–75   | Auto-detected |
| Cool-down      | Final 5 min  | Configurable  |

**Special Features:**

* **Ramp-up Zone:** First 10 minutes shown with a lighter visual indicator — the system knows it takes time to reach flow state and doesn't penalize early distractions
* **Peak Zone Highlighting:** The middle section (typically 30–75 min) shown in the "deep" color — this is when the timer UI darkens, DND becomes absolute, and Dynamic Island shows the "abyss" depth indicator
* **Neurological Wind-Down:** Final 5 minutes triggers a gradual brightening of UI and a lowering of ambient sound — the brain is prepared to emerge from deep work rather than being jolted out

### 3.3 Flow State Mode

No timer. No end time. Pure tracking with intelligent suggestions.

**Behavior:**

* Timer runs indefinitely — user ends the session manually
* Every 25 minutes, a **gentle** haptic pulse (subtle, non-intrusive) signals a natural stopping point — user can ignore entirely
* After 3 hours continuous, a mandatory 20-minute break is suggested (but not enforced unless the user opts into enforcement)
* **Flow Score** is calculated based on session length and self-reported quality (1–5 stars, asked at session end)

**Dynamic Island Behavior:**

* Shows elapsed time (not countdown)
* Depth ring animates slowly outward — visual metaphor of going deeper
* No progress bar — only how far you've gone

### 3.4 Sprint Mode

Short, intense, competitive bursts. Ideal for creative work, writing, or exercise habits.

| Parameter     | Default |
| ------------- | ------- |
| Duration      | 10 min  |
| Break         | 2 min   |
| Rounds        | 5       |
| Auto-continue | Yes     |

**Unique Feature — The Sprint Rush:**

* Visual intensity increases every sprint
* Haptic feedback escalates (lighter → stronger per sprint)
* Completing all 5 sprints triggers the **Victory Sequence** — full-screen celebration, streak update, and a personal best notification if applicable
* Incomplete sprints can be "banked" — returning within 2 hours to complete remaining sprints preserves the round count

### 3.5 Habit-Adaptive Mode (AI-Driven)

The most advanced mode. The system determines optimal session structure  *per habit, per day, per time of day* .

**Inputs the AI uses:**

* Historical session lengths for this habit
* Time of day (morning habits vs. evening habits behave differently)
* Day of week patterns
* Recent streak data — is the user struggling or thriving?
* Last session quality score
* Ambient conditions (if weather/calendar integration enabled)
* Days remaining until habit deadline/review date

**Output:**

* Suggested session duration (shown to user, editable)
* Suggested break ratio
* Estimated "Optimal Session End" — the time at which the AI predicts the user typically achieves the best work quality before diminishing returns
* Warning if the user is attempting a session at a historically low-performance time slot

**How it adapts in real-time:**

* If the user pauses more than 3 times in 10 minutes → the AI gently suggests switching to Sprint Mode or shortening the session
* If 20 minutes into a session with no pauses → AI extends the suggested session duration and signals "you're in the zone"
* If it's 3 sessions in and no breaks were taken → mandatory break screen appears

---

## 4. HABIT-TIMER INTEGRATION

This is what makes Habyss unique. The timer is not generic — it is **deeply aware of which habit it is serving.**

### 4.1 Habit Session Configuration

Every habit in Habyss has its own timer configuration profile, stored as `HabitTimerProfile`:

```swift
struct HabitTimerProfile: Codable, Identifiable {
    var id: UUID
    var habitID: UUID
    var defaultMode: TimerMode           // Which of the 5 modes
    var focusDuration: TimeInterval      // In seconds
    var breakDuration: TimeInterval
    var longBreakDuration: TimeInterval
    var sessionsBeforeLongBreak: Int
    var autoStartBreaks: Bool
    var autoStartSessions: Bool
    var minimumSessionForCredit: TimeInterval  // Partial credit threshold
    var soundscapeID: String?            // Per-habit soundscape
    var colorTheme: HabitThemeColor      // Timer UI color per habit
    var blockingIntensity: BlockingLevel // None / Soft / Hard / Absolute
    var dailyGoalSessions: Int           // Target sessions per day
    var weeklyGoalSessions: Int          // Target sessions per week
}
```

### 4.2 Habit Categories & Smart Defaults

When a user creates a habit, the system infers a category and pre-fills intelligent defaults:

| Habit Category         | Default Mode     | Focus Duration | Sound              | Blocking |
| ---------------------- | ---------------- | -------------- | ------------------ | -------- |
| Deep Work / Coding     | Deep Work        | 90 min         | Rain / Lo-fi       | Hard     |
| Reading                | Classic Pomodoro | 25 min         | Fireplace          | Soft     |
| Writing                | Flow State       | Open           | Typewriter         | Hard     |
| Exercise               | Sprint           | 10 min         | Energetic          | None     |
| Meditation / Breathing | Classic Pomodoro | 20 min         | Silence / Binaural | Absolute |
| Language Learning      | Classic Pomodoro | 25 min         | Café              | Soft     |
| Music Practice         | Deep Work        | 45 min         | Silence            | Hard     |
| Study                  | Classic Pomodoro | 25 min         | White Noise        | Hard     |
| Creative / Art         | Flow State       | Open           | Ambient            | Soft     |

### 4.3 Starting a Session from a Habit

**Interaction Flow:**

```
Habit Card (long press OR tap timer icon)
    ↓
Quick Start Sheet appears (0.3s spring animation from bottom)
    ↓
Shows:
    • Habit name + icon + color
    • Recommended session mode (with AI reasoning: "You usually do 25 min in the morning")
    • Quick duration options: [15] [25] [45] [90] [Custom]
    • Soundscape quick-toggle
    • Blocking level toggle
    ↓
Tap [START] → Full-screen timer view slides in
    ↓
Session begins
```

**Quick-start without UI (power users):**

* Long-press habit → hold for 1.5s → session starts immediately with last-used settings
* Siri Shortcut: "Start [habit name] session" → begins immediately
* Shortcut widget: Tap on home screen to launch specific habit session

### 4.4 Session Context Injection

When a session begins for a habit, the system injects rich context into every display surface:

* **Dynamic Island:** Shows habit icon + habit color + countdown
* **Live Activity:** Shows habit name, current session number, today's progress bar
* **Lock Screen:** Shows habit name prominently with depth ring visualization
* **StandBy:** Shows habit name large, with ambient animation themed to habit color

---

## 5. SESSION INTELLIGENCE ENGINE

### 5.1 The Willpower Bank

The Willpower Bank is a conceptual model surfaced to the user. It represents their estimated cognitive energy for the day.

**How it's calculated:**

* Starts at 100% each morning
* Decreases by a calculated amount each session (varies by session intensity)
* Partially restored by breaks (short break = +10%, long break = +25%)
* Never shown as a "depleting" number — shown as a depth gauge (deeper = more energy spent, not bad — just means you've done real work)

**UI representation:**

* On the main timer view, a subtle vertical depth gradient on the side of the screen
* Shown in detail on the Analytics tab as "Today's Depth"
* Informs the AI Adaptive mode — if the Willpower Bank is below 30%, the AI recommends shorter sessions and more frequent breaks

### 5.2 Session Difficulty Rating

At the end of every session, a 3-second rating card slides up:

```
┌─────────────────────────────┐
│   Session complete! 🎯      │
│   25 min · Coding           │
│                             │
│   How was that session?     │
│   😩  😐  😊  🔥  ⚡       │
│   Brutal Meh Good Fire Zone │
│                             │
│   [Skip]         [Done]     │
└─────────────────────────────┘
```

This data feeds:

* The AI Adaptive Mode for future sessions
* The Analytics layer (quality vs. time of day)
* The Streak calculation (a "Fire" or "Zone" session gives bonus streak XP)

### 5.3 Interruption Tracking

Every time the user leaves the app, unlocks the phone, or dismisses a blocking prompt, the system logs an  **Interruption Event** :

```swift
struct InterruptionEvent: Codable {
    var sessionID: UUID
    var timestamp: Date
    var type: InterruptionType  // AppSwitch / Notification / Manual / PhoneCall
    var duration: TimeInterval  // How long they were away
    var wasBlocked: Bool        // Did the blocking system catch this?
}
```

**This data is shown in Analytics as:**

* Interruptions per session (trend over time)
* Most common interruption time (e.g., "You usually get distracted at the 12-minute mark")
* Interruption heat map (which minutes of a session are highest risk)
* "Clean Sessions" count — sessions with zero interruptions (celebrated prominently)

### 5.4 Break Optimization Engine

The break is not passive time. The system actively optimizes breaks.

**During a break:**

* The timer screen softens — lower contrast, slower animations
* A suggested break activity appears based on habit type:
  * Deep Work → "Step outside for 5 min / Look at something 20 feet away"
  * Exercise → "Stretch + hydrate"
  * Study → "Close your eyes, lie down if possible"
  * Reading → "Walk around, no screens"
* Break timer has a **Extend Break** option (+2 min, maximum 2 uses per cycle)
* **Skip Break** is allowed but logs as an "override" — too many overrides triggers a gentle nudge

**Break ending:**

* 30 seconds before break ends: soft chime + gentle haptic
* 10 seconds: countdown appears on Dynamic Island with urgency pulse
* At break end: distinct "return" sound + strong haptic + notification (if phone is locked)

---

## 6. DYNAMIC ISLAND INTEGRATION

The Dynamic Island is the heartbeat of the running session. It is always visible, always informative, and always interactive.

### 6.1 Compact State (Session Running — User in Another App)

```
┌─── Dynamic Island Compact ───┐
│  [🧠] ━━━━━━━━━░░░ 12:34    │
│  [Habit Icon] [Progress] [Time]│
└──────────────────────────────┘
```

* **Left side:** Habit icon (the habit's SF Symbol or custom emoji, rendered at 16pt)
* **Center:** Circular progress arc — fills clockwise as session progresses
* **Right side:** Remaining time in `MM:SS` format
* **Color:** The island border subtly glows with the habit's theme color (using `tintColor` on the `ActivityContent`)

**Tap behavior (compact → expanded):**

* Single tap → expands to the expanded state (see below)
* Long press → Quick Action sheet:
  * [Pause Session]
  * [End Session]
  * [Jump to App]

### 6.2 Expanded State (User Taps the Island)

```
┌─────────────────────────────────────────────────────┐
│   🧠 Deep Coding Session                            │
│   ─────────────────────────────────────────────────│
│   ████████████████████░░░░░  [18:42 remaining]     │
│   Session 2 of 4  ·  Today: 3 completed            │
│   ─────────────────────────────────────────────────│
│        [⏸ Pause]    [⏹ End]    [Open App →]       │
└─────────────────────────────────────────────────────┘
```

* Full habit name + icon in header
* Full-width progress bar with exact time remaining
* Session counter (session N of total in this cycle)
* Today's completed session count for this habit
* Three action buttons: Pause, End, Open App

**Tap [Open App]** → morphs the island back to compact and opens Habyss with a cinematic transition

### 6.3 Break State (Dynamic Island — During Break)

```
┌─── Dynamic Island Compact ───┐
│  [☕] ─ ─ ─ ─ ─ ─ ─ 4:30   │
└──────────────────────────────┘
```

* **Left:** Break icon (☕ coffee / 🌿 leaf / 🌊 wave — adapts to habit type)
* **Center:** Dashed line (instead of solid progress) — signals "rest state"
* **Right:** Break time remaining
* **Island border:** Dimmed, lower opacity — visually communicates "rest"

### 6.4 Dynamic Island — Session Complete Celebration

When a session completes:

1. Island **expands fully** (even if user is in another app)
2. Animated confetti effect within the island bounds
3. Displays: "Session complete! 🎯 · [Habit Name]"
4. Auto-collapses after 4 seconds
5. Tap to open the session rating card in Habyss

### 6.5 Implementation: ActivityKit

```swift
import ActivityKit

struct HabyssTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var remainingTime: TimeInterval
        var sessionPhase: SessionPhase  // focus / shortBreak / longBreak
        var sessionNumber: Int
        var totalSessions: Int
        var habitName: String
        var habitIcon: String          // SF Symbol name
        var habitColorHex: String
        var todayCompletedSessions: Int
        var progressFraction: Double   // 0.0 – 1.0
        var sessionEndDate: Date       // Used for .timer countdown
    }
  
    var habitID: UUID
    var sessionMode: String
}

// Starting a Live Activity
func startLiveActivity(for session: ActiveSession) throws {
    let attributes = HabyssTimerAttributes(
        habitID: session.habitID,
        sessionMode: session.mode.rawValue
    )
    let state = HabyssTimerAttributes.ContentState(
        remainingTime: session.remaining,
        sessionPhase: .focus,
        sessionNumber: session.currentSession,
        totalSessions: session.totalSessions,
        habitName: session.habitName,
        habitIcon: session.habitIcon,
        habitColorHex: session.colorHex,
        todayCompletedSessions: session.todayCount,
        progressFraction: session.progress,
        sessionEndDate: session.projectedEndDate
    )
  
    let activity = try Activity.request(
        attributes: attributes,
        contentState: state,
        pushType: .none
    )
    self.currentActivityID = activity.id
}
```

---

## 7. LIVE ACTIVITIES & STANDBY MODE

### 7.1 Live Activity — Lock Screen Widget

When the session is active, the Lock Screen shows a dedicated Live Activity widget below the time.

**Layout:**

```
┌────────────────────────────────────────────────────┐
│  🧠  DEEP CODING SESSION          ⚡ Session 2/4   │
│  ██████████████████░░░░░░░░░░░░  18:42 remaining   │
│  Today: ████░░░░░░  3/6 sessions complete          │
└────────────────────────────────────────────────────┘
```

**Implementation using `WidgetKit` + `ActivityKit`:**

```swift
struct HabyssLockScreenLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HabyssTimerAttributes.self) { context in
            // Lock screen / Banner view
            HStack {
                Image(systemName: context.state.habitIcon)
                    .foregroundStyle(Color(hex: context.state.habitColorHex))
              
                VStack(alignment: .leading) {
                    Text(context.state.habitName)
                        .font(.headline)
                  
                    ProgressView(value: context.state.progressFraction)
                        .tint(Color(hex: context.state.habitColorHex))
                  
                    HStack {
                        Text(timerInterval: context.state.sessionEndDate...Date.now, 
                             countsDown: true)
                            .font(.caption.monospacedDigit())
                        Spacer()
                        Text("Session \(context.state.sessionNumber)/\(context.state.totalSessions)")
                            .font(.caption2)
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial)
          
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded region
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.habitIcon)
                        .font(.title2)
                        .foregroundStyle(Color(hex: context.state.habitColorHex))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: context.state.sessionEndDate...Date.now,
                         countsDown: true)
                        .font(.title3.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: context.state.progressFraction)
                        .tint(Color(hex: context.state.habitColorHex))
                }
            } compactLeading: {
                Image(systemName: context.state.habitIcon)
                    .foregroundStyle(Color(hex: context.state.habitColorHex))
            } compactTrailing: {
                Text(timerInterval: context.state.sessionEndDate...Date.now,
                     countsDown: true)
                    .font(.caption.monospacedDigit())
            } minimal: {
                Image(systemName: context.state.habitIcon)
                    .foregroundStyle(Color(hex: context.state.habitColorHex))
            }
        }
    }
}
```

### 7.2 StandBy Mode (iOS 17+)

StandBy mode is displayed when the iPhone is placed horizontally while charging. Habyss provides a **dedicated, beautiful StandBy view** that dominates the display.

**StandBy View Design:**

```
┌─────────────────────────────────────────────┐
│                                             │
│         🧠                                  │
│    DEEP CODING                              │
│                                             │
│         18:42                               │
│      (giant, readable clock)                │
│                                             │
│   ══════════════════░░░░░░  72%            │
│                                             │
│     Session 2 of 4  ·  🔥 12-day streak    │
│                                             │
│         [PAUSE]           [END]             │
│                                             │
└─────────────────────────────────────────────┘
```

**StandBy design principles:**

* Giant time remaining — readable from across the room
* Habit icon large and centered
* Minimal, high-contrast — works in NightMode (red tint)
* Depth ring animation (slow, meditative pulse) around the time display
* Habit's theme color used as the dominant accent
* Streak indicator always visible — motivational context
* Two large buttons — Pause and End — finger-tappable in the dark

**Night Mode (Red Tint) Behavior:**

* Habyss StandBy view switches to a warm amber palette in NightMode
* The progress arc switches to a dimmed orange
* The background darkens to near-black
* The time display remains large and readable

**Implementation:**

```swift
struct HabyssStandByView: View {
    let context: ActivityViewContext<HabyssTimerAttributes>
    @Environment(\.isLuminanceReduced) var isDimmed
  
    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()
          
            VStack(spacing: 24) {
                // Habit icon with depth ring
                ZStack {
                    Circle()
                        .stroke(
                            Color(hex: context.state.habitColorHex).opacity(0.3),
                            lineWidth: 3
                        )
                        .frame(width: 80, height: 80)
                  
                    Image(systemName: context.state.habitIcon)
                        .font(.system(size: 40))
                        .foregroundStyle(
                            isDimmed 
                                ? .orange 
                                : Color(hex: context.state.habitColorHex)
                        )
                }
              
                // Giant countdown
                Text(timerInterval: context.state.sessionEndDate...Date.now,
                     countsDown: true)
                    .font(.system(size: 72, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isDimmed ? .orange : .white)
              
                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.white.opacity(0.1))
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                isDimmed 
                                    ? Color.orange 
                                    : Color(hex: context.state.habitColorHex)
                            )
                            .frame(width: geo.size.width * context.state.progressFraction)
                    }
                }
                .frame(height: 8)
                .padding(.horizontal, 40)
              
                // Session info
                HStack(spacing: 16) {
                    Text("Session \(context.state.sessionNumber) of \(context.state.totalSessions)")
                    Text("·")
                    Text("🔥 \(context.state.streakCount)-day streak")
                }
                .font(.callout)
                .foregroundStyle(.white.opacity(0.6))
            }
        }
    }
}
```

---

## 8. ALWAYS-ON DISPLAY & LOCK SCREEN

### 8.1 Lock Screen Behavior During Active Session

The lock screen is transformed when a session is active:

1. **Live Activity widget** anchored to the bottom of the Lock Screen (see §7.1)
2. **Lock Screen wallpaper** does NOT change — Habyss respects user personalization
3. **Notification Center** is suppressed for all apps except critical system alerts (when Hard or Absolute blocking is enabled)
4. **Face ID / Touch ID behavior:** When a session is active and Hard blocking is enabled, unlocking the phone shows a **Session Active screen** before going to the home screen (see §9.3)

### 8.2 Always-On Display (iPhone 15 Pro / iPhone 16 and later)

On devices with Always-On Display (AOD), Habyss provides a dedicated **ambient session view** that is designed for the reduced-luminance always-on state:

**AOD-Specific Design:**

* Uses only grayscale or very low-saturation colors to minimize OLED burn-in
* Avoids white backgrounds entirely (OLED pixels are OFF for true black)
* Animated depth ring is slowed to 1 FPM (frame per minute) — smooth but power-efficient
* Habit icon rendered as monochrome outline
* Large time remaining, always visible
* No buttons (AOD is view-only — tapping wakes the screen)

**AOD Update frequency:** Timer text updates every 1 minute on AOD (sufficient for readability, battery-conscious). When user taps to wake → full color, live countdown resumes.

---

## 9. APP LOCKDOWN & FOCUS ENFORCEMENT

This is the discipline layer. The system ensures that when a session is active, distractions are not just made inconvenient — they are made structurally impossible (based on the user's chosen Blocking Level).

### 9.1 Blocking Levels

| Level | Name               | What it does                                                                                                                  |
| ----- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 0     | **None**     | No blocking. Timer runs. You do what you want.                                                                                |
| 1     | **Soft**     | Gentle reminder overlay when switching to distracting apps. Easy to dismiss.                                                  |
| 2     | **Hard**     | Notification suppression + 5-second delay interstitial before opening blocked apps.                                           |
| 3     | **Absolute** | Full Screen Time API enforcement. Blocked apps simply cannot be opened. Unlocking requires session end or emergency override. |

### 9.2 How Blocking Works (Technical)

**Soft Blocking (Level 1):**

* Uses `NSUserActivity` + Background Tasks to detect when user switches away from Habyss
* A notification fires with a "Return to session" button
* Does not prevent app access

**Hard Blocking (Level 2):**

* Uses **Screen Time API** (`ManagedSettings`, `FamilyControls`)
* User grants "Screen Time" permission once during onboarding
* When session starts: `ManagedSettingsStore` applies restrictions to the user's blocked app list
* A 5-second countdown interstitial appears if the user attempts to open a blocked app
* The interstitial shows session time remaining and a shame counter ("3 interruptions this session")
* User can proceed after 5 seconds (but it logs an interruption event)

**Absolute Blocking (Level 3):**

* Full `FamilyControls` + `ManagedSettings` implementation
* Blocked apps are grayed out and non-openable during sessions
* User defines their block list during habit setup
* Emergency override: 3D Touch on the Habyss app icon → "Emergency Exit" → ends session + unlocks

```swift
import FamilyControls
import ManagedSettings

class FocusEnforcer: ObservableObject {
    private let store = ManagedSettingsStore()
  
    func enableBlocking(for profile: HabitTimerProfile) async {
        guard profile.blockingIntensity == .absolute else { return }
      
        // Request FamilyControls authorization (once, during onboarding)
        let center = AuthorizationCenter.shared
        try? await center.requestAuthorization(for: .individual)
      
        // Apply restrictions
        store.application.blockedApplications = profile.blockedApps
        store.webContent.blockedByFilter = .specific(
            bundleIDs: [], // No bundle IDs needed — use category filter
            categories: profile.blockedWebCategories
        )
        store.shield.applications = profile.blockedApps
    }
  
    func disableBlocking() {
        store.clearAllSettings()
    }
}
```

### 9.3 The Session Active Screen

When a session is running with Hard or Absolute blocking and the user unlocks their phone (without coming from Habyss), a full-screen **Session Active Screen** appears:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              🧠 You're in a session               │
│                                                    │
│         DEEP CODING · 18:42 remaining             │
│                                                    │
│   ██████████████████░░░░░░░░░  72% complete       │
│                                                    │
│   "Stay the course. The work is worth it."        │
│   (Rotating motivational quotes from Stoic/       │
│    productivity canon)                             │
│                                                    │
│   ┌──────────────────────┐                        │
│   │   RETURN TO SESSION  │  ← Primary CTA        │
│   └──────────────────────┘                        │
│                                                    │
│   [End Session]  [I have an emergency]            │
│    ← destructive, small    ← opens override       │
└────────────────────────────────────────────────────┘
```

**"I have an emergency" flow:**

* Tapping shows a 10-second hold button (must hold entire 10 seconds)
* After hold: session is ended, all blocking removed, interruption logged as "Emergency Override"
* Analytics show emergency override count per habit over time

### 9.4 Blocked App Categories (Default Lists per Habit)

The system pre-populates a suggested block list based on habit category:

| Habit Category | Suggested Blocked Apps                         |
| -------------- | ---------------------------------------------- |
| Deep Work      | Social Media, Games, Video Streaming, Shopping |
| Study          | Social Media, Games, Messaging                 |
| Exercise       | — (none; you're moving, not on your phone)    |
| Meditation     | ALL apps                                       |
| Creative       | Social Media, News                             |
| Reading        | Social Media, Video, Games                     |

User can modify the block list per habit during setup and any time from the habit settings.

---

## 10. SOUNDSCAPES & HAPTIC ENGINE

### 10.1 Soundscape Library

Every session can have an ambient soundscape. Soundscapes are:

* **Downloaded** to device for offline playback (no streaming during sessions)
* **Looped** seamlessly with crossfade
* **Volume-matched** to prevent jarring level differences between tracks
* **Phase-adaptive** — the soundscape shifts subtly during focus vs. break phases

| Category   | Soundscapes                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 🌧 Nature  | Heavy Rain, Gentle Rain, Thunderstorm, Ocean Waves, River, Forest Morning, Wind in Trees                          |
| ☕ Café   | Busy Café, Quiet Library, Bookstore, Train Ambient, Airport Lounge                                               |
| 🔥 Fire    | Fireplace Crackling, Campfire, Fireplace (quiet)                                                                  |
| 🎵 Music   | Lo-Fi Hip-Hop, Ambient Electronic, Classical Focus, Jazz (instrumental)                                           |
| 🔬 Science | Brown Noise, Pink Noise, White Noise, Binaural Beta (focus), Binaural Alpha (relaxed), Binaural Theta (deep rest) |
| 🌌 Space   | Space Hum, Deep Space, Cosmic Static                                                                              |
| 🤫 Minimal | Silence, Subtle Tick (clock), Vinyl Crackle                                                                       |

**Binaural Beats note:** Binaural beats require headphones. The app detects headphone state and shows a notification if the user selects a binaural option without headphones connected.

### 10.2 Break Soundscape Transitions

When a session transitions to break:

* Focus soundscape fades out over 3 seconds
* Break soundscape fades in over 3 seconds
* Break soundscapes are pre-assigned per focus soundscape (e.g., Heavy Rain → Gentle Rain for break; Lo-Fi → Soft Jazz)
* User can override break soundscape separately

### 10.3 Session-End Sounds

| Event                              | Default Sound     | Customizable |
| ---------------------------------- | ----------------- | ------------ |
| Session complete                   | Soft gong         | Yes          |
| Break start                        | Wind chime        | Yes          |
| Break end (30s warning)            | Soft bell         | Yes          |
| Break end (final)                  | Return chime      | Yes          |
| Long break awarded                 | Warm chord        | Yes          |
| All sessions complete (full cycle) | Victory sequence  | Yes          |
| Interruption detected              | Silent (no sound) | No           |

All session sounds respect the system **Silent Mode** — if the user's phone is on silent, all sounds are suppressed except for haptic feedback.

### 10.4 Haptic Feedback Design

Habyss uses a rich haptic vocabulary to communicate session state without sound or visual attention.

| Event                   | Haptic Pattern                                 |
| ----------------------- | ---------------------------------------------- |
| Session start           | Medium → Light (two-tap)                      |
| Session complete        | Strong → Medium → Light (three-tap sequence) |
| Break start             | Single light tap                               |
| Break end (30s warning) | Double light tap                               |
| Break end               | Light → Strong (escalating)                   |
| Pause                   | Single medium tap                              |
| Resume                  | Double medium tap                              |
| Interruption blocked    | Firm single tap (warning feel)                 |
| Long break awarded      | Complex pattern (celebration)                  |
| Emergency override      | Strong repeating tap (3x)                      |

**Custom Haptic Engine (CoreHaptics):**

```swift
import CoreHaptics

class HabyssHapticEngine {
    private var engine: CHHapticEngine?
  
    // Session complete — layered haptic pattern
    func playSessionComplete() {
        let sharpness = CHHapticEventParameter(
            parameterID: .hapticSharpness, value: 0.3
        )
        let intensity = CHHapticEventParameter(
            parameterID: .hapticIntensity, value: 1.0
        )
      
        let events = [
            CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: 0),
            CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
                sharpness
            ], relativeTime: 0.15),
            CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4),
                sharpness
            ], relativeTime: 0.3)
        ]
      
        try? engine?.makePlayer(with: CHHapticPattern(events: events, parameters: [])).start(atTime: 0)
    }
}
```

---

## 11. ANALYTICS & INSIGHT LAYER

### 11.1 Session Statistics Dashboard

The Analytics tab surfaces deep insights about every habit's session history.

**Overview Cards (Today):**

```
┌─────────────────────────────────────────────────────┐
│  TODAY'S DEPTH                                      │
│  5h 23m total focus  ·  12 sessions  ·  3 habits   │
│  ████████████████░░░░  83% of daily goal            │
└─────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐
│  BEST SESSION    │  │  CLEAN SESSIONS  │
│  47 min          │  │  7 of 12         │
│  🔥 Zone rating  │  │  (no interrupt.) │
└──────────────────┘  └──────────────────┘
```

### 11.2 Per-Habit Analytics

Each habit has its own analytics view:

**Focus Duration Trend (30 days):**

* Line chart showing average session length per day
* Overlaid with session count (bar chart, secondary axis)
* Trend arrow: improving / declining / stable
* Personal best marker

**Time-of-Day Heatmap:**

* 7-day grid × 24-hour grid
* Color intensity = session count in that hour/day cell
* Overlaid with quality score (green tint = high quality sessions)
* "Your peak performance window: 9–11 AM" calculated and surfaced as an insight card

**Session Quality Distribution:**

* Donut chart of session ratings (😩 Brutal / 😐 Meh / 😊 Good / 🔥 Fire / ⚡ Zone)
* Trend: is quality improving over time?

**Interruption Analysis:**

* Average interruptions per session
* "Hardest minute" — the minute within sessions where you most often get interrupted
* Clean session streak (longest run of sessions with 0 interruptions)

**Consistency Score (0–100):**

* Weighted score based on: session frequency, duration achieved vs. goal, quality ratings, streak
* Shown as a single number per habit — the "deep score"
* Trends week-over-week

### 11.3 AI-Generated Weekly Summary

Every Sunday, Habyss generates a **natural language Weekly Digest** using on-device ML:

```
📊 YOUR WEEK IN DEPTH — Feb 10–16, 2025

You went deep 43 times this week — your best week yet.

🏆 HIGHLIGHT: Your coding sessions averaged 38 minutes this week,
   up from 27 minutes last week. You're building serious depth.

⚠️  WATCH: Your meditation sessions are getting shorter. Average
   dropped from 20 min to 12 min. Consider the 5-minute Pomodoro
   option to rebuild the habit consistency first.

🔥 STREAK: You haven't missed a reading session in 23 days.
   The next milestone is 30 days — you're 7 days away.

⚡ FLOW STATE: You hit Zone-level quality 8 times this week,
   all between 9 AM and 11 AM. Your peak window is clear.
```

---

## 12. NOTIFICATION ARCHITECTURE

### 12.1 Notification Types & Scheduling

All notifications are locally scheduled — no server required. They are managed by the `NotificationOrchestrator`.

| Notification            | When                  | Dismiss Behavior      | Action Buttons           |
| ----------------------- | --------------------- | --------------------- | ------------------------ |
| Session Start           | On demand             | Auto-dismiss 5s       | [Open Session]           |
| Break End (30s warning) | 30s before            | Stays until dismissed | [Extend Break +2min]     |
| Break End               | On break end          | Stays until dismissed | [Start Next Session]     |
| Session Complete        | On completion         | Auto-dismiss 10s      | [Rate Session]           |
| Cycle Complete          | After full cycle      | Stays until dismissed | [Take Long Break]        |
| Missed Session Reminder | Per habit schedule    | Dismisses at day end  | [Start Now] [Skip Today] |
| Streak At Risk          | If no session by 8 PM | Stays                 | [Quick 5-min Session]    |
| Weekly Digest           | Sunday 9 AM           | —                    | [View Summary]           |

### 12.2 Smart Notification Scheduling

The **MissedSessionReminder** is not a fixed-time notification. It uses behavioral data:

* If the user always does their Coding habit at 9 AM → reminder fires at 9:15 AM if no session started
* If the user is irregular → reminder fires at 7 PM as a catch-all
* If the user already completed the habit → no reminder fires (this is a must-get-right behavior)
* If the user's phone is in Focus Mode → reminder is delivered silently (badge only)

### 12.3 Notification Suppression During Sessions

When a session is active with Hard or Absolute blocking:

* All third-party app notifications are suppressed at the system level (via Focus/DND)
* System notifications (calls, emergency alerts) pass through always
* Habyss's own session-management notifications pass through always
* The notification suppression is lifted automatically when the session ends or is paused

---

## 13. WIDGETS & HOME SCREEN

### 13.1 Home Screen Widgets

Habyss provides six distinct widget configurations:

**Small (2×2):**

* Current habit streak + quick-start button
* Session count for today (radial progress)

**Medium (4×2):**

* Today's habit progress row (all habits, mini progress bars)
* Quick-start recent habit + session stats

**Large (4×4):**

* Full habit list with streak indicators + session counts
* Today's depth meter + weekly progress
* Quick-start any habit (grid of habit icons)

**Interactive Widgets (iOS 17+):**

* Tap habit icon → starts session immediately (no app open required)
* Pause/resume button directly in widget while session is active

### 13.2 Lock Screen Widgets

Three lock screen widget types:

* **Circular:** Habit streak count for primary habit
* **Rectangular:** Today's sessions completed / goal (e.g., "3/6 sessions")
* **Inline:** "Last session: 38 min • Coding • 2h ago"

### 13.3 Interactive Notification Widgets (iOS 16+)

Session management buttons inside notifications:

* "Break ended" notification → [Start Session] button directly in notification
* "Session complete" notification → [Rate: 😊] [Rate: 🔥] [Rate: ⚡] inline rating buttons

---

## 14. MULTI-DEVICE & CONTINUITY

### 14.1 Apple Watch Integration

The Apple Watch is a first-class session companion:

**Watch Face Complications:**

* Modular: Habit icon + remaining time or streak count
* Circular: Progress ring for current session
* Graphic Rectangular: Habit name + progress bar + time

**Watch App:**

* Sessions can be started from the watch (launches companion session on iPhone)
* Watch displays: Habit name, Time remaining, Progress ring, Session count
* Crown: Rotate to adjust timer duration before starting
* Haptics: All session events delivered to wrist (independent of iPhone vibration)
* Session can be **paused or ended from the watch without touching the iPhone**

**Continuity:**

* Session state syncs to watch in <500ms via WatchConnectivity
* If phone session is paused, watch shows paused state immediately

### 14.2 iPad Companion App

* Full-screen "Focus Mode" — entire iPad screen shows the session timer, habit info, and soundscape controls
* Split-view: Timer on one side, notes/task list on other side (for study habits)
* Keyboard shortcut: `⌘ + Space` starts/pauses current session

### 14.3 Mac Catalyst (Menu Bar)

* Small menu bar icon showing current session timer
* Click: popover with session controls (pause, end, habit name, time remaining)
* Session sounds play through Mac speakers (Bluetooth continuity)

### 14.4 CloudKit Sync

* All session records, habit profiles, and analytics data synced via CloudKit
* Conflict resolution: last-write-wins for settings; all session records are merged (no data loss)
* Offline-first: full functionality with no connection; syncs when connection restores

---

## 15. ACCESSIBILITY & ADAPTIVE UX

### 15.1 VoiceOver Support

* All timer UI elements labeled accurately: "18 minutes 42 seconds remaining. Session 2 of 4."
* VoiceOver announces session phase changes: "Break started. 5 minutes."
* Dynamic Island is VoiceOver-accessible: swipe down from top to access announcement

### 15.2 Large Text Support

* All timer text scales with Dynamic Type
* Minimum tap target: 44×44pt (Apple HIG standard)
* Progress indicators have text alternatives

### 15.3 Reduce Motion

* With "Reduce Motion" enabled:
  * All animations replaced with cross-dissolve transitions
  * Depth ring pulse becomes a static indicator
  * No animated confetti on session complete — replaced with a static card

### 15.4 Color Accessibility

* All habit theme colors tested against WCAG AA contrast ratios
* Colorblind-safe palette available in Settings
* All visual states (session, break, complete) also communicated through shape (not just color)

### 15.5 Dark Mode / Light Mode

* Full dark mode support (recommended — the "deep" theme is designed for dark)
* Light mode: softer pastels, white backgrounds with colored accents
* Automatic switch follows system setting; can be overridden per session in quick settings

---

## 16. TECHNICAL IMPLEMENTATION GUIDE

### 16.1 Required Frameworks & Permissions

| Framework             | Use                              | Permission Required                             |
| --------------------- | -------------------------------- | ----------------------------------------------- |
| `ActivityKit`       | Live Activities + Dynamic Island | `NSSupportsLiveActivities = YES`in Info.plist |
| `FamilyControls`    | App blocking                     | User grants Screen Time access                  |
| `ManagedSettings`   | Applying blocking rules          | Part of FamilyControls                          |
| `CoreHaptics`       | Custom haptic patterns           | None                                            |
| `AVFoundation`      | Soundscape playback              | None                                            |
| `UserNotifications` | Session notifications            | `requestAuthorization`                        |
| `BackgroundTasks`   | Session persistence              | `BGTaskSchedulerPermittedIdentifiers`         |
| `WatchConnectivity` | Watch sync                       | None                                            |
| `CloudKit`          | Cross-device sync                | iCloud entitlement                              |
| `WidgetKit`         | Home screen widgets              | None                                            |

### 16.2 Background Execution Strategy

Sessions must survive the following scenarios without data loss:

1. **App goes to background:** Timer runs in background via a combination of `BackgroundTasks` and calculating elapsed time from the stored `startDate` — no active background execution required for timing accuracy
2. **App is force-killed:** On next launch, `AppDelegate.applicationDidFinishLaunching` reads the persisted session start date from UserDefaults and reconstructs the session state
3. **Device reboots:** Session start time persisted in UserDefaults survives reboot; session is recovered on first app launch post-reboot
4. **Screen lock:** Live Activity continues; Dynamic Island continues; no active code execution needed
5. **DND mode:** Live Activity and Dynamic Island continue regardless of DND

### 16.3 Timer Accuracy Architecture

```swift
// NEVER use this for timer state:
// let elapsed = Date().timeIntervalSince(startDate)  ← DRIFTS when device sleeps

// ALWAYS use this:
let systemStart = CACurrentMediaTime()  // Monotonic clock
// Save systemStart to UserDefaults as Date offset from Date()
// On recovery: calculate adjustment based on how much time has passed

actor AccurateTimer {
    private let sessionStartDate: Date           // Wall clock (for display)
    private let sessionStartMonotonic: Double    // CACurrentMediaTime at start
    private var pausedDuration: TimeInterval = 0
    private var pauseStartMonotonic: Double?
  
    var elapsed: TimeInterval {
        if let pauseStart = pauseStartMonotonic {
            return pauseStart - sessionStartMonotonic - pausedDuration
        }
        return CACurrentMediaTime() - sessionStartMonotonic - pausedDuration
    }
  
    func pause() {
        pauseStartMonotonic = CACurrentMediaTime()
    }
  
    func resume() {
        if let pauseStart = pauseStartMonotonic {
            pausedDuration += CACurrentMediaTime() - pauseStart
            pauseStartMonotonic = nil
        }
    }
}
```

### 16.4 Live Activity Update Strategy

Live Activities have strict update budgets (30 updates per hour from background). Strategy:

* **Use `.timer` countdown** for the time display — this requires zero updates and is always accurate
* **Update only on state changes:** session start, pause, resume, break start/end, session complete
* **Batch updates:** if multiple state changes happen within 1 second, batch into single update
* **Never update** just to refresh the elapsed time — the `.timer` view does this natively

```swift
func updateLiveActivity(state: SessionState) async {
    guard let activityID = currentActivityID,
          let activity = Activity<HabyssTimerAttributes>.activities
              .first(where: { $0.id == activityID }) else { return }
  
    let newState = HabyssTimerAttributes.ContentState(
        remainingTime: state.remaining,
        sessionPhase: state.phase,
        sessionNumber: state.sessionNumber,
        totalSessions: state.totalSessions,
        habitName: state.habitName,
        habitIcon: state.habitIcon,
        habitColorHex: state.colorHex,
        todayCompletedSessions: state.todayCount,
        progressFraction: state.progress,
        sessionEndDate: state.projectedEndDate  // Key: drives .timer countdown
    )
  
    await activity.update(using: newState)
}
```

---

## 17. STATE MACHINE SPECIFICATION

The timer has exactly one state at any time. Illegal state transitions are impossible by design.

```
                    ┌─────────┐
                    │  IDLE   │
                    └────┬────┘
                         │ start()
                    ┌────▼────┐
               ┌────│ RUNNING │────┐
               │    └────┬────┘    │
            pause()      │      complete()
               │    ┌────▼────┐    │
               │    │ BREAK   │    │
               │    └────┬────┘    │
               │         │         │
          ┌────▼────┐  resume()    │
          │ PAUSED  │────┘         │
          └────┬────┘              │
               │                   │
            resume()           ┌───▼────┐
               │               │COMPLETE│
               └───────────────└────────┘
                                    │
                               ┌────▼────┐
                               │  IDLE   │
                               └─────────┘
```

```swift
enum TimerState: String, Codable, CaseIterable {
    case idle        // No session active
    case running     // Focus phase, counting down
    case paused      // Manually paused
    case onBreak     // Break phase (short or long), counting down
    case complete    // Session(s) finished; awaiting rating or next action
  
    var allowedTransitions: [TimerState] {
        switch self {
        case .idle:     return [.running]
        case .running:  return [.paused, .onBreak, .complete, .idle]
        case .paused:   return [.running, .idle]
        case .onBreak:  return [.running, .paused, .idle]
        case .complete: return [.idle, .running]
        }
    }
  
    func canTransition(to next: TimerState) -> Bool {
        allowedTransitions.contains(next)
    }
}
```

---

## 18. DATA MODELS

### 18.1 Core Models

```swift
// A single focus session record
struct SessionRecord: Codable, Identifiable {
    var id: UUID
    var habitID: UUID
    var startDate: Date
    var endDate: Date?
    var plannedDuration: TimeInterval
    var actualDuration: TimeInterval
    var phase: SessionPhase           // focus / shortBreak / longBreak
    var mode: TimerMode
    var qualityRating: SessionQuality?
    var interruptions: [InterruptionEvent]
    var wasCompleted: Bool
    var wasPartialCredit: Bool        // Met minimum threshold but not full duration
    var soundscapeID: String?
    var blockingLevel: BlockingLevel
    var sessionNumber: Int            // 1-indexed within the cycle
    var deviceType: String            // iPhone / iPad / Mac / Watch
}

// Aggregated daily stats (pre-computed for performance)
struct DailyStats: Codable {
    var date: Date
    var habitID: UUID
    var totalFocusTime: TimeInterval
    var completedSessions: Int
    var plannedSessions: Int
    var avgSessionDuration: TimeInterval
    var avgQualityRating: Double
    var cleanSessionCount: Int
    var totalInterruptions: Int
    var peakFocusStartHour: Int       // Hour of best quality session (0–23)
}

// Habit-level aggregate (rolling window)
struct HabitInsight: Codable {
    var habitID: UUID
    var currentStreak: Int
    var longestStreak: Int
    var totalLifetimeSessions: Int
    var totalLifetimeFocusTime: TimeInterval
    var consistencyScore: Double      // 0–100
    var avgSessionDuration: TimeInterval
    var avgQualityRating: Double
    var bestPerformanceHour: Int
    var weeklyTrend: Trend            // improving / stable / declining
    var lastSessionDate: Date?
}
```

### 18.2 Configuration Models

```swift
struct HabitTimerProfile: Codable {
    // Identity
    var habitID: UUID
  
    // Mode
    var defaultMode: TimerMode
  
    // Durations
    var focusDuration: TimeInterval          // seconds
    var shortBreakDuration: TimeInterval
    var longBreakDuration: TimeInterval
    var sessionsBeforeLongBreak: Int
    var minimumCreditDuration: TimeInterval  // Minimum for partial credit
  
    // Automation
    var autoStartBreaks: Bool
    var autoStartNextSession: Bool
    var dailySessionGoal: Int
  
    // Aesthetics
    var soundscapeID: String?
    var breakSoundscapeID: String?
    var themeColor: HabitColor
  
    // Enforcement
    var blockingLevel: BlockingLevel
    var blockedAppIDs: Set<String>
    var blockedWebCategories: Set<String>
  
    // AI Adaptive
    var enableAdaptiveDuration: Bool
    var enableSmartBreakSuggestions: Bool
    var enablePeakWindowDetection: Bool
}
```

---

## 19. API SURFACE & PROTOCOLS

### 19.1 TimerEngine Public API

```swift
protocol TimerEngineProtocol {
    // State
    var state: TimerState { get }
    var elapsed: TimeInterval { get }
    var remaining: TimeInterval { get }
    var progress: Double { get }              // 0.0–1.0
    var currentSession: Int { get }
    var currentPhase: SessionPhase { get }
  
    // Publishers
    var statePublisher: AnyPublisher<TimerState, Never> { get }
    var tickPublisher: AnyPublisher<TimeInterval, Never> { get }   // Every second
    var phasePublisher: AnyPublisher<SessionPhase, Never> { get }
    var sessionCompletePublisher: AnyPublisher<SessionRecord, Never> { get }
  
    // Actions
    func start(session: SessionConfiguration) async throws
    func pause() async
    func resume() async
    func skip() async                         // Skip to next phase
    func end() async -> SessionRecord
    func extendBreak(by seconds: TimeInterval) async
}
```

### 19.2 Notification Contract

All internal events are communicated via `NotificationCenter` with typed wrappers:

```swift
extension Notification.Name {
    static let habyssSessionStarted     = Notification.Name("habyss.session.started")
    static let habyssSessionPaused      = Notification.Name("habyss.session.paused")
    static let habyssSessionResumed     = Notification.Name("habyss.session.resumed")
    static let habyssSessionCompleted   = Notification.Name("habyss.session.completed")
    static let habyssBreakStarted       = Notification.Name("habyss.break.started")
    static let habyssBreakEnded         = Notification.Name("habyss.break.ended")
    static let habyssInterrupted        = Notification.Name("habyss.session.interrupted")
    static let habyssBlockingEnabled    = Notification.Name("habyss.blocking.enabled")
    static let habyssBlockingDisabled   = Notification.Name("habyss.blocking.disabled")
    static let habyssLiveActivityUpdate = Notification.Name("habyss.liveactivity.update")
}
```

---

## 20. ROADMAP & FEATURE FLAGS

### 20.1 v1.0 — Core (Build This First)

* [X] Five timer modes (Classic, Deep Work, Flow, Sprint, Adaptive)
* [X] Habit-Timer integration (per-habit profiles)
* [X] Dynamic Island compact + expanded + break states
* [X] Live Activity (Lock Screen widget)
* [X] StandBy Mode view
* [X] Basic soundscapes (10 tracks)
* [X] Session complete notification
* [X] Per-session quality rating
* [X] Core analytics (session history, streak)
* [X] Session persistence across app kills
* [X] Soft blocking (Level 1)

### 20.2 v1.1 — Focus Enforcement

* [ ] Hard blocking (Level 2) — Screen Time API
* [ ] Session Active Screen on unlock
* [ ] Interruption tracking and analytics
* [ ] Break optimization engine (break activity suggestions)
* [ ] Extended soundscape library (30+ tracks)

### 20.3 v1.2 — Intelligence

* [ ] AI Adaptive Mode (on-device ML, CoreML)
* [ ] Willpower Bank visualization
* [ ] Peak performance window detection
* [ ] Weekly AI digest
* [ ] Habit-specific blocking presets

### 20.4 v1.3 — Everywhere

* [ ] Apple Watch app (full session control)
* [ ] Watch face complications
* [ ] Absolute blocking (Level 3) — FamilyControls
* [ ] iPad companion (split-view focus mode)
* [ ] Mac Catalyst menu bar

### 20.5 v2.0 — Social & Gamification

* [ ] Focus rooms (friends doing sessions simultaneously — silent accountability)
* [ ] Shared streaks (habit partnerships)
* [ ] Depth leaderboards (weekly focus time, clean sessions)
* [ ] Session NFT badges (on-device — no blockchain — just beautiful earned badges)
* [ ] Habit challenges (community 30-day challenges)

---

## APPENDIX A: DESIGN TOKEN REFERENCE

```swift
// Timing
let transitionDuration: Double = 0.3       // Standard UI transition
let timerTickInterval: Double = 1.0        // Timer update frequency
let islandExpandDuration: Double = 0.4     // Dynamic Island expansion
let aodUpdateInterval: Double = 60.0       // Always-On Display update rate
let breakTransitionFadeDuration: Double = 3.0  // Soundscape crossfade

// Haptic Intensities
let hapticLight: Float = 0.3
let hapticMedium: Float = 0.6
let hapticStrong: Float = 1.0

// Blocking
let hardBlockInterstitialDelay: Double = 5.0      // seconds before accessing blocked app
let emergencyOverrideHoldDuration: Double = 10.0  // seconds to hold for emergency
let maxBreakExtensions: Int = 2                    // per cycle

// Partial Credit
let minimumCreditFraction: Double = 0.5           // 50% of planned = counts
```

---

## APPENDIX B: ONBOARDING FLOW FOR TIMER SYSTEM

The timer system requires two sensitive permissions. Onboarding must handle these carefully:

**Step 1: Notifications**

```
"Session sessions send you a heads-up when breaks end and sessions 
complete. No marketing. No spam. Only your sessions."
[Enable Notifications]  [Not now]
```

**Step 2: Screen Time (for blocking)**

```
"Habyss can block distracting apps during your sessions — but only 
when YOU choose to. This requires a one-time Screen Time permission.
You're always in control."
[Enable Focus Blocking]  [Skip for now]
```

Both permissions can be enabled later from Settings → Habyss → Permissions.

---

## APPENDIX C: NOMENCLATURE GUIDE

Use these terms consistently across all UI copy:

| System Term             | UI Label                  | Never Use         |
| ----------------------- | ------------------------- | ----------------- |
| Session                 | Session / Dive            | Timer, Task       |
| SessionPhase.focus      | Focus / In the Abyss      | Work, Pomodoro    |
| SessionPhase.shortBreak | Break / Surface           | Rest, Pause       |
| SessionPhase.longBreak  | Deep Break / Long Surface | Long Rest         |
| TimerMode.flowState     | Flow Mode                 | Open Timer        |
| TimerMode.sprint        | Sprint Mode               | Fast Timer        |
| BlockingLevel.absolute  | Lockdown Mode             | Block Everything  |
| SessionQuality.zone     | Zone ⚡                   | Perfect, Max      |
| InterruptionEvent       | Interruption              | Distraction, Fail |
| SessionRecord           | Session                   | Log, Entry        |
| DailyStats              | Today's Depth             | Stats, Data       |

---

*HABYSS DEEP FOCUS ENGINE — Product Specification v1.0*

*Built for Habyss · Authored February 2025*

*Go deep. Stay there. Come up transformed.*

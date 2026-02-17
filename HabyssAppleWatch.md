# Habyss Apple Watch App — Complete Implementation Specification

> **Version:** 1.0  
> **Target:** watchOS 10+, paired with Habyss iOS app (React Native / Expo)  
> **Architecture:** Native Swift + SwiftUI watchOS Extension with WatchConnectivity sync  
> **Supabase backend:** Shared with iOS app, same auth session via Keychain sharing

---

## Table of Contents

1. [Overview & Design Philosophy](#1-overview--design-philosophy)
2. [Feature Set Summary](#2-feature-set-summary)
3. [Project Structure](#3-project-structure)
4. [Data Models & Sync Architecture](#4-data-models--sync-architecture)
5. [Screen-by-Screen Specification](#5-screen-by-screen-specification)
   - 5.1 [Watch Face Complications](#51-watch-face-complications)
   - 5.2 [Main Dashboard — Glance View](#52-main-dashboard--glance-view)
   - 5.3 [Today's Habits List](#53-todays-habits-list)
   - 5.4 [Habit Detail & Check-In](#54-habit-detail--check-in)
   - 5.5 [Focus Timer](#55-focus-timer)
   - 5.6 [Quick Add Habit Entry](#56-quick-add-habit-entry)
   - 5.7 [Progress Ring Screen](#57-progress-ring-screen)
   - 5.8 [Streak Board](#58-streak-board)
   - 5.9 [Body Metrics & Heart Rate Zone](#59-body-metrics--heart-rate-zone)
   - 5.10 [Mindfulness / Breathing Prompt](#510-mindfulness--breathing-prompt)
   - 5.11 [Daily Summary Notification View](#511-daily-summary-notification-view)
   - 5.12 [Settings & Preferences](#512-settings--preferences)
6. [Haptic Feedback System](#6-haptic-feedback-system)
7. [Notifications & Smart Reminders](#7-notifications--smart-reminders)
8. [HealthKit Integration](#8-healthkit-integration)
9. [Complications Specification (ClockKit / WidgetKit)](#9-complications-specification-clockkit--widgetkit)
10. [WatchConnectivity Sync Protocol](#10-watchconnectivity-sync-protocol)
11. [Offline & Background Refresh Strategy](#11-offline--background-refresh-strategy)
12. [Animation & Motion Guidelines](#12-animation--motion-guidelines)
13. [Accessibility](#13-accessibility)
14. [File-by-File Implementation Guide](#14-file-by-file-implementation-guide)
15. [Xcode Project Setup Instructions](#15-xcode-project-setup-instructions)
16. [Testing Checklist](#16-testing-checklist)

---

## 1. Overview & Design Philosophy

The Habyss Watch app is a **first-class companion**, not a secondary screen dump. Every interaction must be completable in **under 5 seconds** from wrist-raise to task-done. The watch solves one core problem: keeping the user's habits alive throughout the day without needing to pull out the phone.

### Design Pillars

| Pillar | What it means in practice |
|--------|--------------------------|
| **Instant Glanceability** | The watch face complication tells the user everything they need at a glance: completion ratio + next due habit |
| **One-Tap Check-In** | Completing a habit must be achievable in a single tap from the habit list |
| **Contextual Intelligence** | The app uses time-of-day, heart rate, and movement data to surface the right habit at the right moment |
| **Deep Haptics** | Rich, distinct haptic patterns for success, reminder, streak milestone, and warning states |
| **Background Persistence** | Habit streaks, timers, and metrics update even when the app is not in the foreground |

### Visual Language

- **Background:** Pure black `#000000` — maximum OLED efficiency
- **Primary accent:** Habyss blue `#3B82F6` (matches iOS app)
- **Secondary accent:** Indigo `#6366F1`
- **Success state:** Emerald `#10B981`
- **Warning / streak at risk:** Amber `#F59E0B`
- **Danger / missed:** Rose `#F43F5E`
- **Typography:** SF Rounded for headers (warm, friendly), SF Pro for body text
- **Corner radius:** 12pt for cards, 8pt for buttons
- **All colors must pass WCAG AA contrast on black background**

---

## 2. Feature Set Summary

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| 1 | Today's habit list with 1-tap check-in | P0 | Core |
| 2 | Watch face complications (5 families) | P0 | Always-on display support |
| 3 | Focus / Pomodoro timer with haptic countdown | P0 | Synced with iOS |
| 4 | Progress rings (daily, weekly, monthly) | P0 | |
| 5 | Streak display & milestone celebrations | P0 | |
| 6 | Smart contextual reminders | P1 | Time + HRV aware |
| 7 | HealthKit read/write (steps, HRV, sleep, calories) | P1 | |
| 8 | Daily summary notification view | P1 | |
| 9 | Breathing / mindfulness prompt | P1 | Native-feeling |
| 10 | Quick voice-add habit log via Siri shortcut | P1 | |
| 11 | Body metrics mini-dashboard | P1 | Heart rate + activity |
| 12 | Offline queue — sync when phone reconnects | P2 | |
| 13 | Habit reorder via Digital Crown scroll | P2 | |
| 14 | Weekly habit calendar heatmap | P2 | 7-day glance |
| 15 | Complication tap → specific habit deep link | P2 | |

---

## 3. Project Structure

The watch app lives as a native Xcode target inside (or alongside) the Expo project. Since Habyss uses Expo, add the watchOS app as a **native module** in the `ios/` folder via an EAS custom build.

```
Habyss/
├── ios/
│   ├── Habyss/                          ← existing iOS app target
│   │   └── ...
│   ├── HabyssWatch/                     ← NEW: Watch App target
│   │   ├── HabyssWatchApp.swift
│   │   ├── ContentView.swift
│   │   ├── Assets.xcassets/
│   │   ├── Info.plist
│   │   └── Screens/
│   │       ├── Dashboard/
│   │       │   ├── DashboardView.swift
│   │       │   └── DashboardViewModel.swift
│   │       ├── HabitList/
│   │       │   ├── HabitListView.swift
│   │       │   ├── HabitRowView.swift
│   │       │   └── HabitListViewModel.swift
│   │       ├── HabitDetail/
│   │       │   ├── HabitDetailView.swift
│   │       │   └── HabitDetailViewModel.swift
│   │       ├── FocusTimer/
│   │       │   ├── FocusTimerView.swift
│   │       │   └── FocusTimerViewModel.swift
│   │       ├── ProgressRings/
│   │       │   ├── ProgressRingsView.swift
│   │       │   └── ProgressRingsViewModel.swift
│   │       ├── StreakBoard/
│   │       │   ├── StreakBoardView.swift
│   │       │   └── StreakBoardViewModel.swift
│   │       ├── BodyMetrics/
│   │       │   ├── BodyMetricsView.swift
│   │       │   └── BodyMetricsViewModel.swift
│   │       ├── Breathing/
│   │       │   └── BreathingView.swift
│   │       └── Settings/
│   │           └── SettingsView.swift
│   ├── HabyssWatchComplication/         ← NEW: Widget Extension target
│   │   ├── HabyssComplication.swift
│   │   ├── ComplicationProvider.swift
│   │   └── ComplicationViews/
│   │       ├── CornerComplicationView.swift
│   │       ├── CircularComplicationView.swift
│   │       ├── RectangularComplicationView.swift
│   │       ├── InlineComplicationView.swift
│   │       └── GraphicBezelComplicationView.swift
│   └── Shared/                          ← Shared between iOS + Watch
│       ├── Models/
│       │   ├── Habit.swift
│       │   ├── HabitLog.swift
│       │   ├── FocusSession.swift
│       │   └── UserProfile.swift
│       ├── Services/
│       │   ├── WatchConnectivityService.swift
│       │   ├── HabitSyncService.swift
│       │   ├── HealthKitService.swift
│       │   └── NotificationService.swift
│       ├── Extensions/
│       │   ├── Color+Habyss.swift
│       │   ├── Date+Habyss.swift
│       │   └── View+Habyss.swift
│       └── Constants.swift
```

---

## 4. Data Models & Sync Architecture

### 4.1 Core Models (Shared Swift Files)

#### `Habit.swift`
```swift
import Foundation

struct Habit: Codable, Identifiable, Hashable {
    let id: UUID
    var title: String
    var emoji: String           // e.g. "💧" "🏃" "📖"
    var category: HabitCategory
    var frequency: HabitFrequency
    var targetCount: Int        // e.g. 8 (glasses of water)
    var unit: String            // e.g. "glasses", "pages", "minutes"
    var scheduledTimes: [Date]  // specific reminder times
    var color: String           // hex string matching iOS color
    var streakCount: Int
    var longestStreak: Int
    var isCompletedToday: Bool
    var completionCount: Int    // how many times completed today
    var isPinned: Bool          // show first in Watch list
    var createdAt: Date
    
    // Watch-specific
    var watchPriority: Int      // manual sort order on Watch
    var supportsCountable: Bool // can be logged multiple times per day
}

enum HabitCategory: String, Codable, CaseIterable {
    case health = "health"
    case fitness = "fitness"
    case mindfulness = "mindfulness"
    case learning = "learning"
    case productivity = "productivity"
    case social = "social"
    case custom = "custom"
    
    var systemImage: String {
        switch self {
        case .health: return "heart.fill"
        case .fitness: return "figure.run"
        case .mindfulness: return "brain.head.profile"
        case .learning: return "book.fill"
        case .productivity: return "checklist"
        case .social: return "person.2.fill"
        case .custom: return "star.fill"
        }
    }
}

enum HabitFrequency: String, Codable {
    case daily = "daily"
    case weekdays = "weekdays"
    case weekends = "weekends"
    case custom = "custom"    // specific days of week
}
```

#### `HabitLog.swift`
```swift
struct HabitLog: Codable, Identifiable {
    let id: UUID
    let habitId: UUID
    let completedAt: Date
    let count: Int          // for countable habits
    let source: LogSource   // .watch | .phone | .siri
    let mood: Int?          // 1–5 optional mood rating
    let note: String?       // optional quick note
    
    // Sync metadata
    var syncedToCloud: Bool
    var watchLocalId: String  // temporary local ID before cloud sync
}

enum LogSource: String, Codable {
    case watch = "watch"
    case phone = "phone"
    case siri = "siri"
    case widget = "widget"
}
```

#### `FocusSession.swift`
```swift
struct FocusSession: Codable, Identifiable {
    let id: UUID
    var mode: FocusMode
    var totalDuration: TimeInterval
    var elapsed: TimeInterval
    var isRunning: Bool
    var isPaused: Bool
    var startedAt: Date?
    var completedAt: Date?
    var habitId: UUID?      // linked habit (optional)
    
    var remainingTime: TimeInterval { totalDuration - elapsed }
    var progress: Double { elapsed / totalDuration }
}

enum FocusMode: String, Codable, CaseIterable {
    case pomodoro = "pomodoro"          // 25 min
    case deepFocus = "deep_focus"       // 90 min
    case shortBreak = "short_break"     // 5 min
    case longBreak = "long_break"       // 15 min
    case custom = "custom"
    
    var defaultDuration: TimeInterval {
        switch self {
        case .pomodoro: return 25 * 60
        case .deepFocus: return 90 * 60
        case .shortBreak: return 5 * 60
        case .longBreak: return 15 * 60
        case .custom: return 25 * 60
        }
    }
    
    var displayName: String {
        switch self {
        case .pomodoro: return "Focus"
        case .deepFocus: return "Deep Work"
        case .shortBreak: return "Short Break"
        case .longBreak: return "Long Break"
        case .custom: return "Custom"
        }
    }
    
    var accentColor: String {
        switch self {
        case .pomodoro: return "#3B82F6"
        case .deepFocus: return "#6366F1"
        case .shortBreak: return "#10B981"
        case .longBreak: return "#10B981"
        case .custom: return "#F59E0B"
        }
    }
}
```

### 4.2 Sync Architecture

```
iOS App (React Native)          Watch App (SwiftUI)
       │                               │
       │◄──── WatchConnectivity ──────►│
       │   (applicationContext,         │
       │    sendMessage,               │
       │    transferUserInfo)           │
       │                               │
       ▼                               ▼
  Supabase DB                  UserDefaults (Watch)
  (source of truth)            + WatchConnectivityService
                                 (local cache / offline queue)
```

**Sync Rules:**
1. **On app launch:** Watch requests full habit list from iOS via `WatchConnectivity.updateApplicationContext`
2. **On habit check-in (Watch):** Immediately update local cache, queue log in offline buffer, send via `sendMessage` if phone is reachable; otherwise flush via `transferUserInfo` when connection resumes
3. **On focus timer start/pause/complete:** Bidirectional sync so both devices show same state
4. **Background refresh:** Every 15 minutes (watchOS background budget), fetch incremental updates
5. **Conflict resolution:** Last-write-wins by `completedAt` timestamp; cloud is always authoritative for streak counts

---

## 5. Screen-by-Screen Specification

### 5.1 Watch Face Complications

See [Section 9](#9-complications-specification-clockkit--widgetkit) for detailed ClockKit/WidgetKit spec.

---

### 5.2 Main Dashboard — Glance View

**Route:** Root view when app opens  
**Goal:** Show the user their day at a glance in 2 seconds

#### Layout (vertical scroll, `ScrollView` with `.navigationTitle("Today")`)

```
┌─────────────────────────────┐
│  ⚡ Good morning, Alex       │  ← dynamic greeting by time of day
│                              │
│  ┌──────────────────────┐   │
│  │  ████████░░  6 / 8   │   │  ← Daily progress arc (large)
│  │    habits done        │   │
│  └──────────────────────┘   │
│                              │
│  🔥 12-day streak            │  ← longest active streak badge
│                              │
│  ──── Up Next ────           │
│  💧 Drink Water  • 3 left    │  ← next incomplete habit
│                              │
│  [ Start Focus ] [ Log All ] │  ← two action buttons
└─────────────────────────────┘
```

#### Implementation Notes

```swift
struct DashboardView: View {
    @StateObject var vm = DashboardViewModel()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Greeting
                Text(vm.greeting)
                    .font(.system(.caption, design: .rounded))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Main progress arc
                ProgressArcView(
                    progress: vm.completionRatio,
                    completed: vm.completedCount,
                    total: vm.totalCount
                )
                .frame(height: 100)
                
                // Streak badge (tap → StreakBoard)
                if vm.topStreak > 0 {
                    NavigationLink(destination: StreakBoardView()) {
                        StreakBadgeView(streak: vm.topStreak)
                    }
                    .buttonStyle(.plain)
                }
                
                // Next habit card
                if let next = vm.nextIncompleteHabit {
                    NavigationLink(destination: HabitDetailView(habit: next)) {
                        NextHabitCard(habit: next)
                    }
                    .buttonStyle(.plain)
                }
                
                // Action buttons
                HStack(spacing: 8) {
                    NavigationLink(destination: FocusTimerView()) {
                        Label("Focus", systemImage: "timer")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.habyssBlue)
                    
                    Button("Log All") { vm.logAllRemaining() }
                        .buttonStyle(.bordered)
                }
            }
            .padding()
        }
        .navigationTitle("Today")
        .onAppear { vm.refresh() }
    }
}
```

#### `DashboardViewModel`

```swift
@MainActor
class DashboardViewModel: ObservableObject {
    @Published var habits: [Habit] = []
    @Published var isLoading = false
    
    private let sync = WatchConnectivityService.shared
    
    var completedCount: Int { habits.filter(\.isCompletedToday).count }
    var totalCount: Int { habits.count }
    var completionRatio: Double {
        totalCount == 0 ? 0 : Double(completedCount) / Double(totalCount)
    }
    var nextIncompleteHabit: Habit? {
        habits.first(where: { !$0.isCompletedToday })
    }
    var topStreak: Int { habits.map(\.streakCount).max() ?? 0 }
    
    var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "⚡ Good morning"
        case 12..<17: return "☀️ Good afternoon"
        case 17..<21: return "🌆 Good evening"
        default: return "🌙 Good night"
        }
    }
    
    func refresh() {
        habits = HabitCacheService.shared.loadTodaysHabits()
        sync.requestUpdate()
    }
    
    func logAllRemaining() {
        let incomplete = habits.filter { !$0.isCompletedToday }
        for habit in incomplete {
            HabitLogService.shared.logCompletion(habitId: habit.id, source: .watch)
        }
        WKInterfaceDevice.current().play(.success)
        refresh()
    }
}
```

---

### 5.3 Today's Habits List

**Route:** `.navigationDestination` from Dashboard or Tab 2  
**Goal:** Full scannable list of all today's habits with inline check-in

#### Layout

```
┌─────────────────────────────┐
│  Today's Habits        [↕️] │  ← sort button
│  ─────────────────────────  │
│  ✅ 🏃 Morning Run          │  ← completed (dimmed, checkmark)
│  ✅ 📖 Read 20 pages        │
│  ○  💧 Drink Water  3/8 ──  │  ← countable: shows progress bar
│  ○  🧘 Meditate             │  ← simple: tap to complete
│  ○  💊 Take Vitamins        │
│  ⚠️ 📵 No Social Media      │  ← at-risk (approaching end of day)
└─────────────────────────────┘
```

#### `HabitListView.swift`

```swift
struct HabitListView: View {
    @StateObject var vm = HabitListViewModel()
    
    var body: some View {
        List {
            Section {
                ForEach(vm.habits) { habit in
                    NavigationLink(destination: HabitDetailView(habit: habit)) {
                        HabitRowView(
                            habit: habit,
                            onCheckIn: { vm.checkIn(habit) }
                        )
                    }
                    .listRowBackground(rowBackground(for: habit))
                }
            }
        }
        .listStyle(.carousel)
        .navigationTitle("Habits")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    vm.toggleSort()
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
            }
        }
        .onAppear { vm.load() }
    }
    
    func rowBackground(for habit: Habit) -> some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(habit.isCompletedToday
                  ? Color.habyssGreen.opacity(0.15)
                  : Color.white.opacity(0.05))
    }
}
```

#### `HabitRowView.swift`

```swift
struct HabitRowView: View {
    let habit: Habit
    let onCheckIn: () -> Void
    
    var body: some View {
        HStack(spacing: 10) {
            // Status indicator / check button
            Button(action: onCheckIn) {
                ZStack {
                    Circle()
                        .strokeBorder(
                            habit.isCompletedToday ? Color.habyssGreen : Color.white.opacity(0.4),
                            lineWidth: 2
                        )
                        .frame(width: 28, height: 28)
                    
                    if habit.isCompletedToday {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.habyssGreen)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(habit.isCompletedToday && !habit.supportsCountable)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(habit.emoji)
                        .font(.system(size: 14))
                    Text(habit.title)
                        .font(.system(.body, design: .rounded))
                        .foregroundColor(habit.isCompletedToday ? .secondary : .primary)
                        .strikethrough(habit.isCompletedToday && !habit.supportsCountable)
                        .lineLimit(1)
                }
                
                // Progress bar for countable habits
                if habit.supportsCountable {
                    let ratio = Double(habit.completionCount) / Double(habit.targetCount)
                    ProgressView(value: ratio)
                        .tint(Color(hex: habit.color))
                        .scaleEffect(y: 0.7)
                    Text("\(habit.completionCount)/\(habit.targetCount) \(habit.unit)")
                        .font(.system(.caption2, design: .rounded))
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Streak badge
            if habit.streakCount >= 3 {
                VStack(spacing: 1) {
                    Text("🔥")
                        .font(.system(size: 10))
                    Text("\(habit.streakCount)")
                        .font(.system(.caption2, design: .rounded, weight: .bold))
                        .foregroundColor(.habyssAmber)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
```

---

### 5.4 Habit Detail & Check-In

**Route:** Tapping any habit row  
**Goal:** Full detail with check-in, countable stepper, streak info, and weekly heatmap

#### Layout

```
┌─────────────────────────────┐
│  💧 Drink Water              │
│                              │
│  ░░░░░░░░░░░░ 3 / 8 glasses │  ← progress bar
│                              │
│  ◄ –1   [  3  ]   +1 ►      │  ← stepper (Digital Crown too)
│                              │
│  🔥 Streak: 12 days          │
│  ⭐ Best: 45 days             │
│                              │
│  ── This Week ───            │
│  M  T  W  T  F  S  S        │
│  ✓  ✓  ✓  ✓  ○  ─  ─       │  ← mini heatmap
│                              │
│  [  Mark Complete  ]         │  ← primary CTA (green)
│  [  Skip Today     ]         │  ← secondary (subtle)
└─────────────────────────────┘
```

#### `HabitDetailView.swift`

```swift
struct HabitDetailView: View {
    let habit: Habit
    @StateObject var vm: HabitDetailViewModel
    @Environment(\.dismiss) var dismiss
    
    init(habit: Habit) {
        self.habit = habit
        _vm = StateObject(wrappedValue: HabitDetailViewModel(habit: habit))
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Header
                HStack {
                    Text(habit.emoji)
                        .font(.system(size: 28))
                    VStack(alignment: .leading) {
                        Text(habit.title)
                            .font(.system(.headline, design: .rounded, weight: .bold))
                        Text(habit.category.rawValue.capitalized)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                
                // Progress for countable habits
                if habit.supportsCountable {
                    VStack(spacing: 6) {
                        ProgressView(value: vm.progress)
                            .tint(Color(hex: habit.color))
                        
                        // Stepper
                        HStack {
                            Button { vm.decrement() } label: {
                                Image(systemName: "minus")
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            
                            Spacer()
                            Text("\(vm.currentCount)")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                            Text("/ \(habit.targetCount)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            
                            Button { vm.increment() } label: {
                                Image(systemName: "plus")
                                    .frame(width: 32, height: 32)
                                    .background(Color.habyssBlue)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .focusable()
                    .digitalCrownRotation($vm.crownValue, from: 0, through: Double(habit.targetCount), sensitivity: .medium)
                }
                
                // Streak info
                HStack(spacing: 16) {
                    StatPill(emoji: "🔥", label: "Streak", value: "\(habit.streakCount)d")
                    StatPill(emoji: "⭐", label: "Best", value: "\(habit.longestStreak)d")
                }
                
                // Weekly mini heatmap
                WeeklyHeatmapView(habitId: habit.id, logs: vm.weekLogs)
                
                // Actions
                VStack(spacing: 8) {
                    Button {
                        vm.markComplete()
                        WKInterfaceDevice.current().play(.success)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
                    } label: {
                        Label("Mark Complete", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.habyssGreen)
                    .disabled(vm.isAlreadyComplete && !habit.supportsCountable)
                    
                    Button("Skip Today") {
                        vm.skipToday()
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(habit.title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { vm.load() }
    }
}
```

---

### 5.5 Focus Timer

**Route:** Dashboard "Start Focus" button or Tab 3  
**Goal:** Full Pomodoro/deep work timer with sessions linked to habits

#### Layout — Timer Running

```
┌─────────────────────────────┐
│  FOCUS • 25:00               │
│                              │
│       ┌──────────┐          │
│       │  21:47   │          │  ← large countdown (SF Rounded Mono)
│       │ ████████ │          │  ← circular progress ring
│       └──────────┘          │
│                              │
│  Linked: 📖 Read 20 pages    │  ← optional habit link
│                              │
│  [  Pause  ]  [  End  ]      │
└─────────────────────────────┘
```

#### Layout — Timer Selection (before start)

```
┌─────────────────────────────┐
│  Focus Timer                 │
│                              │
│  ┌───────┐  ┌───────────┐   │
│  │ Focus │  │ Deep Work │   │  ← mode pills
│  │ 25min │  │  90min    │   │
│  └───────┘  └───────────┘   │
│  ┌────────┐  ┌──────────┐   │
│  │ Short  │  │   Long   │   │
│  │ Break  │  │  Break   │   │
│  │  5min  │  │  15min   │   │
│  └────────┘  └──────────┘   │
│                              │
│  Link a habit? (optional)    │
│  [  Start  ]                 │
└─────────────────────────────┘
```

#### `FocusTimerView.swift`

```swift
struct FocusTimerView: View {
    @StateObject var vm = FocusTimerViewModel()
    
    var body: some View {
        Group {
            if vm.isRunning || vm.isPaused {
                activeTimerView
            } else {
                timerSelectionView
            }
        }
        .onReceive(vm.timerPublisher) { _ in vm.tick() }
    }
    
    var activeTimerView: some View {
        VStack(spacing: 12) {
            // Mode label
            Text(vm.session.mode.displayName.uppercased())
                .font(.system(.caption2, design: .rounded, weight: .semibold))
                .foregroundColor(Color(hex: vm.session.mode.accentColor))
                .kerning(1.5)
            
            // Circular progress ring with time
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.1), lineWidth: 6)
                
                Circle()
                    .trim(from: 0, to: vm.session.progress)
                    .stroke(
                        Color(hex: vm.session.mode.accentColor),
                        style: StrokeStyle(lineWidth: 6, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: vm.session.progress)
                
                Text(vm.timeRemainingString)
                    .font(.system(size: 32, weight: .bold, design: .rounded).monospacedDigit())
            }
            .frame(width: 110, height: 110)
            
            // Linked habit
            if let habit = vm.linkedHabit {
                HStack(spacing: 4) {
                    Text(habit.emoji)
                    Text(habit.title)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            // Controls
            HStack(spacing: 12) {
                Button {
                    vm.isPaused ? vm.resume() : vm.pause()
                } label: {
                    Image(systemName: vm.isPaused ? "play.fill" : "pause.fill")
                        .frame(width: 44, height: 44)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                
                Button {
                    vm.endSession()
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 44, height: 44)
                        .background(Color.habyssRose.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
    }
    
    var timerSelectionView: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Focus Timer")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                
                // Mode grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    ForEach(FocusMode.allCases.filter { $0 != .custom }, id: \.self) { mode in
                        ModeCard(mode: mode, isSelected: vm.selectedMode == mode) {
                            vm.selectedMode = mode
                        }
                    }
                }
                
                Button("Start") {
                    vm.startSession()
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.habyssBlue)
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
    }
}
```

#### `FocusTimerViewModel.swift`

```swift
@MainActor
class FocusTimerViewModel: ObservableObject {
    @Published var session = FocusSession(
        id: UUID(),
        mode: .pomodoro,
        totalDuration: FocusMode.pomodoro.defaultDuration,
        elapsed: 0,
        isRunning: false,
        isPaused: false
    )
    @Published var selectedMode: FocusMode = .pomodoro
    @Published var linkedHabit: Habit? = nil
    
    var isRunning: Bool { session.isRunning }
    var isPaused: Bool { session.isPaused }
    
    let timerPublisher = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let haptic = WKInterfaceDevice.current()
    private let sync = WatchConnectivityService.shared
    
    var timeRemainingString: String {
        let remaining = max(0, session.remainingTime)
        let minutes = Int(remaining) / 60
        let seconds = Int(remaining) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    func startSession() {
        session = FocusSession(
            id: UUID(),
            mode: selectedMode,
            totalDuration: selectedMode.defaultDuration,
            elapsed: 0,
            isRunning: true,
            isPaused: false,
            startedAt: .now,
            habitId: linkedHabit?.id
        )
        haptic.play(.start)
        sync.sendFocusSessionUpdate(session)
        
        // Request extended runtime session
        let extendedSession = WKExtendedRuntimeSession()
        extendedSession.start()
    }
    
    func tick() {
        guard session.isRunning && !session.isPaused else { return }
        session.elapsed += 1
        
        // Haptic at final 10 seconds
        let remaining = session.remainingTime
        if remaining <= 10 && remaining > 0 {
            haptic.play(.click)
        }
        
        if remaining <= 0 { completeSession() }
    }
    
    func pause() {
        session.isPaused = true
        haptic.play(.stop)
        sync.sendFocusSessionUpdate(session)
    }
    
    func resume() {
        session.isPaused = false
        haptic.play(.start)
        sync.sendFocusSessionUpdate(session)
    }
    
    func endSession() {
        session.isRunning = false
        haptic.play(.stop)
        sync.sendFocusSessionUpdate(session)
    }
    
    func completeSession() {
        session.isRunning = false
        session.completedAt = .now
        haptic.play(.success)
        
        // Auto-log linked habit if present
        if let habitId = session.habitId {
            HabitLogService.shared.logCompletion(habitId: habitId, source: .watch)
        }
        
        FocusSessionCache.shared.save(session)
        sync.sendFocusSessionUpdate(session)
    }
}
```

---

### 5.6 Quick Add Habit Entry

**Route:** Long-press on a habit row OR Digital Crown menu  
**Goal:** Allow user to add a quick note or increment count directly from notification

This is accessible as a **Notification Action** and via a **button on the habit detail**. Not a full habit creation flow (that stays on iOS), but a **quick log with optional note**.

```swift
struct QuickLogView: View {
    let habit: Habit
    @State private var note: String = ""
    @State private var mood: Int = 3
    @Environment(\.dismiss) var dismiss
    @StateObject var vm = QuickLogViewModel()
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Log: \(habit.emoji) \(habit.title)")
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .multilineTextAlignment(.center)
            
            // Mood picker (1-5 emoji scale)
            VStack(alignment: .leading, spacing: 4) {
                Text("How are you feeling?")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                HStack(spacing: 8) {
                    ForEach(1...5, id: \.self) { score in
                        Button {
                            mood = score
                        } label: {
                            Text(moodEmoji(score))
                                .font(.system(size: 20))
                                .scaleEffect(mood == score ? 1.2 : 0.9)
                                .animation(.spring(response: 0.3), value: mood)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            Button("Log It") {
                vm.log(habit: habit, mood: mood, note: note)
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(.habyssGreen)
        }
        .padding()
    }
    
    func moodEmoji(_ score: Int) -> String {
        ["😔", "😕", "😐", "🙂", "😄"][score - 1]
    }
}
```

---

### 5.7 Progress Ring Screen

**Route:** Tab 4 or tap on Dashboard arc  
**Goal:** Activity-ring-style visualization for daily, weekly, and monthly completion

```
┌─────────────────────────────┐
│  Progress                    │
│                              │
│  ┌─────────────────────┐    │
│  │   ┌───────────┐     │    │
│  │   │  ┌─────┐  │     │    │
│  │   │  │ 75% │  │     │    │  ← 3 nested rings
│  │   │  └─────┘  │     │    │
│  │   └───────────┘     │    │
│  └─────────────────────┘    │
│                              │
│  🔵 Today    75%             │
│  🟣 This Week 62%            │
│  🟢 This Month 71%           │
│                              │
│  [  Details  ]               │
└─────────────────────────────┘
```

```swift
struct ProgressRingsView: View {
    @StateObject var vm = ProgressRingsViewModel()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("Progress")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                
                // Three nested activity rings
                ZStack {
                    // Monthly ring (outer)
                    ProgressRingLayer(
                        progress: vm.monthlyProgress,
                        radius: 52,
                        color: .habyssGreen,
                        lineWidth: 9
                    )
                    // Weekly ring (middle)
                    ProgressRingLayer(
                        progress: vm.weeklyProgress,
                        radius: 38,
                        color: .habyssIndigo,
                        lineWidth: 9
                    )
                    // Daily ring (inner)
                    ProgressRingLayer(
                        progress: vm.dailyProgress,
                        radius: 24,
                        color: .habyssBlue,
                        lineWidth: 9
                    )
                }
                .frame(width: 120, height: 120)
                .padding(.vertical, 8)
                
                // Legend
                VStack(alignment: .leading, spacing: 6) {
                    RingLegendRow(color: .habyssBlue,   label: "Today",      value: vm.dailyProgress)
                    RingLegendRow(color: .habyssIndigo, label: "This Week",  value: vm.weeklyProgress)
                    RingLegendRow(color: .habyssGreen,  label: "This Month", value: vm.monthlyProgress)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
        }
    }
}

struct ProgressRingLayer: View {
    let progress: Double
    let radius: CGFloat
    let color: Color
    let lineWidth: CGFloat
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.15), lineWidth: lineWidth)
                .frame(width: radius * 2, height: radius * 2)
            
            Circle()
                .trim(from: 0, to: min(progress, 1.0))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .frame(width: radius * 2, height: radius * 2)
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.8, dampingFraction: 0.7), value: progress)
        }
    }
}
```

---

### 5.8 Streak Board

**Route:** Dashboard streak badge tap  
**Goal:** Showcase all active streaks, milestones, and at-risk habits

```
┌─────────────────────────────┐
│  🏆 Streaks                  │
│                              │
│  ┌──────────────────────┐   │
│  │ 🏃 Morning Run   45d 🔥  │   │  ← longest streak, highlighted
│  └──────────────────────┘   │
│                              │
│  💧 Water        12d 🔥      │
│  📖 Reading       8d 🔥      │
│  🧘 Meditation    3d         │
│                              │
│  ⚠️ At Risk Today:           │
│  💊 Vitamins — not done yet  │  ← end-of-day warning
│                              │
│  🌟 Milestone tomorrow!      │  ← 🏃 Run: 50-day milestone
└─────────────────────────────┘
```

```swift
struct StreakBoardView: View {
    @StateObject var vm = StreakBoardViewModel()
    
    var body: some View {
        List {
            // Top streak — featured card
            if let champion = vm.topStreakHabit {
                Section {
                    FeaturedStreakCard(habit: champion)
                        .listRowBackground(Color.habyssAmber.opacity(0.15))
                }
            }
            
            // All streaks
            Section("All Streaks") {
                ForEach(vm.habitsWithStreaks) { habit in
                    HStack {
                        Text(habit.emoji)
                        Text(habit.title)
                            .lineLimit(1)
                        Spacer()
                        Text("\(habit.streakCount)d")
                            .font(.system(.caption, design: .rounded, weight: .bold))
                            .foregroundColor(.habyssAmber)
                        if habit.streakCount >= 7 { Text("🔥") }
                    }
                }
            }
            
            // At-risk habits
            if !vm.atRiskHabits.isEmpty {
                Section {
                    ForEach(vm.atRiskHabits) { habit in
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.habyssAmber)
                                .font(.caption)
                            Text(habit.title)
                                .font(.caption)
                                .foregroundColor(.habyssAmber)
                        }
                    }
                } header: {
                    Text("⚠️ At Risk Today")
                        .foregroundColor(.habyssAmber)
                }
            }
            
            // Upcoming milestones
            if !vm.upcomingMilestones.isEmpty {
                Section("🌟 Coming Up") {
                    ForEach(vm.upcomingMilestones, id: \.habit.id) { milestone in
                        HStack {
                            Text(milestone.habit.emoji)
                            VStack(alignment: .leading) {
                                Text(milestone.habit.title).font(.caption)
                                Text("\(milestone.daysUntil)d to \(milestone.targetStreak)d goal")
                                    .font(.caption2).foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.carousel)
        .navigationTitle("Streaks")
        .onAppear { vm.load() }
    }
}
```

---

### 5.9 Body Metrics & Heart Rate Zone

**Route:** Tab 5 (bottom tab bar)  
**Goal:** Real-time HealthKit data relevant to habits — not a full health app, just the data that contextualizes habit performance

```
┌─────────────────────────────┐
│  Body Metrics                │
│                              │
│  ❤️ Heart Rate     72 bpm    │  ← live from HealthKit
│  🩺 HRV             48 ms    │  ← stress indicator
│  👣 Steps       6,234 / 10K  │  ← step ring progress
│  🔥 Calories     384 / 600   │  ← active calories
│  😴 Last Sleep    7h 12m     │  ← sleep from previous night
│  🧠 Readiness      82 / 100  │  ← calculated from HRV + sleep
│                              │
│  ── Habit Insights ─────     │
│  Sleep was good → great time │
│  to tackle hard habits today │
└─────────────────────────────┘
```

```swift
struct BodyMetricsView: View {
    @StateObject var vm = BodyMetricsViewModel()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Body Metrics")
                    .font(.system(.headline, design: .rounded, weight: .bold))
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Readiness score (most important, up top)
                ReadinessScoreCard(score: vm.readinessScore)
                
                // Metric grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    MetricCard(
                        icon: "heart.fill",
                        iconColor: .habyssRose,
                        label: "Heart Rate",
                        value: vm.heartRateString,
                        subtitle: vm.heartRateZoneLabel
                    )
                    MetricCard(
                        icon: "waveform.path.ecg",
                        iconColor: .habyssIndigo,
                        label: "HRV",
                        value: vm.hrvString,
                        subtitle: vm.hrvInsight
                    )
                    MetricCard(
                        icon: "figure.walk",
                        iconColor: .habyssGreen,
                        label: "Steps",
                        value: vm.stepsString,
                        subtitle: "\(vm.stepsPercent)% of goal"
                    )
                    MetricCard(
                        icon: "flame.fill",
                        iconColor: .habyssAmber,
                        label: "Calories",
                        value: vm.caloriesString,
                        subtitle: "active kcal"
                    )
                }
                
                // Sleep card (full width)
                SleepCard(
                    duration: vm.sleepDuration,
                    quality: vm.sleepQuality
                )
                
                // AI insight based on metrics
                if let insight = vm.habitInsight {
                    InsightBubble(text: insight)
                }
            }
            .padding()
        }
        .onAppear { vm.fetchMetrics() }
    }
}
```

---

### 5.10 Mindfulness / Breathing Prompt

**Route:** Accessible from Dashboard, Notification, or Siri  
**Goal:** Guided breathing exercise that counts as completing a mindfulness habit

```swift
struct BreathingView: View {
    @StateObject var vm = BreathingViewModel()
    
    var body: some View {
        VStack(spacing: 16) {
            Text(vm.phase.instruction)
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundColor(.secondary)
                .animation(.easeInOut, value: vm.phase)
            
            // Breathing circle — expands/contracts
            Circle()
                .fill(Color.habyssBlue.opacity(0.3))
                .frame(
                    width: vm.circleSize,
                    height: vm.circleSize
                )
                .animation(.easeInOut(duration: vm.phase.duration), value: vm.circleSize)
                .overlay(
                    Circle()
                        .stroke(Color.habyssBlue, lineWidth: 2)
                )
            
            Text(vm.countdownString)
                .font(.system(size: 28, weight: .bold, design: .rounded).monospacedDigit())
            
            // Session progress dots
            HStack(spacing: 6) {
                ForEach(0..<vm.totalCycles, id: \.self) { i in
                    Circle()
                        .fill(i < vm.completedCycles ? Color.habyssBlue : Color.white.opacity(0.2))
                        .frame(width: 6, height: 6)
                }
            }
            
            Button(vm.isRunning ? "Stop" : "Begin") {
                vm.isRunning ? vm.stop() : vm.start()
            }
            .buttonStyle(.borderedProminent)
            .tint(vm.isRunning ? .secondary : .habyssBlue)
        }
        .padding()
        .navigationTitle("Breathe")
    }
}

enum BreathingPhase {
    case inhale, hold, exhale, pause
    
    var instruction: String {
        switch self {
        case .inhale: return "Breathe In"
        case .hold: return "Hold"
        case .exhale: return "Breathe Out"
        case .pause: return "Pause"
        }
    }
    
    var duration: Double {
        switch self {
        case .inhale: return 4
        case .hold: return 4
        case .exhale: return 6
        case .pause: return 2
        }
    }
}
```

---

### 5.11 Daily Summary Notification View

**Route:** Triggered at user-set time (default 9 PM)  
**Goal:** End-of-day summary delivered as a rich notification with inline completion action

#### Notification Payload (sent from iOS app)
```json
{
  "aps": {
    "alert": {
      "title": "Day Summary 🌙",
      "body": "6/8 habits done • 🔥 12-day streak active"
    },
    "category": "DAILY_SUMMARY"
  },
  "completedCount": 6,
  "totalCount": 8,
  "topStreak": 12,
  "incompleteHabits": ["💊 Vitamins", "📵 No Social Media"],
  "tomorrowCount": 8
}
```

#### Notification Interface Controller

```swift
struct DailySummaryNotificationView: View {
    let notification: DailySummaryPayload
    
    var body: some View {
        VStack(spacing: 10) {
            Text("Day Summary")
                .font(.system(.headline, design: .rounded, weight: .bold))
            
            // Progress arc compact
            HStack {
                CircularProgressView(progress: notification.completionRatio, size: 44)
                VStack(alignment: .leading) {
                    Text("\(notification.completedCount)/\(notification.totalCount) habits")
                        .font(.system(.body, design: .rounded, weight: .semibold))
                    if notification.topStreak > 0 {
                        Text("🔥 \(notification.topStreak)-day streak")
                            .font(.caption2)
                            .foregroundColor(.habyssAmber)
                    }
                }
                Spacer()
            }
            
            // Remaining habits
            if !notification.incompleteHabits.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Still to do:")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    ForEach(notification.incompleteHabits, id: \.self) { habit in
                        Text("• \(habit)")
                            .font(.caption2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
    }
}
```

---

### 5.12 Settings & Preferences

```swift
struct SettingsView: View {
    @AppStorage("watchNotificationsEnabled") var notificationsEnabled = true
    @AppStorage("watchHapticsEnabled") var hapticsEnabled = true
    @AppStorage("watchReminderLeadTime") var reminderLeadMinutes = 15
    @AppStorage("watchComplicationStyle") var complicationStyle = "progress"
    @AppStorage("watchTheme") var watchTheme = "blue"
    
    var body: some View {
        List {
            Section("Notifications") {
                Toggle("Habit Reminders", isOn: $notificationsEnabled)
                
                Picker("Lead Time", selection: $reminderLeadMinutes) {
                    Text("5 min").tag(5)
                    Text("15 min").tag(15)
                    Text("30 min").tag(30)
                    Text("1 hour").tag(60)
                }
            }
            
            Section("Haptics") {
                Toggle("Haptic Feedback", isOn: $hapticsEnabled)
            }
            
            Section("Complication") {
                Picker("Style", selection: $complicationStyle) {
                    Text("Progress Ring").tag("progress")
                    Text("Streak Count").tag("streak")
                    Text("Next Habit").tag("next")
                }
            }
            
            Section("Sync") {
                Button("Sync with iPhone") {
                    WatchConnectivityService.shared.requestFullSync()
                }
                .foregroundColor(.habyssBlue)
                
                Button("Clear Watch Cache") {
                    HabitCacheService.shared.clearAll()
                }
                .foregroundColor(.habyssRose)
            }
            
            Section("About") {
                LabeledContent("Version", value: "1.0.0")
                LabeledContent("Synced", value: WatchConnectivityService.shared.lastSyncString)
            }
        }
        .navigationTitle("Settings")
    }
}
```

---

## 6. Haptic Feedback System

All haptic events must be distinct and meaningful. Never play haptics for passive operations.

```swift
// Constants.swift — Haptic Event Catalog
extension WKHapticType {
    // Map semantic events to haptic types
    static let habitComplete:    WKHapticType = .success        // ✅ Strong success
    static let streakMilestone:  WKHapticType = .notification   // 🎉 Milestone reached
    static let focusComplete:    WKHapticType = .success        // 🎯 Session done
    static let focusCountdown:   WKHapticType = .click          // ⏰ Last 10 seconds
    static let focusStart:       WKHapticType = .start          // ▶️ Timer begins
    static let focusPause:       WKHapticType = .stop           // ⏸ Timer paused
    static let reminder:         WKHapticType = .directionUp    // 🔔 Habit reminder
    static let streakAtRisk:     WKHapticType = .failure        // ⚠️ Streak warning
    static let quickLog:         WKHapticType = .click          // 👆 Fast tap confirm
    static let breathingInhale:  WKHapticType = .directionUp    // ↑ Breathe in cue
    static let breathingExhale:  WKHapticType = .directionDown  // ↓ Breathe out cue
}

struct HapticService {
    static let device = WKInterfaceDevice.current()
    
    static func play(_ type: WKHapticType) {
        guard UserDefaults.standard.bool(forKey: "watchHapticsEnabled") else { return }
        device.play(type)
    }
    
    // Celebratory double-tap for milestones
    static func playMilestone() {
        play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { play(.success) }
    }
    
    // Triple click for 100% completion
    static func playAllComplete() {
        play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { play(.success) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { play(.success) }
    }
}
```

---

## 7. Notifications & Smart Reminders

### Notification Categories

```swift
// NotificationService.swift

enum HabyssNotificationCategory: String {
    case habitReminder   = "HABIT_REMINDER"
    case streakAtRisk    = "STREAK_AT_RISK"
    case focusComplete   = "FOCUS_COMPLETE"
    case dailySummary    = "DAILY_SUMMARY"
    case milestone       = "MILESTONE"
}

class WatchNotificationService {
    
    static func registerCategories() {
        let checkIn = UNNotificationAction(
            identifier: "CHECK_IN",
            title: "✅ Done",
            options: .authenticationRequired
        )
        let skip = UNNotificationAction(
            identifier: "SKIP",
            title: "Skip",
            options: .destructive
        )
        let snooze = UNNotificationAction(
            identifier: "SNOOZE_15",
            title: "⏰ 15 min",
            options: []
        )
        
        let habitCategory = UNNotificationCategory(
            identifier: HabyssNotificationCategory.habitReminder.rawValue,
            actions: [checkIn, skip, snooze],
            intentIdentifiers: [],
            options: []
        )
        
        let streakCategory = UNNotificationCategory(
            identifier: HabyssNotificationCategory.streakAtRisk.rawValue,
            actions: [checkIn, snooze],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories(
            [habitCategory, streakCategory]
        )
    }
    
    // Smart reminder: fires when user is likely idle (low HRV variability = relaxed)
    static func scheduleContextualReminder(for habit: Habit, after delay: TimeInterval = 0) {
        let content = UNMutableNotificationContent()
        content.title = "\(habit.emoji) \(habit.title)"
        content.body = streakMessage(for: habit)
        content.categoryIdentifier = HabyssNotificationCategory.habitReminder.rawValue
        content.userInfo = ["habitId": habit.id.uuidString]
        content.sound = .defaultCritical
        
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(delay, 1),
            repeats: false
        )
        
        let request = UNNotificationRequest(
            identifier: "habit_\(habit.id.uuidString)",
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    // Streak-at-risk notification (2 hours before midnight if habit incomplete)
    static func scheduleStreakWarning(for habit: Habit) {
        guard habit.streakCount >= 3 else { return } // only warn for meaningful streaks
        
        let content = UNMutableNotificationContent()
        content.title = "🔥 Streak at Risk!"
        content.body = "\(habit.emoji) \(habit.title) — \(habit.streakCount)-day streak needs saving"
        content.categoryIdentifier = HabyssNotificationCategory.streakAtRisk.rawValue
        content.userInfo = ["habitId": habit.id.uuidString]
        
        // Fire at 10 PM if not done by then
        var components = Calendar.current.dateComponents([.year, .month, .day], from: .now)
        components.hour = 22
        components.minute = 0
        
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(
            identifier: "streak_warning_\(habit.id.uuidString)",
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(request)
    }
    
    static func scheduleMilestoneNotification(habit: Habit, milestone: Int) {
        let content = UNMutableNotificationContent()
        content.title = "🏆 Milestone Reached!"
        content.body = "\(habit.emoji) \(habit.title) — \(milestone)-day streak! You're unstoppable."
        content.categoryIdentifier = HabyssNotificationCategory.milestone.rawValue
        content.sound = .defaultRingtone
        
        let request = UNNotificationRequest(
            identifier: "milestone_\(habit.id.uuidString)_\(milestone)",
            content: content,
            trigger: nil // deliver immediately
        )
        UNUserNotificationCenter.current().add(request)
    }
    
    private static func streakMessage(for habit: Habit) -> String {
        switch habit.streakCount {
        case 0: return "Start your streak today!"
        case 1...6: return "\(habit.streakCount)-day streak going. Keep it up!"
        case 7...29: return "🔥 \(habit.streakCount) days strong. Don't stop now!"
        default: return "🏆 \(habit.streakCount)-day legend! Time to check in."
        }
    }
}
```

### Notification Response Handler

```swift
// In WatchAppDelegate or NotificationHandler

func handleNotificationResponse(_ response: UNNotificationResponse) {
    let habitId = UUID(uuidString: response.notification.request.content.userInfo["habitId"] as? String ?? "")
    
    switch response.actionIdentifier {
    case "CHECK_IN":
        if let id = habitId {
            HabitLogService.shared.logCompletion(habitId: id, source: .watch)
            HapticService.play(.habitComplete)
        }
    case "SKIP":
        // Mark skipped, don't break streak
        break
    case "SNOOZE_15":
        if let id = habitId, let habit = HabitCacheService.shared.habit(for: id) {
            WatchNotificationService.scheduleContextualReminder(for: habit, after: 15 * 60)
        }
    default:
        break
    }
}
```

---

## 8. HealthKit Integration

### Permissions to Request

```swift
// HealthKitService.swift

import HealthKit

class HealthKitService: ObservableObject {
    
    let store = HKHealthStore()
    
    let readTypes: Set<HKObjectType> = [
        HKObjectType.quantityType(forIdentifier: .heartRate)!,
        HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
        HKObjectType.quantityType(forIdentifier: .stepCount)!,
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
        HKObjectType.quantityType(forIdentifier: .restingHeartRate)!,
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
        HKObjectType.quantityType(forIdentifier: .oxygenSaturation)!,
        HKObjectType.quantityType(forIdentifier: .respiratoryRate)!,
    ]
    
    let writeTypes: Set<HKSampleType> = [
        HKObjectType.quantityType(forIdentifier: .mindfulSession)!,  // for meditation habit
    ]
    
    func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
    }
    
    // Fetch latest heart rate
    func fetchLatestHeartRate() async -> Double? {
        let type = HKObjectType.quantityType(forIdentifier: .heartRate)!
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { return }
            let bpm = sample.quantity.doubleValue(for: .init(from: "count/min"))
            DispatchQueue.main.async { /* update published property */ }
        }
        store.execute(query)
        return nil
    }
    
    // Compute Readiness Score (0-100) from HRV + sleep
    func computeReadinessScore(hrv: Double, sleepHours: Double, restingHR: Double) -> Int {
        // Higher HRV = more recovered
        let hrvScore = min(hrv / 80.0, 1.0) * 40  // 40 points max
        // Optimal sleep 7-9 hours
        let sleepScore: Double
        switch sleepHours {
        case 7..<9: sleepScore = 40
        case 6..<7: sleepScore = 25
        case 9...: sleepScore = 30
        default: sleepScore = 10
        }
        // Lower resting HR = better fitness
        let hrScore = max(0, 1.0 - (restingHR - 50) / 40.0) * 20
        return Int(hrvScore + sleepScore + hrScore)
    }
    
    // Generate habit insight from metrics
    func habitInsight(readiness: Int, hrv: Double) -> String? {
        switch readiness {
        case 80...100:
            return "💪 High readiness — tackle your most challenging habits today"
        case 60..<80:
            return "👍 Good energy — solid day for consistent habits"
        case 40..<60:
            return "😐 Moderate energy — focus on easier wins first"
        default:
            return "🧘 Low readiness — prioritize rest and mindfulness habits"
        }
    }
    
    // Log mindful session to HealthKit when meditation habit is completed
    func logMindfulSession(duration: TimeInterval, startDate: Date) {
        guard let type = HKObjectType.categoryType(forIdentifier: .mindfulSession) else { return }
        let sample = HKCategorySample(
            type: type,
            value: HKCategoryValue.notApplicable.rawValue,
            start: startDate,
            end: startDate.addingTimeInterval(duration)
        )
        store.save(sample) { _, _ in }
    }
}
```

---

## 9. Complications Specification (ClockKit / WidgetKit)

watchOS 9+ complications use **WidgetKit**. Implement a `Widget Extension` target.

### Complication Families to Support

| Family | Size | Content |
|--------|------|---------|
| `accessoryCircular` | Circular | Progress ring + percentage |
| `accessoryRectangular` | Wide | Habit name + progress bar |
| `accessoryInline` | Single line | "6/8 habits • 🔥12d" |
| `accessoryCorner` | Corner | Ring gauge |
| `graphicBezel` | Bezel | Ring + curved text |

### Entry & Timeline Provider

```swift
// ComplicationProvider.swift

import WidgetKit
import SwiftUI

struct HabyssComplicationEntry: TimelineEntry {
    let date: Date
    let completedCount: Int
    let totalCount: Int
    let topStreak: Int
    let nextHabitName: String?
    let nextHabitEmoji: String?
}

struct HabyssComplicationProvider: TimelineProvider {
    
    typealias Entry = HabyssComplicationEntry
    
    func placeholder(in context: Context) -> Entry {
        HabyssComplicationEntry(
            date: .now,
            completedCount: 5,
            totalCount: 8,
            topStreak: 12,
            nextHabitName: "Meditate",
            nextHabitEmoji: "🧘"
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(currentEntry())
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        var entries: [Entry] = []
        let now = Date()
        
        // Refresh every 15 minutes
        for minuteOffset in stride(from: 0, to: 60 * 4, by: 15) {
            let entryDate = Calendar.current.date(byAdding: .minute, value: minuteOffset, to: now)!
            entries.append(currentEntry(at: entryDate))
        }
        
        // Expire at midnight for fresh daily reset
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let timeline = Timeline(entries: entries, policy: .after(midnight))
        completion(timeline)
    }
    
    private func currentEntry(at date: Date = .now) -> HabyssComplicationEntry {
        let habits = HabitCacheService.shared.loadTodaysHabits()
        let completed = habits.filter(\.isCompletedToday)
        let next = habits.first(where: { !$0.isCompletedToday })
        
        return HabyssComplicationEntry(
            date: date,
            completedCount: completed.count,
            totalCount: habits.count,
            topStreak: habits.map(\.streakCount).max() ?? 0,
            nextHabitName: next?.title,
            nextHabitEmoji: next?.emoji
        )
    }
}
```

### Complication Views

```swift
// ComplicationViews

@main
struct HabyssComplicationBundle: WidgetBundle {
    var body: some Widget {
        HabyssComplication()
    }
}

struct HabyssComplication: Widget {
    let kind = "HabyssComplication"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabyssComplicationProvider()) { entry in
            HabyssComplicationEntryView(entry: entry)
        }
        .configurationDisplayName("Habyss")
        .description("Track your habits from your wrist.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .accessoryCorner
        ])
    }
}

struct HabyssComplicationEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: HabyssComplicationEntry
    
    var progress: Double {
        entry.totalCount == 0 ? 0 : Double(entry.completedCount) / Double(entry.totalCount)
    }
    
    var body: some View {
        switch family {
        case .accessoryCircular:
            CircularComplicationView(entry: entry, progress: progress)
        case .accessoryRectangular:
            RectangularComplicationView(entry: entry, progress: progress)
        case .accessoryInline:
            InlineComplicationView(entry: entry)
        case .accessoryCorner:
            CornerComplicationView(entry: entry, progress: progress)
        default:
            CircularComplicationView(entry: entry, progress: progress)
        }
    }
}

// Circular — Progress gauge ring
struct CircularComplicationView: View {
    let entry: HabyssComplicationEntry
    let progress: Double
    
    var body: some View {
        ZStack {
            ProgressView(value: progress)
                .progressViewStyle(.circular)
                .tint(Color.habyssBlue)
            
            VStack(spacing: 0) {
                Text("\(entry.completedCount)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                Text("/ \(entry.totalCount)")
                    .font(.system(size: 9, design: .rounded))
                    .foregroundColor(.secondary)
            }
        }
        .widgetAccentable()
    }
}

// Rectangular — Habit name + progress bar
struct RectangularComplicationView: View {
    let entry: HabyssComplicationEntry
    let progress: Double
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Habyss")
                    .font(.system(.caption2, design: .rounded, weight: .semibold))
                    .foregroundColor(.habyssBlue)
                Spacer()
                if entry.topStreak > 0 {
                    Text("🔥\(entry.topStreak)d")
                        .font(.system(.caption2, design: .rounded))
                }
            }
            
            // Progress bar
            ProgressView(value: progress)
                .tint(.habyssBlue)
            
            // Next habit
            if let next = entry.nextHabitName, let emoji = entry.nextHabitEmoji {
                Text("\(emoji) \(next)")
                    .font(.system(.caption2, design: .rounded))
                    .lineLimit(1)
                    .foregroundColor(.secondary)
            } else {
                Text("✅ All done today!")
                    .font(.system(.caption2, design: .rounded))
                    .foregroundColor(.habyssGreen)
            }
        }
        .widgetAccentable()
    }
}

// Inline — Single line
struct InlineComplicationView: View {
    let entry: HabyssComplicationEntry
    
    var body: some View {
        let streak = entry.topStreak > 0 ? " • 🔥\(entry.topStreak)d" : ""
        Text("\(entry.completedCount)/\(entry.totalCount) habits\(streak)")
            .font(.system(.caption2, design: .rounded))
            .widgetAccentable()
    }
}

// Corner — Curved gauge
struct CornerComplicationView: View {
    let entry: HabyssComplicationEntry
    let progress: Double
    
    var body: some View {
        ZStack {
            ProgressView(value: progress)
                .progressViewStyle(.circular)
                .tint(.habyssBlue)
            
            Text("\(entry.completedCount)")
                .font(.system(size: 13, weight: .bold, design: .rounded))
        }
        .widgetAccentable()
    }
}
```

---

## 10. WatchConnectivity Sync Protocol

```swift
// WatchConnectivityService.swift (Watch side)

import WatchConnectivity

class WatchConnectivityService: NSObject, ObservableObject, WCSessionDelegate {
    
    static let shared = WatchConnectivityService()
    
    @Published var isReachable = false
    @Published var lastSyncDate: Date?
    
    var lastSyncString: String {
        guard let date = lastSyncDate else { return "Never" }
        let formatter = RelativeDateTimeFormatter()
        return formatter.localizedString(for: date, relativeTo: .now)
    }
    
    private var offlineQueue: [HabitLog] = []
    
    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }
    
    // MARK: - Send Operations
    
    func sendHabitLog(_ log: HabitLog) {
        let payload: [String: Any] = [
            "type": "habit_log",
            "habitId": log.habitId.uuidString,
            "completedAt": log.completedAt.timeIntervalSince1970,
            "count": log.count,
            "source": log.source.rawValue,
            "mood": log.mood as Any
        ]
        
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: { _ in
                // Mark as synced
            }, errorHandler: { _ in
                self.offlineQueue.append(log)
                self.persistOfflineQueue()
            })
        } else {
            WCSession.default.transferUserInfo(payload)
        }
    }
    
    func sendFocusSessionUpdate(_ session: FocusSession) {
        guard let encoded = try? JSONEncoder().encode(session) else { return }
        let payload: [String: Any] = ["type": "focus_update", "session": encoded]
        
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
    }
    
    func requestFullSync() {
        let request: [String: Any] = ["type": "request_sync", "timestamp": Date().timeIntervalSince1970]
        WCSession.default.sendMessage(request, replyHandler: { response in
            if let habitsData = response["habits"] as? Data {
                self.processHabitsPayload(habitsData)
            }
        }, errorHandler: nil)
    }
    
    func requestUpdate() {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["type": "request_update"], replyHandler: { response in
            if let habitsData = response["habits"] as? Data {
                self.processHabitsPayload(habitsData)
            }
        }, errorHandler: nil)
    }
    
    // MARK: - Receive Operations
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        if let habitsData = applicationContext["habits"] as? Data {
            processHabitsPayload(habitsData)
        }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        // Handle habit updates pushed from iPhone
        if let habitsData = userInfo["habits"] as? Data {
            processHabitsPayload(habitsData)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        // Handle real-time messages from iPhone
        if let habitsData = message["habits"] as? Data {
            processHabitsPayload(habitsData)
            replyHandler(["status": "received"])
        }
    }
    
    // MARK: - WCSession Delegates
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
        if activationState == .activated {
            flushOfflineQueue()
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable { self.flushOfflineQueue() }
        }
    }
    
    // MARK: - Private Helpers
    
    private func processHabitsPayload(_ data: Data) {
        guard let habits = try? JSONDecoder().decode([Habit].self, from: data) else { return }
        DispatchQueue.main.async {
            HabitCacheService.shared.save(habits)
            self.lastSyncDate = .now
            self.scheduleComplicationRefresh()
            NotificationCenter.default.post(name: .habitsDidUpdate, object: nil)
        }
    }
    
    private func scheduleComplicationRefresh() {
        let server = CLKComplicationServer.sharedInstance()
        server.activeComplications?.forEach { server.reloadTimeline(for: $0) }
    }
    
    private func flushOfflineQueue() {
        let pending = offlineQueue
        offlineQueue.removeAll()
        persistOfflineQueue()
        pending.forEach { sendHabitLog($0) }
    }
    
    private func persistOfflineQueue() {
        if let data = try? JSONEncoder().encode(offlineQueue) {
            UserDefaults.standard.set(data, forKey: "offlineHabitLogs")
        }
    }
}

extension Notification.Name {
    static let habitsDidUpdate = Notification.Name("habitsDidUpdate")
}
```

### iOS Side Connector (React Native Bridge)

The iOS app needs to handle incoming watch requests. Create a native module:

```swift
// HabyssWatchBridge.swift (iOS target)

import WatchConnectivity
import React

@objc(HabyssWatchBridge)
class HabyssWatchBridge: NSObject, RCTBridgeModule, WCSessionDelegate {
    
    static func moduleName() -> String! { "HabyssWatchBridge" }
    static func requiresMainQueueSetup() -> Bool { false }
    
    private var session = WCSession.default
    
    @objc func setupConnectivity() {
        if WCSession.isSupported() {
            session.delegate = self
            session.activate()
        }
    }
    
    // Called from RN when habits change
    @objc func syncHabitsToWatch(_ habits: String) {
        guard let data = habits.data(using: .utf8) else { return }
        let context = ["habits": data, "timestamp": Date().timeIntervalSince1970] as [String: Any]
        
        do {
            try session.updateApplicationContext(context)
        } catch {
            session.transferUserInfo(context)
        }
    }
    
    // Handle incoming log from watch
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["type"] as? String == "habit_log" {
            // Emit to RN
            NotificationCenter.default.post(name: .watchHabitLogged, object: message)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        if message["type"] as? String == "request_sync" || message["type"] as? String == "request_update" {
            // Fetch habits from cache and reply
            if let habitsJson = UserDefaults.standard.data(forKey: "cachedHabitsForWatch") {
                replyHandler(["habits": habitsJson])
            }
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
```

---

## 11. Offline & Background Refresh Strategy

### Local Cache

```swift
// HabitCacheService.swift

class HabitCacheService {
    static let shared = HabitCacheService()
    
    private let userDefaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    func save(_ habits: [Habit]) {
        if let data = try? encoder.encode(habits) {
            userDefaults.set(data, forKey: "cachedHabits")
            userDefaults.set(Date(), forKey: "habitCacheDate")
        }
    }
    
    func loadTodaysHabits() -> [Habit] {
        guard let data = userDefaults.data(forKey: "cachedHabits"),
              let habits = try? decoder.decode([Habit].self, from: data) else {
            return []
        }
        // Filter by today's schedule
        return habits.filter { isScheduledToday($0) }
    }
    
    func habit(for id: UUID) -> Habit? {
        loadTodaysHabits().first { $0.id == id }
    }
    
    func clearAll() {
        userDefaults.removeObject(forKey: "cachedHabits")
        userDefaults.removeObject(forKey: "habitCacheDate")
    }
    
    func markCompleted(habitId: UUID, count: Int = 1) {
        var habits = loadTodaysHabits()
        if let idx = habits.firstIndex(where: { $0.id == habitId }) {
            habits[idx].isCompletedToday = true
            habits[idx].completionCount = min(
                habits[idx].completionCount + count,
                habits[idx].targetCount
            )
            save(habits)
        }
        // Refresh complication immediately
        WidgetCenter.shared.reloadAllTimelines()
    }
    
    private func isScheduledToday(_ habit: Habit) -> Bool {
        let weekday = Calendar.current.component(.weekday, from: .now)
        switch habit.frequency {
        case .daily: return true
        case .weekdays: return weekday >= 2 && weekday <= 6  // Mon-Fri
        case .weekends: return weekday == 1 || weekday == 7  // Sat-Sun
        case .custom: return true // TODO: check custom day mask
        }
    }
}
```

### Background App Refresh

```swift
// In HabyssWatchApp.swift

import WatchKit

class ExtensionDelegate: NSObject, WKApplicationDelegate {
    
    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            switch task {
            case let backgroundTask as WKApplicationRefreshBackgroundTask:
                // Sync habits from phone
                WatchConnectivityService.shared.requestUpdate()
                // Schedule next refresh (min 15-min interval)
                WKApplication.shared().scheduleBackgroundRefresh(
                    withPreferredDate: Date().addingTimeInterval(15 * 60),
                    userInfo: nil
                ) { _ in }
                backgroundTask.setTaskCompletedWithSnapshot(false)
                
            case let snapshotTask as WKSnapshotRefreshBackgroundTask:
                snapshotTask.setTaskCompleted(restoredDefaultState: true, estimatedSnapshotExpiration: .distantFuture, userInfo: nil)
                
            default:
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
    
    func applicationDidFinishLaunching() {
        // Schedule first background refresh
        WKApplication.shared().scheduleBackgroundRefresh(
            withPreferredDate: Date().addingTimeInterval(15 * 60),
            userInfo: nil
        ) { _ in }
    }
}
```

---

## 12. Animation & Motion Guidelines

| Animation | Type | Duration | Details |
|-----------|------|----------|---------|
| Habit check-in | Spring | 0.4s | Scale 1.0 → 1.2 → 1.0 with success haptic |
| Progress ring fill | Spring | 0.8s | `dampingFraction: 0.7` |
| Streak milestone | Particle burst | 1.2s | Custom confetti using `TimelineView` |
| Focus timer ring | Linear | 1s per tick | `animation(.linear(duration: 1))` |
| Breathing circle | EaseInOut | Phase duration | Tied to breathing phase |
| Tab transition | `.easeInOut` | 0.25s | Default SwiftUI navigation |
| Row completion | `strikethrough` | 0.3s | Fade to secondary color |

### Milestone Celebration Animation

```swift
struct MilestoneCelebrationView: View {
    let streakCount: Int
    @State private var showConfetti = false
    @State private var particles: [ConfettiParticle] = []
    
    var body: some View {
        ZStack {
            // Background glow
            Circle()
                .fill(Color.habyssAmber.opacity(0.2))
                .frame(width: 120)
                .scaleEffect(showConfetti ? 1.5 : 0.5)
                .opacity(showConfetti ? 0 : 1)
                .animation(.easeOut(duration: 1.0), value: showConfetti)
            
            VStack(spacing: 8) {
                Text("🏆")
                    .font(.system(size: 40))
                    .scaleEffect(showConfetti ? 1.0 : 0.1)
                    .animation(.spring(response: 0.5, dampingFraction: 0.6), value: showConfetti)
                
                Text("\(streakCount) Days!")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundColor(.habyssAmber)
                    .opacity(showConfetti ? 1 : 0)
                    .animation(.easeIn(duration: 0.4).delay(0.3), value: showConfetti)
                
                Text("Incredible Streak")
                    .font(.system(.caption, design: .rounded))
                    .foregroundColor(.secondary)
                    .opacity(showConfetti ? 1 : 0)
                    .animation(.easeIn(duration: 0.4).delay(0.5), value: showConfetti)
            }
        }
        .onAppear {
            showConfetti = true
            HapticService.playMilestone()
        }
    }
}
```

---

## 13. Accessibility

```swift
// All interactive elements must have:

// 1. Accessibility labels
Button(action: checkIn) {
    // ...
}
.accessibilityLabel("Mark \(habit.title) as complete")
.accessibilityHint("Logs today's habit and updates your streak")

// 2. Accessibility values for progress
CircularProgressView(progress: 0.75)
    .accessibilityValue("75 percent complete")

// 3. Reduce motion support
struct ProgressRingLayer: View {
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    
    var body: some View {
        Circle()
            .trim(from: 0, to: progress)
            .animation(reduceMotion ? nil : .spring(response: 0.8), value: progress)
    }
}

// 4. Dynamic Type — use .scaledMetric for spacing
@ScaledMetric var iconSize: CGFloat = 14

// 5. VoiceOver navigation order
HStack {
    statusButton
    titleText
    streakBadge
}
.accessibilitySortPriority(1) // ensure logical reading order

// 6. High contrast support
Color.habyssBlue.opacity(scheme == .dark ? 1.0 : 0.9)
```

---

## 14. File-by-File Implementation Guide

### Priority Order for Implementation

**Phase 1 — Core Functionality (Week 1)**
1. `Shared/Models/Habit.swift` — data models
2. `Shared/Models/HabitLog.swift`
3. `Shared/Services/WatchConnectivityService.swift` (Watch side)
4. `Shared/Services/HabitCacheService.swift`
5. `HabyssWatch/HabyssWatchApp.swift` — app entry point + tab navigation
6. `HabyssWatch/Screens/HabitList/HabitListView.swift`
7. `HabyssWatch/Screens/HabitList/HabitRowView.swift`
8. `HabyssWatch/Screens/HabitDetail/HabitDetailView.swift`
9. `HabyssWatch/Screens/Dashboard/DashboardView.swift`

**Phase 2 — Focus Timer (Week 1-2)**
10. `Shared/Models/FocusSession.swift`
11. `HabyssWatch/Screens/FocusTimer/FocusTimerView.swift`
12. `HabyssWatch/Screens/FocusTimer/FocusTimerViewModel.swift`

**Phase 3 — Complications (Week 2)**
13. `HabyssWatchComplication/ComplicationProvider.swift`
14. All `ComplicationViews/*.swift`

**Phase 4 — Health & Metrics (Week 2-3)**
15. `Shared/Services/HealthKitService.swift`
16. `HabyssWatch/Screens/BodyMetrics/BodyMetricsView.swift`
17. `HabyssWatch/Screens/BodyMetrics/BodyMetricsViewModel.swift`

**Phase 5 — Polish (Week 3)**
18. `HabyssWatch/Screens/StreakBoard/StreakBoardView.swift`
19. `HabyssWatch/Screens/ProgressRings/ProgressRingsView.swift`
20. `HabyssWatch/Screens/Breathing/BreathingView.swift`
21. `Shared/Services/NotificationService.swift`
22. `HabyssWatch/Screens/Settings/SettingsView.swift`
23. All Extensions (`Color+Habyss.swift`, `Date+Habyss.swift`, etc.)

**Phase 6 — iOS Bridge (Week 3)**
24. `ios/Habyss/HabyssWatchBridge.swift` — React Native native module
25. Update `app.json` + EAS build config

---

### `Color+Habyss.swift` (Complete)

```swift
import SwiftUI

extension Color {
    static let habyssBlue   = Color(hex: "#3B82F6")
    static let habyssIndigo = Color(hex: "#6366F1")
    static let habyssGreen  = Color(hex: "#10B981")
    static let habyssAmber  = Color(hex: "#F59E0B")
    static let habyssRose   = Color(hex: "#F43F5E")
    static let habyssViolet = Color(hex: "#8B5CF6")
    
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}
```

### `Constants.swift` (Complete)

```swift
import Foundation

enum HabyssConstants {
    // Streak milestones for notifications
    static let streakMilestones = [7, 14, 21, 30, 50, 66, 100, 365]
    
    // Default focus durations (seconds)
    static let pomodoroDefault: TimeInterval = 25 * 60
    static let deepFocusDefault: TimeInterval = 90 * 60
    static let shortBreakDefault: TimeInterval = 5 * 60
    static let longBreakDefault: TimeInterval = 15 * 60
    
    // Notification identifiers
    static let dailySummaryId = "habyss_daily_summary"
    
    // UserDefaults keys
    static let cachedHabitsKey = "cachedHabits"
    static let offlineQueueKey = "offlineHabitLogs"
    static let habitCacheDateKey = "habitCacheDate"
    
    // UI
    static let cornerRadius: CGFloat = 12
    static let smallCornerRadius: CGFloat = 8
    static let cardPadding: CGFloat = 12
}
```

---

## 15. Xcode Project Setup Instructions

### Step 1 — Create Watch App Target

1. Open `ios/Habyss.xcworkspace` in Xcode
2. File → New → Target → **watchOS → Watch App**
3. Product Name: `HabyssWatch`
4. Bundle ID: `com.habyss.app.watchkitapp`
5. **Uncheck** "Include Notification Scene" (handled manually)
6. **Check** "Include Complications"
7. Set minimum deployment: **watchOS 10.0**

### Step 2 — Create Complication Extension Target

1. File → New → Target → **watchOS → Widget Extension**
2. Product Name: `HabyssWatchComplication`
3. Bundle ID: `com.habyss.app.watchkitapp.complication`
4. **Uncheck** "Include Configuration App Intent"

### Step 3 — Create Shared Group

1. Both targets + iOS app → Signing & Capabilities → Add Capability → **App Groups**
2. Group name: `group.com.habyss.shared`
3. Update `UserDefaults` calls to use the shared group:
   ```swift
   UserDefaults(suiteName: "group.com.habyss.shared")
   ```

### Step 4 — Enable Capabilities

For `HabyssWatch` target add:
- HealthKit
- Background Modes: Background App Refresh
- Push Notifications
- WatchKit Complication

### Step 5 — Info.plist Additions

**HabyssWatch/Info.plist:**
```xml
<key>NSHealthShareUsageDescription</key>
<string>Habyss reads your health data to provide personalized habit insights and smart reminders</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Habyss logs mindful sessions to your Health app when you complete meditation habits</string>
<key>WKWatchOnly</key>
<false/>
```

### Step 6 — EAS Build Configuration

In `eas.json`, add custom build steps:
```json
{
  "build": {
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "enterpriseProvisioning": "universal"
      }
    }
  }
}
```

In `app.json`, add the watch app plugin:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "16.0"
          }
        }
      ]
    ],
    "ios": {
      "bundleIdentifier": "com.habyss.app",
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.habyss.shared"]
      }
    }
  }
}
```

### Step 7 — React Native Bridge Registration

**ios/Habyss/AppDelegate.mm** — add bridge module:
```objc
#import "HabyssWatchBridge.h"

// In application:didFinishLaunchingWithOptions:
HabyssWatchBridge *watchBridge = [[HabyssWatchBridge alloc] init];
[watchBridge setupConnectivity];
```

**In React Native (TypeScript):**
```typescript
// lib/watchConnectivity.ts
import { NativeModules } from 'react-native';
const { HabyssWatchBridge } = NativeModules;

export const syncHabitsToWatch = (habits: Habit[]) => {
  const payload = JSON.stringify(habits);
  HabyssWatchBridge?.syncHabitsToWatch(payload);
};

// Call this whenever habits or logs update:
// useEffect(() => { syncHabitsToWatch(habits); }, [habits]);
```

---

## 16. Testing Checklist

### Functional Tests

| Test | Expected | Pass |
|------|----------|------|
| Open app with no phone connection | Show cached habits | ☐ |
| Check in habit offline | Log queued, syncs on reconnect | ☐ |
| Check in habit with phone connected | Syncs immediately, complication updates | ☐ |
| Start Pomodoro timer | Countdown runs even when app backgrounded | ☐ |
| Complete Pomodoro | Haptic fires, linked habit auto-logged | ☐ |
| Streak milestone (7 days) | Celebration animation + notification | ☐ |
| All habits complete | Triple haptic, progress rings at 100% | ☐ |
| Daily summary notification at 9PM | Shows correct counts + inline action works | ☐ |
| Notification check-in action | Marks habit complete without opening app | ☐ |
| Snooze reminder 15 min | Re-fires 15 min later | ☐ |
| Breathing session complete | Logs mindful session to HealthKit | ☐ |
| Complication tap | Opens app to habit list | ☐ |
| Digital Crown in habit stepper | Increments/decrements count | ☐ |
| Swipe to dismiss from detail | Returns to list with updated state | ☐ |
| Low power mode | Timer continues, haptics still fire | ☐ |

### Performance Tests

| Test | Expected |
|------|----------|
| App launch to habit list | < 1.5 seconds |
| Habit check-in response | < 0.2 seconds |
| Complication refresh after check-in | < 2 seconds |
| Background refresh cycle | < 500ms CPU burst |

### Accessibility Tests

- [ ] VoiceOver narrates all habits and completion states
- [ ] Reduce Motion: no animations (only opacity fades)
- [ ] Dynamic Type: all text scales correctly up to accessibility sizes
- [ ] All buttons have minimum 44pt tap target

---

## Appendix A — Tab Navigation Structure

```
HabyssWatchApp
└── TabView
    ├── Tab 1: DashboardView        (home icon)
    ├── Tab 2: HabitListView        (checklist icon)
    ├── Tab 3: FocusTimerView       (timer icon)
    ├── Tab 4: ProgressRingsView    (chart icon)
    └── Tab 5: BodyMetricsView      (heart icon)
```

All tabs navigate via standard `NavigationStack` to:
- `HabitDetailView` (from Tab 1 & 2)
- `StreakBoardView` (from Tab 1)
- `BreathingView` (from Tab 2 or 5)
- `SettingsView` (from toolbar on any tab)

---

## Appendix B — Siri Shortcuts

Register the following intents for Siri:

| Phrase | Action |
|--------|--------|
| "Log [habit name] in Habyss" | `LogHabitIntent` → marks habit done |
| "Start focus in Habyss" | `StartFocusIntent` → begins Pomodoro |
| "How are my habits in Habyss?" | `HabitStatusIntent` → reads completion ratio |

```swift
// LogHabitIntent.swift
import AppIntents

struct LogHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Habit"
    static var description = IntentDescription("Mark a habit as complete in Habyss")
    
    @Parameter(title: "Habit")
    var habitName: String
    
    func perform() async throws -> some IntentResult {
        let habits = HabitCacheService.shared.loadTodaysHabits()
        if let habit = habits.first(where: { $0.title.lowercased().contains(habitName.lowercased()) }) {
            HabitLogService.shared.logCompletion(habitId: habit.id, source: .siri)
            return .result(dialog: "Logged \(habit.title)! \(habit.streakCount + 1) days and counting 🔥")
        }
        return .result(dialog: "Couldn't find that habit. Open Habyss to check your list.")
    }
}
```

---

## Appendix C — Supabase Schema Notes

The watch app does **not** connect directly to Supabase. All cloud operations flow through the iOS app. However, the following schema columns are required for watch sync payloads:

From the `habits` table, these fields must be included in the watch sync payload:
- `id`, `title`, `emoji`, `category`, `frequency`, `target_count`, `unit`
- `streak_count`, `longest_streak`, `is_pinned`, `color`
- `scheduled_times` (array of time strings)
- `supports_countable` (boolean — whether habit can be logged multiple times/day)
- `watch_priority` (integer — sort order on Watch, add this column)

From `habit_logs` (synced from Watch → Supabase via iOS):
- `id`, `habit_id`, `completed_at`, `count`, `source`, `mood`, `note`
- `source` must accept value `'watch'`

**SQL to add watch-specific columns:**
```sql
ALTER TABLE habits ADD COLUMN IF NOT EXISTS watch_priority INTEGER DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS supports_countable BOOLEAN DEFAULT FALSE;

-- Add 'watch' and 'siri' to source enum if using one:
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'watch';
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'siri';
```

---

*End of Specification. Total estimated implementation time: 3 weeks for a solo iOS developer comfortable with SwiftUI and WatchKit.*
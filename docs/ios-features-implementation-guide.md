# Complete iOS Native Features Implementation Guide
## For Habyss - AI-Powered Habit Tracking App

This guide provides step-by-step instructions for implementing the most impactful iOS native features in your Expo development build.

---

## 📋 Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Live Activities (Dynamic Island)](#1-live-activities-dynamic-island)
3. [Interactive Widgets](#2-interactive-widgets)
4. [Apple Health (HealthKit)](#3-apple-health-healthkit)
5. [Siri & App Shortcuts](#4-siri--app-shortcuts)
6. [Focus Modes Integration](#5-focus-modes-integration)
7. [Apple Watch App](#6-apple-watch-app)
8. [StandBy Mode](#7-standby-mode)
9. [Screen Time API](#8-screen-time-api)
10. [Advanced Features](#9-advanced-features)

---

## Prerequisites & Setup

### Required Tools
- Xcode 15+ 
- iOS 17+ deployment target (iOS 18+ for newest features)
- Expo development build (already set up ✅)
- Apple Developer account

### Initial Project Configuration

**1. Update your app.json:**
```json
{
  "expo": {
    "ios": {
      "deploymentTarget": "17.0",
      "infoPlist": {
        "NSHealthShareUsageDescription": "We need access to your health data to track your training and recovery.",
        "NSHealthUpdateUsageDescription": "We'd like to save your habits to Apple Health.",
        "NSFocusStatusUsageDescription": "We use your Focus status to adapt habit reminders to your current context.",
        "UIBackgroundModes": ["remote-notification", "processing"]
      },
      "entitlements": {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.background-delivery": true
      }
    }
  }
}
```

**2. Enable capabilities in Xcode:**
- Open `ios/Habyss.xcworkspace`
- Select your app target → Signing & Capabilities
- Add these capabilities:
  - HealthKit
  - Push Notifications
  - Background Modes (enable Remote notifications)
  - App Groups (for widget/Live Activity data sharing)

---

## 1. Live Activities (Dynamic Island)

### What You'll Build
Real-time streak tracking in the Dynamic Island showing:
- Current daily progress (e.g., "3/5 habits complete")
- Countdown to next habit
- AI coach encouragement messages

### Step 1: Create Widget Extension (if not already created)

In Xcode:
1. File → New → Target
2. Choose "Widget Extension"
3. Name: `HabyssWidgets`
4. Include Live Activity: ✅ **YES**
5. Click Finish

This creates:
- `HabyssWidgets/` folder
- `HabyssWidgets.swift` (widget code)
- `HabyssWidgetsLiveActivity.swift` (Live Activity code)

### Step 2: Configure App Group (for data sharing)

**In Xcode:**
1. Select main app target → Signing & Capabilities
2. Add "App Groups" capability
3. Click "+" and create: `group.com.yourteam.habyss`
4. Repeat for Widget Extension target

**In your app.json:**
```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.yourteam.habyss"]
      }
    }
  }
}
```

### Step 3: Define Live Activity Attributes

Edit `HabyssWidgetsLiveActivity.swift`:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

// Define the data structure for your Live Activity
struct HabyssActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic content that updates
        var completedHabits: Int
        var totalHabits: Int
        var nextHabitName: String
        var nextHabitTime: Date
        var coachMessage: String
        var streakCount: Int
    }
    
    // Static content (doesn't change during activity)
    var userName: String
}

// Live Activity UI
struct HabyssWidgetsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HabyssActivityAttributes.self) { context in
            // Lock screen / banner UI
            LockScreenLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI (when user long-presses)
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.orange)
                        Text("\(context.state.streakCount)")
                            .font(.system(size: 24, weight: .bold))
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing) {
                        Text("\(context.state.completedHabits)/\(context.state.totalHabits)")
                            .font(.system(size: 24, weight: .bold))
                        Text("Today")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 4) {
                        Text("Next: \(context.state.nextHabitName)")
                            .font(.headline)
                        Text(context.state.nextHabitTime, style: .relative)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Image(systemName: "brain.head.profile")
                            .foregroundColor(.blue)
                        Text(context.state.coachMessage)
                            .font(.caption)
                            .lineLimit(2)
                    }
                    .padding(.horizontal)
                }
            } compactLeading: {
                // Compact view - left side
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.orange)
                    Text("\(context.state.streakCount)")
                        .font(.caption2.weight(.semibold))
                }
            } compactTrailing: {
                // Compact view - right side
                Text("\(context.state.completedHabits)/\(context.state.totalHabits)")
                    .font(.caption2.weight(.semibold))
            } minimal: {
                // Minimal view (when multiple activities)
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            }
        }
    }
}

// Lock Screen UI
struct LockScreenLiveActivityView: View {
    let context: ActivityViewContext<HabyssActivityAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
                Text("\(context.state.streakCount)-day streak")
                    .font(.headline)
                
                Spacer()
                
                Text("\(context.state.completedHabits)/\(context.state.totalHabits)")
                    .font(.title2.bold())
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Next: \(context.state.nextHabitName)")
                    .font(.subheadline)
                Text(context.state.nextHabitTime, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Text(context.state.coachMessage)
                .font(.caption)
                .foregroundColor(.blue)
                .lineLimit(2)
        }
        .padding()
    }
}
```

### Step 4: Start/Update Live Activity from React Native

**Create a native module bridge:**

Create `ios/Habyss/LiveActivityManager.swift`:

```swift
import Foundation
import ActivityKit
import React

@objc(LiveActivityManager)
class LiveActivityManager: NSObject {
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc func startLiveActivity(_ data: NSDictionary) {
        guard #available(iOS 16.2, *) else { return }
        
        let attributes = HabyssActivityAttributes(
            userName: data["userName"] as? String ?? "User"
        )
        
        let contentState = HabyssActivityAttributes.ContentState(
            completedHabits: data["completedHabits"] as? Int ?? 0,
            totalHabits: data["totalHabits"] as? Int ?? 5,
            nextHabitName: data["nextHabitName"] as? String ?? "",
            nextHabitTime: Date(timeIntervalSince1970: data["nextHabitTime"] as? Double ?? 0),
            coachMessage: data["coachMessage"] as? String ?? "",
            streakCount: data["streakCount"] as? Int ?? 0
        )
        
        do {
            let activity = try Activity<HabyssActivityAttributes>.request(
                attributes: attributes,
                contentState: contentState,
                pushType: nil
            )
            print("Live Activity started: \(activity.id)")
        } catch {
            print("Error starting Live Activity: \(error)")
        }
    }
    
    @objc func updateLiveActivity(_ data: NSDictionary) {
        guard #available(iOS 16.2, *) else { return }
        
        Task {
            let contentState = HabyssActivityAttributes.ContentState(
                completedHabits: data["completedHabits"] as? Int ?? 0,
                totalHabits: data["totalHabits"] as? Int ?? 5,
                nextHabitName: data["nextHabitName"] as? String ?? "",
                nextHabitTime: Date(timeIntervalSince1970: data["nextHabitTime"] as? Double ?? 0),
                coachMessage: data["coachMessage"] as? String ?? "",
                streakCount: data["streakCount"] as? Int ?? 0
            )
            
            for activity in Activity<HabyssActivityAttributes>.activities {
                await activity.update(using: contentState)
            }
        }
    }
    
    @objc func endLiveActivity() {
        guard #available(iOS 16.2, *) else { return }
        
        Task {
            for activity in Activity<HabyssActivityAttributes>.activities {
                await activity.end(dismissalPolicy: .immediate)
            }
        }
    }
}
```

**Create bridge header** `ios/Habyss/LiveActivityManager.m`:

```objective-c
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityManager, NSObject)

RCT_EXTERN_METHOD(startLiveActivity:(NSDictionary *)data)
RCT_EXTERN_METHOD(updateLiveActivity:(NSDictionary *)data)
RCT_EXTERN_METHOD(endLiveActivity)

@end
```

**Use in React Native:**

```typescript
import { NativeModules } from 'react-native';

const { LiveActivityManager } = NativeModules;

// Start Live Activity
const startDailyTracking = () => {
  LiveActivityManager.startLiveActivity({
    userName: "John",
    completedHabits: 3,
    totalHabits: 5,
    nextHabitName: "Evening Meditation",
    nextHabitTime: Date.now() + 3600000, // 1 hour from now
    coachMessage: "You're crushing it today! 💪",
    streakCount: 42
  });
};

// Update as habits complete
const updateProgress = (completed: number) => {
  LiveActivityManager.updateLiveActivity({
    completedHabits: completed,
    totalHabits: 5,
    nextHabitName: "Evening Meditation",
    nextHabitTime: Date.now() + 3600000,
    coachMessage: completed >= 4 ? "Almost there! Finish strong! 🔥" : "Keep going!",
    streakCount: 42
  });
};

// End at midnight or when day completes
const endDailyTracking = () => {
  LiveActivityManager.endLiveActivity();
};
```

### Step 5: Test Live Activity

1. Build & run on a real device (iPhone 14 Pro+ for Dynamic Island)
2. Call `startDailyTracking()` from your app
3. Lock the phone - see it on lock screen
4. On Dynamic Island devices, see the compact UI
5. Long-press to see expanded view

---

## 2. Interactive Widgets

### What You'll Build
Home screen widgets that let users:
- Check off habits without opening app
- See progress ring
- View streak count

### Step 1: Create Widget (if not using Widget Extension from Live Activity)

If you didn't create Widget Extension yet:
1. File → New → Target → Widget Extension
2. Name: `HabyssWidgets`
3. Include Live Activity: NO (or YES if you want both)

### Step 2: Define Widget Configuration

Edit `HabyssWidgets.swift`:

```swift
import WidgetKit
import SwiftUI
import AppIntents

// Widget data entry
struct HabitEntry: TimelineEntry {
    let date: Date
    let habits: [Habit]
    let completedCount: Int
    let totalCount: Int
    let streakCount: Int
}

// Data model
struct Habit: Identifiable, Codable {
    let id: String
    let name: String
    let icon: String
    var isCompleted: Bool
}

// Provider - fetches data
struct HabitProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitEntry {
        HabitEntry(
            date: Date(),
            habits: [
                Habit(id: "1", name: "Morning Workout", icon: "figure.run", isCompleted: true),
                Habit(id: "2", name: "Meditation", icon: "brain.head.profile", isCompleted: false),
                Habit(id: "3", name: "Read 30 min", icon: "book", isCompleted: false)
            ],
            completedCount: 1,
            totalCount: 3,
            streakCount: 42
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (HabitEntry) -> ()) {
        let entry = placeholder(in: context)
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitEntry>) -> ()) {
        // Fetch data from shared UserDefaults (App Group)
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        let habitsData = sharedDefaults?.data(forKey: "todaysHabits")
        
        var habits: [Habit] = []
        if let data = habitsData {
            habits = (try? JSONDecoder().decode([Habit].self, from: data)) ?? []
        }
        
        let completedCount = habits.filter { $0.isCompleted }.count
        
        let entry = HabitEntry(
            date: Date(),
            habits: habits,
            completedCount: completedCount,
            totalCount: habits.count,
            streakCount: sharedDefaults?.integer(forKey: "streakCount") ?? 0
        )
        
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
}

// Widget View
struct HabitWidgetView: View {
    let entry: HabitEntry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// Small Widget - Progress Ring + Streak
struct SmallWidgetView: View {
    let entry: HabitEntry
    
    var progress: Double {
        guard entry.totalCount > 0 else { return 0 }
        return Double(entry.completedCount) / Double(entry.totalCount)
    }
    
    var body: some View {
        ZStack {
            Color(.systemBackground)
            
            VStack(spacing: 12) {
                // Progress Ring
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.2), lineWidth: 8)
                    
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Color.blue, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    
                    VStack(spacing: 2) {
                        Text("\(entry.completedCount)")
                            .font(.system(size: 32, weight: .bold))
                        Text("of \(entry.totalCount)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .frame(width: 100, height: 100)
                
                // Streak
                HStack(spacing: 4) {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.orange)
                    Text("\(entry.streakCount) days")
                        .font(.caption.bold())
                }
            }
            .padding()
        }
    }
}

// Medium Widget - Interactive Habit List
struct MediumWidgetView: View {
    let entry: HabitEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
                Text("\(entry.streakCount)-day streak")
                    .font(.headline)
                
                Spacer()
                
                Text("\(entry.completedCount)/\(entry.totalCount)")
                    .font(.title3.bold())
            }
            
            Divider()
            
            // Interactive habit checkboxes (iOS 17+)
            ForEach(entry.habits.prefix(3)) { habit in
                HStack {
                    Button(intent: ToggleHabitIntent(habitId: habit.id)) {
                        Image(systemName: habit.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(habit.isCompleted ? .green : .gray)
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    
                    Image(systemName: habit.icon)
                        .foregroundColor(.secondary)
                    
                    Text(habit.name)
                        .font(.subheadline)
                        .strikethrough(habit.isCompleted)
                        .foregroundColor(habit.isCompleted ? .secondary : .primary)
                    
                    Spacer()
                }
            }
        }
        .padding()
    }
}

// Large Widget - Full habit list
struct LargeWidgetView: View {
    let entry: HabitEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Today's Habits")
                        .font(.headline)
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.orange)
                        Text("\(entry.streakCount) days")
                            .font(.caption)
                    }
                }
                
                Spacer()
                
                // Progress circle
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.2), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: Double(entry.completedCount) / Double(entry.totalCount))
                        .stroke(Color.blue, lineWidth: 6)
                        .rotationEffect(.degrees(-90))
                    Text("\(entry.completedCount)/\(entry.totalCount)")
                        .font(.caption.bold())
                }
                .frame(width: 50, height: 50)
            }
            
            Divider()
            
            // All habits
            ForEach(entry.habits) { habit in
                HStack {
                    Button(intent: ToggleHabitIntent(habitId: habit.id)) {
                        Image(systemName: habit.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(habit.isCompleted ? .green : .gray)
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    
                    Image(systemName: habit.icon)
                        .foregroundColor(.secondary)
                    
                    Text(habit.name)
                        .font(.subheadline)
                        .strikethrough(habit.isCompleted)
                        .foregroundColor(habit.isCompleted ? .secondary : .primary)
                    
                    Spacer()
                }
                .padding(.vertical, 2)
            }
        }
        .padding()
    }
}

// App Intent for interactive buttons (iOS 17+)
struct ToggleHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Habit"
    
    @Parameter(title: "Habit ID")
    var habitId: String
    
    func perform() async throws -> some IntentResult {
        // Update shared UserDefaults
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        guard let habitsData = sharedDefaults?.data(forKey: "todaysHabits"),
              var habits = try? JSONDecoder().decode([Habit].self, from: habitsData) else {
            return .result()
        }
        
        // Toggle the habit
        if let index = habits.firstIndex(where: { $0.id == habitId }) {
            habits[index].isCompleted.toggle()
            
            // Save back
            if let encoded = try? JSONEncoder().encode(habits) {
                sharedDefaults?.set(encoded, forKey: "todaysHabits")
            }
            
            // Reload all widgets
            WidgetCenter.shared.reloadAllTimelines()
        }
        
        return .result()
    }
}

// Widget Configuration
@main
struct HabyssWidgets: Widget {
    let kind: String = "HabyssWidgets"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitProvider()) { entry in
            HabitWidgetView(entry: entry)
        }
        .configurationDisplayName("Habit Tracker")
        .description("Track your daily habits.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
```

### Step 3: Share Data from React Native to Widget

**In your React Native app:**

```typescript
import { NativeModules } from 'react-native';

// Store data in shared UserDefaults (accessible by widget)
const saveHabitsForWidget = async (habits: Habit[], streakCount: number) => {
  const { SharedStorage } = NativeModules;
  
  await SharedStorage.setItem(
    'todaysHabits',
    JSON.stringify(habits)
  );
  
  await SharedStorage.setItem(
    'streakCount',
    streakCount.toString()
  );
  
  // Tell widgets to refresh
  await SharedStorage.reloadWidgets();
};
```

**Create native module** `ios/Habyss/SharedStorage.swift`:

```swift
import Foundation
import WidgetKit
import React

@objc(SharedStorage)
class SharedStorage: NSObject {
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc func setItem(_ key: String, value: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        
        if key == "streakCount", let count = Int(value) {
            sharedDefaults?.set(count, forKey: key)
        } else {
            sharedDefaults?.set(value, forKey: key)
        }
        
        resolver(true)
    }
    
    @objc func reloadWidgets(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        WidgetCenter.shared.reloadAllTimelines()
        resolver(true)
    }
}
```

**Bridge header** `ios/Habyss/SharedStorage.m`:

```objective-c
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SharedStorage, NSObject)

RCT_EXTERN_METHOD(setItem:(NSString *)key 
                  value:(NSString *)value 
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadWidgets:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

---

## 3. Apple Health (HealthKit)

### What You'll Build
- Auto-log workouts from Apple Watch
- Track sleep, meditation, water intake
- AI coach analyzes Health data for insights

### Step 1: Enable HealthKit Capability

Already done in Prerequisites ✅

### Step 2: Install React Native Health

```bash
cd ios
npm install react-native-health
cd ios
pod install
```

### Step 3: Request Authorization

```typescript
import AppleHealthKit from 'react-native-health';

const healthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.MindfulSession,
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.MindfulSession,
    ]
  }
};

export const initHealthKit = () => {
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(healthKitPermissions, (error: string) => {
      if (error) {
        console.log('[ERROR] Cannot grant permissions!');
        reject(error);
      } else {
        console.log('✅ HealthKit initialized');
        resolve(true);
      }
    });
  });
};
```

### Step 4: Auto-Track Workouts

```typescript
// Fetch today's workouts
export const getTodaysWorkouts = async (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      endDate: new Date().toISOString(),
    };
    
    AppleHealthKit.getSamples(
      options,
      (err: string, results: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results || []);
      }
    );
  });
};

// Auto-mark "Workout" habit as complete when workout logged
export const monitorWorkouts = async () => {
  const workouts = await getTodaysWorkouts();
  
  if (workouts.length > 0) {
    // Auto-complete "workout" habit
    await completeHabit('workout-habit-id');
    
    // Send AI coach message
    await sendCoachMessage(
      `Great job on your workout! 💪 You burned ${workouts[0].totalEnergyBurned} calories.`
    );
  }
};
```

### Step 5: Save Habits to Health

```typescript
// Save meditation habit as Mindful Session
export const saveMeditationToHealth = async (durationMinutes: number) => {
  const options = {
    startDate: new Date(Date.now() - durationMinutes * 60000).toISOString(),
    endDate: new Date().toISOString(),
  };
  
  AppleHealthKit.saveMindfulSession(options, (err: string, result: any) => {
    if (err) {
      console.error('Error saving mindful session:', err);
      return;
    }
    console.log('✅ Meditation saved to Health');
  });
};

// Save workout habit
export const saveWorkoutToHealth = async (
  type: string, 
  durationMinutes: number, 
  calories: number
) => {
  const options = {
    type: 'MartialArts', // or 'Running', 'Cycling', etc.
    startDate: new Date(Date.now() - durationMinutes * 60000).toISOString(),
    endDate: new Date().toISOString(),
    energyBurned: calories,
    energyBurnedUnit: 'kilocalorie',
  };
  
  AppleHealthKit.saveWorkout(options, (err: string, result: any) => {
    if (err) {
      console.error('Error saving workout:', err);
      return;
    }
    console.log('✅ Workout saved to Health');
  });
};
```

### Step 6: AI Coach Health Insights

```typescript
// Get sleep data for AI analysis
export const getSleepAnalysis = async () => {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
      endDate: new Date().toISOString(),
    };
    
    AppleHealthKit.getSleepSamples(options, (err: string, results: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
};

// AI Coach analyzes health data
export const getAIHealthInsights = async () => {
  const [workouts, sleep, steps] = await Promise.all([
    getTodaysWorkouts(),
    getSleepAnalysis(),
    getSteps()
  ]);
  
  // Send to your AI (OpenAI, Claude, etc.)
  const insights = await yourAI.analyze({
    prompt: `Analyze this user's health data and provide personalized habit coaching:
    
    Workouts this week: ${workouts.length}
    Average sleep: ${calculateAvgSleep(sleep)} hours
    Steps today: ${steps}
    
    What habits should they focus on?`,
    context: { workouts, sleep, steps }
  });
  
  return insights;
};
```

---

## 4. Siri & App Shortcuts

### What You'll Build
Voice commands like:
- "Hey Siri, log my morning routine"
- "Hey Siri, did I complete my habits?"
- "Hey Siri, ask my coach for motivation"

### Step 1: Create App Intents

Create `ios/Habyss/AppIntents.swift`:

```swift
import AppIntents
import Foundation

// Intent: Log habit completion
struct LogHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Habit"
    static var description = IntentDescription("Mark a habit as complete")
    
    @Parameter(title: "Habit Name")
    var habitName: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Log \(\.$habitName)")
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Save to shared storage
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        var completedHabits = sharedDefaults?.stringArray(forKey: "completedHabits") ?? []
        
        if !completedHabits.contains(habitName) {
            completedHabits.append(habitName)
            sharedDefaults?.set(completedHabits, forKey: "completedHabits")
            
            // Reload widgets
            WidgetCenter.shared.reloadAllTimelines()
            
            return .result(dialog: IntentDialog("✅ \(habitName) marked complete!"))
        } else {
            return .result(dialog: IntentDialog("\(habitName) was already completed today."))
        }
    }
}

// Intent: Check daily progress
struct CheckProgressIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Progress"
    static var description = IntentDescription("See how many habits completed today")
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        let completed = sharedDefaults?.stringArray(forKey: "completedHabits")?.count ?? 0
        let total = sharedDefaults?.integer(forKey: "totalHabits") ?? 0
        let streak = sharedDefaults?.integer(forKey: "streakCount") ?? 0
        
        let message = """
        You've completed \(completed) of \(total) habits today.
        Your streak: \(streak) days! 🔥
        """
        
        return .result(dialog: IntentDialog(message))
    }
}

// Intent: Get AI coach motivation
struct GetMotivationIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Motivation"
    static var description = IntentDescription("Hear from your AI coach")
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        let coachMessage = sharedDefaults?.string(forKey: "latestCoachMessage") ?? "You've got this! Keep pushing forward! 💪"
        
        return .result(dialog: IntentDialog(coachMessage))
    }
}

// App Shortcuts (Siri phrase suggestions)
struct HabyssAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogHabitIntent(),
            phrases: [
                "Log \(.applicationName) habit",
                "Mark habit complete in \(.applicationName)",
                "I finished my habit in \(.applicationName)"
            ],
            shortTitle: "Log Habit",
            systemImageName: "checkmark.circle"
        )
        
        AppShortcut(
            intent: CheckProgressIntent(),
            phrases: [
                "Check my progress in \(.applicationName)",
                "How am I doing in \(.applicationName)",
                "Show my \(.applicationName) habits"
            ],
            shortTitle: "Check Progress",
            systemImageName: "chart.bar"
        )
        
        AppShortcut(
            intent: GetMotivationIntent(),
            phrases: [
                "Motivate me in \(.applicationName)",
                "Coach message from \(.applicationName)",
                "Get motivation from \(.applicationName)"
            ],
            shortTitle: "Get Motivation",
            systemImageName: "brain.head.profile"
        )
    }
}
```

### Step 2: Register Intents in Main App

In your `AppDelegate.swift` or `App.swift`:

```swift
import AppIntents

@main
struct HabyssApp: App {
    init() {
        // Register app shortcuts
        AppShortcutsProvider.updateAppShortcutParameters()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### Step 3: Update Coach Messages from React Native

```typescript
// Store latest AI coach message for Siri
export const updateCoachMessage = async (message: string) => {
  const { SharedStorage } = NativeModules;
  await SharedStorage.setItem('latestCoachMessage', message);
};

// Example: After AI generates response
const sendAICoachMessage = async (userQuery: string) => {
  const response = await yourAI.chat(userQuery);
  
  // Save for Siri
  await updateCoachMessage(response);
  
  // Show in app
  showMessage(response);
};
```

### Step 4: Test Siri Shortcuts

1. Build & install app
2. Open Shortcuts app on iPhone
3. Your shortcuts should appear automatically
4. Test: "Hey Siri, check my progress in Habyss"
5. Or add to Shortcuts app for custom automation

---

## 5. Focus Modes Integration

### What You'll Build
Context-aware habit reminders:
- Work Focus → "Deep work" habits
- Personal Focus → Evening routine
- Sleep Focus → Bedtime checklist

### Step 1: Request Focus Status Permission

Already added to Info.plist in Prerequisites ✅

### Step 2: Create Focus Filter Extension

1. File → New → Target
2. Choose "Focus Filter Extension"
3. Name: `HabyssFocusFilter`

Edit `HabyssFocusFilter.swift`:

```swift
import AppIntents

@available(iOS 16.0, *)
struct HabyssFocusFilter: SetFocusFilterIntent {
    static let title: LocalizedStringResource = "Habyss Habits"
    static let description: LocalizedStringResource = "Show different habits based on your Focus"
    
    @Parameter(title: "Focus Mode")
    var focusMode: FocusMode
    
    func perform() async throws -> some IntentResult {
        // Store current focus in shared storage
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        sharedDefaults?.set(focusMode.rawValue, forKey: "currentFocus")
        
        // Reload widgets to show focus-specific habits
        WidgetCenter.shared.reloadAllTimelines()
        
        return .result()
    }
}

enum FocusMode: String, AppEnum {
    case work = "Work"
    case personal = "Personal"
    case sleep = "Sleep"
    case workout = "Workout"
    case mindfulness = "Mindfulness"
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Focus Mode")
    static var caseDisplayRepresentations: [FocusMode: DisplayRepresentation] = [
        .work: "Work Focus",
        .personal: "Personal Time",
        .sleep: "Sleep Focus",
        .workout: "Workout Focus",
        .mindfulness: "Mindfulness Focus"
    ]
}
```

### Step 3: Adapt Widget Content by Focus

Update your widget provider:

```swift
func getTimeline(in context: Context, completion: @escaping (Timeline<HabitEntry>) -> ()) {
    let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
    let currentFocus = sharedDefaults?.string(forKey: "currentFocus") ?? "personal"
    let habitsData = sharedDefaults?.data(forKey: "todaysHabits")
    
    var allHabits: [Habit] = []
    if let data = habitsData {
        allHabits = (try? JSONDecoder().decode([Habit].self, from: data)) ?? []
    }
    
    // Filter habits by focus mode
    let filteredHabits: [Habit]
    switch currentFocus {
    case "Work":
        filteredHabits = allHabits.filter { $0.category == "productivity" }
    case "Sleep":
        filteredHabits = allHabits.filter { $0.category == "evening" }
    case "Workout":
        filteredHabits = allHabits.filter { $0.category == "fitness" }
    default:
        filteredHabits = allHabits
    }
    
    let entry = HabitEntry(
        date: Date(),
        habits: filteredHabits,
        completedCount: filteredHabits.filter { $0.isCompleted }.count,
        totalCount: filteredHabits.count,
        streakCount: sharedDefaults?.integer(forKey: "streakCount") ?? 0
    )
    
    let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900)))
    completion(timeline)
}
```

### Step 4: Detect Focus Changes in React Native

Create native module to monitor focus:

```swift
import Foundation
import FamilyControls
import React

@objc(FocusManager)
class FocusManager: RCTEventEmitter {
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onFocusChanged"]
    }
    
    @objc func startMonitoring() {
        // Monitor focus changes (simplified - actual implementation needs authorization)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(focusChanged),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
    
    @objc private func focusChanged() {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        let currentFocus = sharedDefaults?.string(forKey: "currentFocus") ?? "personal"
        
        sendEvent(withName: "onFocusChanged", body: ["focus": currentFocus])
    }
}
```

Use in React Native:

```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';

const { FocusManager } = NativeModules;
const focusEmitter = new NativeEventEmitter(FocusManager);

useEffect(() => {
  FocusManager.startMonitoring();
  
  const subscription = focusEmitter.addListener('onFocusChanged', (event) => {
    console.log('Focus changed to:', event.focus);
    
    // Update UI to show relevant habits
    if (event.focus === 'Work') {
      showProductivityHabits();
    } else if (event.focus === 'Sleep') {
      showEveningRoutine();
    }
  });
  
  return () => subscription.remove();
}, []);
```

---

## 6. Apple Watch App

### What You'll Build
Standalone Watch app for:
- Quick habit check-offs from wrist
- Complications showing streak
- Haptic reminders

### Step 1: Add Watch App Target

1. File → New → Target
2. Choose "Watch App"
3. Name: `Habyss Watch App`
4. Choose SwiftUI interface
5. Click Finish

This creates:
- `Habyss Watch App/` folder
- Watch app target
- Watch extension target

### Step 2: Create Watch App Views

Edit `Habyss Watch App/ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    @State private var habits: [Habit] = []
    @State private var streakCount: Int = 0
    
    var body: some View {
        NavigationStack {
            List {
                // Streak header
                HStack {
                    Image(systemName: "flame.fill")
                        .foregroundColor(.orange)
                    Text("\(streakCount)-day streak")
                        .font(.headline)
                }
                .listRowBackground(Color.clear)
                
                // Habits
                ForEach($habits) { $habit in
                    HabitRowView(habit: $habit, onToggle: {
                        toggleHabit(habit)
                    })
                }
            }
            .navigationTitle("Habits")
            .onAppear(perform: loadHabits)
        }
    }
    
    func loadHabits() {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        if let data = sharedDefaults?.data(forKey: "todaysHabits"),
           let decoded = try? JSONDecoder().decode([Habit].self, from: data) {
            habits = decoded
        }
        streakCount = sharedDefaults?.integer(forKey: "streakCount") ?? 0
    }
    
    func toggleHabit(_ habit: Habit) {
        if let index = habits.firstIndex(where: { $0.id == habit.id }) {
            habits[index].isCompleted.toggle()
            
            // Save back
            let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
            if let encoded = try? JSONEncoder().encode(habits) {
                sharedDefaults?.set(encoded, forKey: "todaysHabits")
            }
            
            // Haptic feedback
            WKInterfaceDevice.current().play(.success)
            
            // Reload widgets
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}

struct HabitRowView: View {
    @Binding var habit: Habit
    let onToggle: () -> Void
    
    var body: some View {
        HStack {
            Button(action: onToggle) {
                Image(systemName: habit.isCompleted ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(habit.isCompleted ? .green : .gray)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(habit.name)
                    .font(.subheadline)
                    .strikethrough(habit.isCompleted)
                
                if let time = habit.scheduledTime {
                    Text(time, style: .time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}
```

### Step 3: Add Watch Complications

Create `ComplicationController.swift`:

```swift
import ClockKit

class ComplicationController: NSObject, CLKComplicationDataSource {
    
    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptors = [
            CLKComplicationDescriptor(
                identifier: "streak",
                displayName: "Habit Streak",
                supportedFamilies: [.modularSmall, .graphicCircular, .graphicCorner]
            )
        ]
        handler(descriptors)
    }
    
    func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) {
        let sharedDefaults = UserDefaults(suiteName: "group.com.yourteam.habyss")
        let streak = sharedDefaults?.integer(forKey: "streakCount") ?? 0
        
        let template: CLKComplicationTemplate
        
        switch complication.family {
        case .modularSmall:
            let smallTemplate = CLKComplicationTemplateModularSmallStackImage()
            smallTemplate.line1ImageProvider = CLKImageProvider(onePieceImage: UIImage(systemName: "flame.fill")!)
            smallTemplate.line2TextProvider = CLKTextProvider(format: "\(streak)")
            template = smallTemplate
            
        case .graphicCircular:
            let circularTemplate = CLKComplicationTemplateGraphicCircularStackImage()
            circularTemplate.line1ImageProvider = CLKFullColorImageProvider(fullColorImage: UIImage(systemName: "flame.fill")!)
            circularTemplate.line2TextProvider = CLKTextProvider(format: "\(streak)")
            template = circularTemplate
            
        default:
            handler(nil)
            return
        }
        
        let entry = CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template)
        handler(entry)
    }
}
```

### Step 4: Sync Data from iPhone to Watch

Use Watch Connectivity:

```swift
import WatchConnectivity

class WatchConnectivityManager: NSObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()
    
    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }
    
    // Send data from iPhone to Watch
    func sendHabitsToWatch(_ habits: [Habit]) {
        guard WCSession.default.isReachable else { return }
        
        if let encoded = try? JSONEncoder().encode(habits) {
            let message = ["habits": encoded]
            WCSession.default.sendMessage(message, replyHandler: nil)
        }
    }
    
    // Receive on Watch
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let habitsData = message["habits"] as? Data,
           let habits = try? JSONDecoder().decode([Habit].self, from: habitsData) {
            // Update Watch UI
            DispatchQueue.main.async {
                // Reload habits
            }
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        print("Watch session activated")
    }
}
```

---

## 7. StandBy Mode

### What You'll Build
Full-screen habit dashboard when iPhone is charging in landscape

### Step 1: Create StandBy Widget

StandBy uses regular widgets, but you can optimize for it:

```swift
struct StandByHabitWidget: View {
    let entry: HabitEntry
    
    var body: some View {
        // Large, high-contrast design for StandBy
        ZStack {
            Color.black
            
            VStack(spacing: 20) {
                // Big streak counter
                VStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.orange)
                    
                    Text("\(entry.streakCount)")
                        .font(.system(size: 100, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("DAY STREAK")
                        .font(.title3)
                        .foregroundColor(.gray)
                }
                
                // Progress bar
                VStack(spacing: 8) {
                    HStack {
                        ForEach(0..<entry.totalCount, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 4)
                                .fill(index < entry.completedCount ? Color.green : Color.gray.opacity(0.3))
                                .frame(height: 12)
                        }
                    }
                    
                    Text("\(entry.completedCount) of \(entry.totalCount) complete")
                        .font(.title2)
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 40)
                
                // Next habit
                if let nextHabit = entry.habits.first(where: { !$0.isCompleted }) {
                    VStack(spacing: 4) {
                        Text("NEXT")
                            .font(.caption)
                            .foregroundColor(.gray)
                        Text(nextHabit.name)
                            .font(.title)
                            .foregroundColor(.white)
                    }
                }
            }
        }
    }
}
```

### Step 2: Add to Widget

```swift
@main
struct HabyssWidgets: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Habyss", provider: HabitProvider()) { entry in
            HabitWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Color.clear
                }
        }
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular])
        .contentMarginsDisabled() // Allows full-bleed for StandBy
    }
}
```

StandBy will automatically use your large widget when in landscape + charging!

---

## 8. Screen Time API

### What You'll Build
- Block distracting apps until habits complete
- "Unlock 30 min Instagram after completing morning routine"

### Step 1: Request Screen Time Authorization

Add to Info.plist:
```xml
<key>NSFamilyControlsUsageDescription</key>
<string>We use Screen Time to help you stay accountable to your habits.</string>
```

### Step 2: Implement Screen Time Controls

Create `ios/Habyss/ScreenTimeManager.swift`:

```swift
import FamilyControls
import ManagedSettings
import DeviceActivity
import React

@objc(ScreenTimeManager)
class ScreenTimeManager: NSObject {
    
    let center = AuthorizationCenter.shared
    let store = ManagedSettingsStore()
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc func requestAuthorization(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await center.requestAuthorization(for: .individual)
                resolver(true)
            } catch {
                rejecter("AUTH_ERROR", "Screen Time authorization failed", error)
            }
        }
    }
    
    @objc func blockDistractionApps(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        // Block social media until habits complete
        let socialMediaTokens = getSocialMediaAppTokens() // Implement app selection
        
        store.shield.applications = socialMediaTokens
        store.shield.applicationCategories = .specific([.socialNetworking], during: .daily)
        
        resolver(true)
    }
    
    @objc func unblockApps(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        store.clearAllSettings()
        resolver(true)
    }
    
    private func getSocialMediaAppTokens() -> Set<ApplicationToken> {
        // User selects apps in FamilyActivityPicker
        // Return their selected tokens
        // (Simplified - actual implementation needs FamilyActivityPicker)
        return []
    }
}
```

### Step 3: Use in React Native

```typescript
import { NativeModules } from 'react-native';

const { ScreenTimeManager } = NativeModules;

// Request permission
export const setupScreenTimeControl = async () => {
  try {
    await ScreenTimeManager.requestAuthorization();
    console.log('✅ Screen Time authorized');
  } catch (error) {
    console.error('Screen Time error:', error);
  }
};

// Block apps until habits complete
export const enforceHabitAccountability = async (completedHabits: number, totalHabits: number) => {
  if (completedHabits < totalHabits) {
    // Not all habits done - block distracting apps
    await ScreenTimeManager.blockDistractionApps();
    
    showNotification({
      title: "Habits First! 🚫",
      body: `Complete ${totalHabits - completedHabits} more habits to unlock your apps.`
    });
  } else {
    // All habits done - unblock
    await ScreenTimeManager.unblockApps();
    
    showNotification({
      title: "You earned it! 🎉",
      body: "All habits complete! Apps unlocked."
    });
  }
};
```

---

## 9. Advanced Features

### Journal Suggestions API

```swift
import JournalingSuggestions

struct HabitJournalSuggestion {
    static func createReflectionPrompt(habits: [Habit]) -> JournalingSuggestion {
        let completedCount = habits.filter { $0.isCompleted }.count
        
        return JournalingSuggestion(
            title: "Reflect on Today's Habits",
            content: "You completed \(completedCount) of \(habits.count) habits today. What helped you succeed? What got in the way?"
        )
    }
}
```

### Visual Intelligence (iOS 18.2+)

```swift
// Point camera at gym → auto-log workout
import VisionKit

func detectLocation() -> String? {
    // Use Vision framework to detect environment
    // "Gym detected" → auto-complete workout habit
    return "gym"
}
```

---

## 🚀 Implementation Priority

**Week 1 (Highest Impact):**
1. ✅ Live Activities (Dynamic Island)
2. ✅ Interactive Widgets  
3. ✅ Apple Health

**Week 2:**
4. ✅ Siri & App Shortcuts
5. ✅ Focus Modes Integration

**Week 3:**
6. ✅ Apple Watch App
7. ✅ StandBy Mode

**Week 4 (Optional):**
8. ✅ Screen Time API
9. ✅ Advanced features

---

## 🧪 Testing Checklist

- [ ] Live Activity appears in Dynamic Island
- [ ] Widget updates when habits completed
- [ ] Tapping widget checkbox works (iOS 17+)
- [ ] HealthKit syncs workouts
- [ ] Siri shortcuts respond correctly
- [ ] Focus Filter changes widget content
- [ ] Watch app syncs with iPhone
- [ ] StandBy shows dashboard in landscape + charging
- [ ] Screen Time blocks apps until habits complete

---

## 📚 Resources

- [Apple Human Interface Guidelines - Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities)
- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [App Intents Documentation](https://developer.apple.com/documentation/appintents)
- [react-native-health GitHub](https://github.com/agencyenterprise/react-native-health)

---

## 🆘 Troubleshooting

**Widget not updating:**
- Call `WidgetCenter.shared.reloadAllTimelines()` after data changes
- Check App Group is configured correctly
- Verify data is in shared UserDefaults

**Live Activity not appearing:**
- Must test on real device (not simulator for Dynamic Island)
- Check ActivityKit is available (iOS 16.2+)
- Verify push notification entitlement

**HealthKit permission denied:**
- Check Info.plist has usage descriptions
- HealthKit only works on iPhone (not iPad)

**Siri not recognizing commands:**
- Rebuild app after adding App Intents
- Check phrases are unique
- App must be installed, not via TestFlight for initial setup

---

**Need help implementing any specific feature? Let me know and I can provide more detailed code!** 🚀
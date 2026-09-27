import AppIntents
import Foundation

@available(iOS 16.0, *)
struct StartFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Focus Session"
    static var description = IntentDescription("Starts a focus session in Habyss")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Duration (Minutes)", default: 25)
    var duration: Int

    @MainActor
    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.habyss.data")
        defaults?.set(duration, forKey: "intent_start_focus_duration")
        defaults?.set(Date().timeIntervalSince1970, forKey: "intent_start_focus_timestamp")
        
        return .result(dialog: "Starting focus session for \(duration) minutes")
    }
}

@available(iOS 16.0, *)
struct LogHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Habit"
    static var description = IntentDescription("Mark a habit as completed")
    
    @Parameter(title: "Habit Name")
    var habitName: String

    @MainActor
    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.habyss.data")
        var pending = defaults?.array(forKey: "pending_habit_logs") as? [String] ?? []
        pending.append(habitName)
        defaults?.set(pending, forKey: "pending_habit_logs")
        
        return .result(dialog: "Logged \(habitName)")
    }
}

@available(iOS 16.0, *)
struct CheckProgressIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Today's Progress"
    static var description = IntentDescription("See how many habits you've completed today")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.habyss.data")
        
        // Read habits data from shared defaults
        if let habitsString = defaults?.string(forKey: "siriHabitsData") ?? defaults?.string(forKey: "habitsData"),
           let habitsData = habitsString.data(using: .utf8) {
            struct SimpleHabit: Codable {
                let id: String
                let name: String
                let isCompleted: Bool
            }
            
            if let habits = try? JSONDecoder().decode([SimpleHabit].self, from: habitsData) {
                let total = habits.count
                let completed = habits.filter { $0.isCompleted }.count
                let remaining = total - completed
                
                if completed >= total && total > 0 {
                    return .result(dialog: "Amazing! You've completed all \(total) habits today! 🎉")
                } else if completed > 0 {
                    return .result(dialog: "You've done \(completed) of \(total) habits. \(remaining) to go! 💪")
                } else {
                    return .result(dialog: "You have \(total) habits to complete today. Let's get started! 🚀")
                }
            }
        }
        
        return .result(dialog: "Open Habyss to see your progress")
    }
}

@available(iOS 16.0, *)
struct StopFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Stop Focus Session"
    static var description = IntentDescription("Stops the current focus session")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults(suiteName: "group.com.habyss.data")
        defaults?.set(true, forKey: "intent_stop_focus")
        defaults?.set(Date().timeIntervalSince1970, forKey: "intent_stop_focus_timestamp")
        
        return .result(dialog: "Stopping your focus session")
    }
}

@available(iOS 16.0, *)
struct HabyssShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartFocusIntent(),
            phrases: [
                "Start focus in \(.applicationName)",
                "Focus with \(.applicationName)",
                "Start a focus session in \(.applicationName)",
                "Begin focus in \(.applicationName)"
            ],
            shortTitle: "Start Focus",
            systemImageName: "timer"
        )
        AppShortcut(
            intent: LogHabitIntent(),
            phrases: [
                "Log habit in \(.applicationName)",
                "Complete habit in \(.applicationName)",
                "Mark habit done in \(.applicationName)"
            ],
            shortTitle: "Log Habit",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: CheckProgressIntent(),
            phrases: [
                "Check progress in \(.applicationName)",
                "How am I doing in \(.applicationName)",
                "Show my habits in \(.applicationName)",
                "What's my progress in \(.applicationName)"
            ],
            shortTitle: "Check Progress",
            systemImageName: "chart.bar"
        )
        AppShortcut(
            intent: StopFocusIntent(),
            phrases: [
                "Stop focus in \(.applicationName)",
                "End focus in \(.applicationName)",
                "Stop timer in \(.applicationName)"
            ],
            shortTitle: "Stop Focus",
            systemImageName: "stop.circle"
        )
    }
}

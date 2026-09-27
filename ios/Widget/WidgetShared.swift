// Compiled into BOTH the app and widget extension. LiveActivityIntent runs in
// the app process, including when Habyss has not been opened in the foreground.
import Foundation
import WidgetKit
import AppIntents
import UserNotifications
import ActivityKit

func widgetDayKey(_ date: Date = Date()) -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
}

struct WidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties
        var title: String
        var subtitle: String
        var timerEndDateInMilliseconds: Double?
        var progress: Double
        var profileImagePath: String?
        var scheduledStartDateInMilliseconds: Double?
        var scheduledEndDateInMilliseconds: Double?
        var url: String?
        var accentHex: String?
    }

    // Fixed non-changing properties
    var name: String
    var totalDurationSeconds: Double?
}

struct DashboardTask: Codable, Identifiable {
    let id: String
    let name: String
    var isCompleted: Bool
    let time: String?
    let dueDate: String?
}
struct DashboardDay: Codable {
    let date: String
    var total: Int
    var completed: Int
    var items: [DashboardTask]
}
struct HeatmapDay: Codable {
    let date: String
    let completed: Int
    let total: Int
}
struct DashboardGoal: Codable, Identifiable {
    let id: String
    let name: String
    var progress: Double
    let color: String
    let taskWeights: [String: Double]
}
struct WidgetAction: Codable {
    let eventId: String
    let id: String
    let day: String
    let done: Bool
    let timestamp: Double
}
struct DashboardSnapshot: Codable {
    struct Accent: Codable { let from: String; let to: String }
    let version: Int
    let generatedAt: String
    let dayKey: String
    let accent: Accent
    var days: [DashboardDay]
    let heatmap: [HeatmapDay]
    var goals: [DashboardGoal]

    static func read(defaults: UserDefaults? = UserDefaults(suiteName: "group.com.habyss.data")) -> DashboardSnapshot? {
        guard let defaults,
              let data = defaults.string(forKey: "widgetDashboard")?.data(using: .utf8),
              var snapshot = try? JSONDecoder().decode(Self.self, from: data), snapshot.version == 1 else { return nil }
        // Events are separate durable records, so app refreshes cannot erase taps.
        let actions = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("widget_event_") }.compactMap { entry -> WidgetAction? in
            guard let raw = entry.value as? String, let data = raw.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(WidgetAction.self, from: data)
        }.sorted { $0.timestamp == $1.timestamp ? $0.eventId < $1.eventId : $0.timestamp < $1.timestamp }
        // Final intent wins. Keeping the original rows until this reduction
        // allows a queued undo to restore an overdue/undated task correctly.
        var latest: [String: WidgetAction] = [:]
        for action in actions { latest[action.id] = action }
        for action in latest.values {
            var delta: Double = 0
            var found = false
            for day in snapshot.days.indices {
                guard let index = snapshot.days[day].items.firstIndex(where: { $0.id == action.id }) else { continue }
                let old = snapshot.days[day].items[index].isCompleted
                if !found { delta = Double((action.done ? 1 : 0) - (old ? 1 : 0)); found = true }
                if action.done && snapshot.days[day].items[index].dueDate != snapshot.days[day].date {
                    snapshot.days[day].items.remove(at: index)
                    snapshot.days[day].total = max(0, snapshot.days[day].total - 1)
                    if old { snapshot.days[day].completed = max(0, snapshot.days[day].completed - 1) }
                    continue
                }
                if old != action.done {
                    snapshot.days[day].items[index].isCompleted = action.done
                    snapshot.days[day].completed += action.done ? 1 : -1
                }
            }
            for goal in snapshot.goals.indices {
                if let weight = snapshot.goals[goal].taskWeights[action.id] {
                    snapshot.goals[goal].progress = min(100, max(0, snapshot.goals[goal].progress + delta * weight))
                }
            }
        }
        for day in snapshot.days.indices {
            snapshot.days[day].items = snapshot.days[day].items.enumerated().sorted {
                if $0.element.isCompleted != $1.element.isCompleted { return !$0.element.isCompleted }
                return $0.offset < $1.offset
            }.map { $0.element }
        }
        return snapshot
    }
}

// MARK: - App Intent for Interaction
struct ToggleHabitIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Complete Task"
    // Ticking something off is the whole point of the widget; sending the user
    // into the app to do it would defeat it. The app catches up when opened.
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Habit ID")
    var id: String

    init() {}

    init(id: String) {
        self.id = id
    }

    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: "group.com.habyss.data") else { return .result() }
        let today = widgetDayKey()
        guard let snapshot = DashboardSnapshot.read(),
              let day = snapshot.days.first(where: { $0.date == today }),
              let item = day.items.first(where: { $0.id == id }) else { return .result() }
        let action = WidgetAction(eventId: UUID().uuidString, id: id, day: today,
                                  done: !item.isCompleted, timestamp: Date().timeIntervalSince1970 * 1000)
        let encoded = try JSONEncoder().encode(action)
        guard let raw = String(data: encoded, encoding: .utf8) else { return .result() }
        defaults.set(raw, forKey: "widget_event_" + action.eventId)
        if action.done {
            let notifications = await UNUserNotificationCenter.current().pendingNotificationRequests()
            let rawId = String(id.dropFirst(id.hasPrefix("task:") ? 5 : 6))
            let cancelled = notifications.filter { request in
                let data = (request.content.userInfo["body"] as? [AnyHashable: Any]) ?? request.content.userInfo
                if id.hasPrefix("task:") { return data["taskId"] as? String == rawId }
                return data["habitId"] as? String == rawId && data["scheduledDate"] as? String == today
            }.map { $0.identifier }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: cancelled)
            for activity in Activity<WidgetAttributes>.activities where activity.attributes.name.hasPrefix("scheduled:" + id + ":" + today) {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// Compiled into BOTH the app and widget extension. The task tap is a plain
// AppIntent, so it runs in the widget extension without waking the app.
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
    var points: [GoalGraphPoint]? = nil
}
struct GoalGraphPoint: Codable {
    let date: String
    var actual: Double
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
    var streak: Int? = nil

    static func read() -> DashboardSnapshot? {
        let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.habyss.data")
        let raw = container.flatMap { try? String(contentsOf: $0.appendingPathComponent("widgetDashboard.json"), encoding: .utf8) }
        let files = container.flatMap { try? FileManager.default.contentsOfDirectory(at: $0.appendingPathComponent("widget-events"), includingPropertiesForKeys: nil) } ?? []
        let events = files.filter { $0.pathExtension == "json" }.compactMap { try? String(contentsOf: $0, encoding: .utf8) }
        return read(defaults: UserDefaults(suiteName: "group.com.habyss.data"), raw: raw, events: events)
    }

    static func read(defaults: UserDefaults?, raw: String? = nil, events: [String] = []) -> DashboardSnapshot? {
        guard let defaults,
              let data = (raw ?? defaults.string(forKey: "widgetDashboard"))?.data(using: .utf8),
              var snapshot = try? JSONDecoder().decode(Self.self, from: data), snapshot.version == 1 else { return nil }
        // Events are separate durable records, so app refreshes cannot erase taps.
        let legacy = defaults.dictionaryRepresentation().filter { $0.key.hasPrefix("widget_event_") }.compactMap { $0.value as? String }
        let actions = (legacy + events).compactMap { raw -> WidgetAction? in
            guard let data = raw.data(using: .utf8) else { return nil }
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
                // Ticked on the day it was tapped, it stays put and is struck
                // through; it only leaves the other days it was carried into.
                if action.done && snapshot.days[day].date != action.day && snapshot.days[day].items[index].dueDate != snapshot.days[day].date {
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
                    if var points = snapshot.goals[goal].points, !points.isEmpty {
                        if points[points.count - 1].date < action.day {
                            points.append(GoalGraphPoint(date: action.day, actual: snapshot.goals[goal].progress))
                        } else {
                            points[points.count - 1].actual = snapshot.goals[goal].progress
                        }
                        snapshot.goals[goal].points = Array(points.suffix(90))
                    }
                }
            }
        }
        // No re-sorting: a row you just ticked stays where your finger was.
        return snapshot
    }
}

// MARK: - App Intent for Interaction
struct ToggleHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task"
    // Ticking something off is the whole point of the widget; sending the user
    // into the app to do it would defeat it. The app catches up when opened.
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task ID")
    var id: String

    init() {}

    init(id: String) {
        self.id = id
    }

    /**
     * Records the tap and nothing else, inside the widget.
     *
     * This used to be a LiveActivityIntent, which iOS runs in the *app's*
     * process — so every tap woke Habyss in the background, often from cold,
     * before the widget could redraw. It also asked for pending notifications
     * (a widget cannot see the app's) and reloaded every widget on the Home
     * Screen. Now it writes one small file and reloads the two widgets the tap
     * changes; the app applies it, and tidies reminders, when it next runs.
     *
     * Tapping a struck-through row takes the tick back.
     */
    func perform() async throws -> some IntentResult {
        let today = widgetDayKey()
        guard let snapshot = DashboardSnapshot.read(),
              let day = snapshot.days.first(where: { $0.date == today }),
              let item = day.items.first(where: { $0.id == id }) else { return .result() }
        let action = WidgetAction(eventId: UUID().uuidString, id: id, day: today,
                                  done: !item.isCompleted, timestamp: Date().timeIntervalSince1970 * 1000)
        let encoded = try JSONEncoder().encode(action)
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.habyss.data") else { return .result() }
        let inbox = container.appendingPathComponent("widget-events", isDirectory: true)
        try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
        try encoded.write(to: inbox.appendingPathComponent(action.eventId + ".json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        WidgetCenter.shared.reloadTimelines(ofKind: "HabyssWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "HabyssGoals")
        return .result()
    }
}

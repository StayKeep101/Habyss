let suite = "com.habyss.widget-tests." + UUID().uuidString
let defaults = UserDefaults(suiteName: suite)!
defer { defaults.removePersistentDomain(forName: suite) }
let today = "2026-09-26"
let tomorrow = "2026-09-27"
let item = DashboardTask(id: "task:one", name: "Ship Habyss", isCompleted: false, time: "16:00", dueDate: today)
let snapshot = DashboardSnapshot(version: 1, generatedAt: today, dayKey: today,
    accent: .init(from: "#FF0000", to: "#FFFF00"),
    days: [DashboardDay(date: today, total: 1, completed: 0, items: [item]),
           DashboardDay(date: tomorrow, total: 1, completed: 0, items: [item])],
    heatmap: [HeatmapDay(date: today, completed: 2, total: 3)],
    goals: [DashboardGoal(id: "goal", name: "Launch", progress: 50, color: "#FF0000", taskWeights: ["task:one": 50])])
let raw = String(data: try JSONEncoder().encode(snapshot), encoding: .utf8)!
defaults.set(raw, forKey: "widgetDashboard")
func action(_ id: String, _ done: Bool, _ timestamp: Double) throws {
    let event = WidgetAction(eventId: id, id: "task:one", day: today, done: done, timestamp: timestamp)
    defaults.set(String(data: try JSONEncoder().encode(event), encoding: .utf8)!, forKey: "widget_event_" + id)
}
assert(DashboardSnapshot.read(defaults: defaults)?.days[0].completed == 0)
try action("first", true, 1)
let done = DashboardSnapshot.read(defaults: defaults)!
assert(done.days[0].completed == 1 && done.days[0].items[0].isCompleted)
assert(done.goals[0].progress == 100)
assert(done.days[1].total == 0 && done.days[1].items.isEmpty, "Completed overdue tasks must not appear tomorrow")
assert(defaults.string(forKey: "widgetDashboard") == raw, "Overlay must not mutate the original snapshot")
try action("duplicate", true, 2)
assert(DashboardSnapshot.read(defaults: defaults)!.goals[0].progress == 100, "Duplicate delivery must not count twice")
try action("undo", false, 3)
let undone = DashboardSnapshot.read(defaults: defaults)!
assert(undone.days[0].completed == 0 && undone.goals[0].progress == 50)
assert(undone.days[1].items.count == 1 && undone.days[1].total == 1, "Undo restores a future overdue task")
defaults.set("broken-json", forKey: "widget_event_broken")
assert(DashboardSnapshot.read(defaults: defaults)!.goals[0].progress == 50)
defaults.set(raw.replacingOccurrences(of: "\"version\":1", with: "\"version\":99"), forKey: "widgetDashboard")
assert(DashboardSnapshot.read(defaults: defaults) == nil, "Unknown snapshot versions must be ignored")
print("Swift widget snapshot checks passed: completion, counts, goal progress, rollover, undo, duplicates, corruption, versioning.")
var many = snapshot
many.days[0].total = 2
many.days[0].items.append(DashboardTask(id: "task:two", name: "Next step", isCompleted: false, time: nil, dueDate: today))
defaults.set(String(data: try JSONEncoder().encode(many), encoding: .utf8)!, forKey: "widgetDashboard")
try action("final", true, 4)
let ticked = DashboardSnapshot.read(defaults: defaults)!
assert(ticked.days[0].items[0].id == "task:one" && ticked.days[0].items[0].isCompleted, "A ticked row stays where it was, struck through")
assert(ticked.days[0].items[1].id == "task:two" && !ticked.days[0].items[1].isCompleted, "The next task is still on the widget")
print("Swift widget strike-in-place check passed.")

// File publication takes precedence over an older UserDefaults cache.
var fresh = snapshot
fresh.streak = 9
fresh.goals[0].points = [GoalGraphPoint(date: today, actual: 50)]
let freshRaw = String(data: try JSONEncoder().encode(fresh), encoding: .utf8)!
defaults.removePersistentDomain(forName: suite)
defaults.set("outdated-json", forKey: "widgetDashboard")
let fileEvent = String(data: try JSONEncoder().encode(WidgetAction(eventId: "file-tap", id: "task:one", day: today, done: true, timestamp: 1)), encoding: .utf8)!
let fileSnapshot = DashboardSnapshot.read(defaults: defaults, raw: freshRaw, events: [fileEvent])!
assert(fileSnapshot.streak == 9)
assert(fileSnapshot.days[0].completed == 1)
assert(fileSnapshot.goals[0].points?.last?.actual == 100, "A widget completion must update the selected goal graph too")
assert(DashboardSnapshot.read(defaults: defaults, raw: "{}") == nil, "An explicitly cleared snapshot must not resurrect old data")
assert(DashboardSnapshot.read(defaults: defaults, raw: raw)?.goals[0].points == nil, "Existing v1 snapshots remain readable")
print("Swift atomic snapshot checks passed: file precedence, durable event overlay, goal graph, streak, backwards compatibility.")

import AppIntents
import Foundation
import WidgetKit

// Habyss through Siri, Shortcuts, Spotlight and the Action button, without
// opening the app. Every action goes straight to the account in the cloud
// (the same server Claude and ChatGPT use, supabase/functions/mcp, with a key
// the app makes for Siri: lib/siriAccess.ts). Offline or signed out, it is
// queued in the App Group and Habyss applies it the next time it runs
// (lib/shortcutsInbox.ts), so nothing said is ever lost.

private let appGroup = "group.com.habyss.data"

// MARK: - The cloud

@available(iOS 16.0, *)
enum HabyssCloud {
    enum Failure: Error { case notSetUp, unreachable, refused(String) }

    /// The address with Siri's key in it, written by the app when signed in.
    static var address: URL? {
        UserDefaults(suiteName: appGroup)?.string(forKey: "siri_mcp_url").flatMap(URL.init(string:))
    }

    /// Calls one tool on the Habyss server and returns its answer as text.
    static func call(_ tool: String, _ arguments: [String: Any] = [:]) async throws -> String {
        guard let url = address else { throw Failure.notSetUp }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json, text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "jsonrpc": "2.0", "id": 1, "method": "tools/call",
            "params": ["name": tool, "arguments": arguments],
        ])
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { throw Failure.unreachable }
        guard let http = response as? HTTPURLResponse else { throw Failure.unreachable }
        if http.statusCode == 401 { throw Failure.notSetUp }
        guard http.statusCode == 200,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Failure.unreachable }
        if let error = body["error"] as? [String: Any] { throw Failure.refused(error["message"] as? String ?? "That didn't work.") }
        let result = body["result"] as? [String: Any]
        let text = ((result?["content"] as? [[String: Any]])?.first?["text"] as? String) ?? ""
        if result?["isError"] as? Bool == true { throw Failure.refused(text) }
        return text
    }

    /// A row the server lists as `- [ ] Title … (id <uuid>)` (or without the box, for today's tasks).
    struct Row { let id: String; let title: String; let done: Bool }

    static func rows(_ text: String) -> [Row] {
        text.split(separator: "\n").compactMap { line in
            let line = String(line)
            guard line.hasPrefix("- "), let idRange = line.range(of: " (id ", options: .backwards), line.hasSuffix(")") else { return nil }
            let id = String(line[idRange.upperBound..<line.index(before: line.endIndex)])
            var body = String(line[line.index(line.startIndex, offsetBy: 2)..<idRange.lowerBound])
            var done = false
            if body.hasPrefix("[x] ") { done = true; body.removeFirst(4) } else if body.hasPrefix("[ ] ") { body.removeFirst(4) }
            // The name ends where the details start: " · date", ", priority" or " at 07:00".
            for marker in [" · ", " (", ", ", " at "] { if let cut = body.range(of: marker) { body = String(body[..<cut.lowerBound]) } }
            return Row(id: id, title: body.trimmingCharacters(in: .whitespaces), done: done)
        }
    }

    /// Today from the server: habits (with done) and open tasks, in the app's order.
    static func today() async throws -> (habits: [Row], tasks: [Row]) {
        let text = try await call("get_today")
        let parts = text.components(separatedBy: "\nTasks:")
        return (rows(parts.first ?? ""), rows(parts.count > 1 ? parts[1] : ""))
    }
}

// MARK: - Today, as the app last wrote it for the widget

/// `habitsData` holds habits and tasks, `siriHabitsData` only habits (lib/widgetService.ts).
@available(iOS 16.0, *)
enum TodayList {
    struct Item: Codable { let id: String; let name: String; var isCompleted: Bool }

    static func items(_ key: String) -> [Item] {
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
              let data = raw.data(using: .utf8),
              let items = try? JSONDecoder().decode([Item].self, from: data) else { return [] }
        return items
    }
    static var habits: [Item] { items("siriHabitsData") }
    static var all: [Item] { items("habitsData") }

    /// Shows a tick on the widget straight away; the app's next sync confirms it.
    static func markDone(named name: String) {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return }
        for key in ["habitsData", "siriHabitsData"] {
            var list = items(key)
            guard let index = list.firstIndex(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) else { continue }
            list[index].isCompleted = true
            if let data = try? JSONEncoder().encode(list) { defaults.set(String(data: data, encoding: .utf8), forKey: key) }
        }
        WidgetCenter.shared.reloadAllTimelines()
    }
}

/// Queues a task, habit, goal, thought or anything said freely (`kind|text`).
/// Habyss turns the queue into real rows the next time it runs (`drainQuickAdds`).
@available(iOS 16.0, *)
enum QuickAddQueue {
    static let key = "pending_quick_adds"

    static func append(kind: String, title: String) -> Bool {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let defaults = UserDefaults(suiteName: appGroup) else { return false }
        var pending = defaults.array(forKey: key) as? [String] ?? []
        pending.append("\(kind)|\(name)")
        defaults.set(pending, forKey: key)
        return true
    }

    static func logHabit(_ name: String) {
        let defaults = UserDefaults(suiteName: appGroup)
        var pending = defaults?.array(forKey: "pending_habit_logs") as? [String] ?? []
        pending.append(name)
        defaults?.set(pending, forKey: "pending_habit_logs")
    }
}

private let savedForLater = "Saved. It syncs when you're back online."

/// Saves to the account, or queues it when that can't happen now.
@available(iOS 16.0, *)
private func save(_ tool: String, _ arguments: [String: Any], kind: String, title: String) async -> Bool {
    do { _ = try await HabyssCloud.call(tool, arguments); return true }
    catch HabyssCloud.Failure.refused { return false }
    catch { return QuickAddQueue.append(kind: kind, title: title) }
}

private func dayString(_ date: Date) -> String {
    let format = DateFormatter()
    format.calendar = Calendar(identifier: .gregorian)
    format.locale = Locale(identifier: "en_US_POSIX")
    format.dateFormat = "yyyy-MM-dd"
    return format.string(from: date)
}

// MARK: - Entities

/// A habit, so Siri and Shortcuts offer your habits by name ("Mark Reading done in Habyss").
@available(iOS 16.0, *)
struct HabitEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Habit"
    static var defaultQuery = HabitQuery()
    var id: String
    var name: String
    var isCompleted: Bool
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: isCompleted ? "Done today" : "Not yet today")
    }
    init(id: String, name: String, isCompleted: Bool) { self.id = id; self.name = name; self.isCompleted = isCompleted }
}

@available(iOS 16.0, *)
struct HabitQuery: EntityStringQuery {
    /// From the server when it can be reached (always current), else what the widget last showed.
    private func all() async -> [HabitEntity] {
        if let today = try? await HabyssCloud.today(), !today.habits.isEmpty {
            return today.habits.map { HabitEntity(id: $0.id, name: $0.title, isCompleted: $0.done) }
        }
        return TodayList.habits.map { HabitEntity(id: $0.id, name: $0.name, isCompleted: $0.isCompleted) }
    }
    func entities(for identifiers: [String]) async throws -> [HabitEntity] {
        let local = TodayList.habits.map { HabitEntity(id: $0.id, name: $0.name, isCompleted: $0.isCompleted) }
        let found = local.filter { identifiers.contains($0.id) }
        return found.count == identifiers.count ? found : await all().filter { identifiers.contains($0.id) }
    }
    func entities(matching string: String) async throws -> [HabitEntity] {
        await all().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }
    /// Still to do first: the ones you are most likely to be ticking.
    func suggestedEntities() async throws -> [HabitEntity] {
        await all().sorted { !$0.isCompleted && $1.isCompleted }
    }
}

/// An open task, so Siri can tick one by name ("Complete Call mom in Habyss").
@available(iOS 16.0, *)
struct TaskEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static var defaultQuery = TaskQuery()
    var id: String
    var title: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }
}

@available(iOS 16.0, *)
struct TaskQuery: EntityStringQuery {
    private func open() async -> [TaskEntity] {
        if let text = try? await HabyssCloud.call("list_tasks", ["status": "open", "limit": 50]) {
            return HabyssCloud.rows(text).map { TaskEntity(id: $0.id, title: $0.title) }
        }
        return TodayList.all.filter { $0.id.hasPrefix("task:") && !$0.isCompleted }
            .map { TaskEntity(id: $0.id, title: $0.name) }
    }
    func entities(for identifiers: [String]) async throws -> [TaskEntity] {
        await open().filter { identifiers.contains($0.id) }
    }
    func entities(matching string: String) async throws -> [TaskEntity] {
        await open().filter { $0.title.localizedCaseInsensitiveContains(string) }
    }
    func suggestedEntities() async throws -> [TaskEntity] { await open() }
}

// MARK: - Focus (these open Habyss: the timer runs there)

@available(iOS 16.0, *)
struct StartFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Focus Session"
    static var description = IntentDescription("Starts a focus session in Habyss")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Duration (Minutes)", default: 25)
    var duration: Int

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(duration, forKey: "intent_start_focus_duration")
        defaults?.set(Date().timeIntervalSince1970, forKey: "intent_start_focus_timestamp")
        return .result(dialog: "\(duration) minutes. Phone down.")
    }
}

@available(iOS 16.0, *)
struct StopFocusIntent: AppIntent {
    static var title: LocalizedStringResource = "Stop Focus Session"
    static var description = IntentDescription("Stops the current focus session")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(true, forKey: "intent_stop_focus")
        defaults?.set(Date().timeIntervalSince1970, forKey: "intent_stop_focus_timestamp")
        return .result(dialog: "Focus stopped.")
    }
}

// MARK: - Adding

/// "Add a task in Habyss": the system asks for the name; a day is optional (today by default).
@available(iOS 16.0, *)
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task"
    static var description = IntentDescription("Add a task in Habyss, for today or another day")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task", requestValueDialog: "What's the task?")
    var name: String

    @Parameter(title: "Day")
    var day: Date?

    static var parameterSummary: some ParameterSummary { Summary("Add \(\.$name) on \(\.$day)") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        var arguments: [String: Any] = ["title": name]
        if let day { arguments["due_date"] = dayString(day) }
        do {
            _ = try await HabyssCloud.call("add_task", arguments)
            return .result(dialog: day.map { "Added \(name) for \($0.formatted(.dateTime.weekday(.wide)))." } ?? "Added \(name) to today.")
        } catch HabyssCloud.Failure.refused(let why) {
            return .result(dialog: "\(why)")
        } catch {
            guard QuickAddQueue.append(kind: "task", title: name) else { return .result(dialog: "Open Habyss once, then try again.") }
            return .result(dialog: "\(savedForLater)")
        }
    }
}

@available(iOS 16.0, *)
struct AddHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Habit"
    static var description = IntentDescription("Add a daily habit in Habyss, by name")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Habit", requestValueDialog: "What's the habit?")
    var name: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard await save("add_habit", ["name": name], kind: "habit", title: name) else { return .result(dialog: "That habit didn't save. Try again in Habyss.") }
        return .result(dialog: "Added \(name). Every day, starting now.")
    }
}

@available(iOS 16.0, *)
struct AddGoalIntent: AppIntent {
    /// Goals are off for the first release (constants/features.ts): not offered in Shortcuts.
    static var isDiscoverable: Bool = false
    static var title: LocalizedStringResource = "Add Goal"
    static var description = IntentDescription("Add a goal in Habyss, in your own words")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Goal", requestValueDialog: "What's the goal?")
    var name: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard await save("add_goal", ["name": name], kind: "goal", title: name) else { return .result(dialog: "That goal didn't save. Try again in Habyss.") }
        return .result(dialog: "Goal set: \(name). Bold.")
    }
}

/// "Brain dump in Habyss": whatever is on your mind, kept for later.
@available(iOS 16.0, *)
struct BrainDumpIntent: AppIntent {
    static var title: LocalizedStringResource = "Brain Dump"
    static var description = IntentDescription("Put a thought in your Habyss brain dump")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Thought", requestValueDialog: "What's on your mind?")
    var text: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard await save("add_thought", ["text": text], kind: "thought", title: text) else { return .result(dialog: "That didn't save. Try again in Habyss.") }
        return .result(dialog: "Out of your head, into Habyss.")
    }
}

/// "Tell Echo": say it freely ("call mom tomorrow and run every morning");
/// Echo reads the tasks and habits in it (lib/voicePlan.ts rules), anything
/// unclear kept in the brain dump. Echo is Habyss's other name for Siri
/// (INAlternativeAppNames in Info.plist), so every phrase works with either.
@available(iOS 16.0, *)
struct TellHabyssIntent: AppIntent {
    static var title: LocalizedStringResource = "Tell Echo"
    static var description = IntentDescription("Say what's on your mind in your own words; Echo sorts it into your plan")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "What to add", requestValueDialog: "I'm listening. What's on your mind?")
    var text: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard QuickAddQueue.append(kind: "any", title: text) else { return .result(dialog: "Open Habyss once, then try again.") }
        return .result(dialog: "Got it. It's in your plan.")
    }
}

// MARK: - Doing

@available(iOS 16.0, *)
struct LogHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Habit Done"
    static var description = IntentDescription("Mark one of today's habits done in Habyss")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Habit", requestValueDialog: "Which habit?")
    var habit: HabitEntity

    static var parameterSummary: some ParameterSummary { Summary("Mark \(\.$habit) done") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        if habit.isCompleted { return .result(dialog: "\(habit.name) is already done today.") }
        do {
            // The server's own id when Siri got the habit from it; the name when it came from the widget.
            _ = try await HabyssCloud.call("log_habit", habit.id.hasPrefix("habit:") ? ["name": habit.name] : ["habit_id": habit.id])
        } catch HabyssCloud.Failure.refused(let why) {
            return .result(dialog: "\(why)")
        } catch {
            QuickAddQueue.logHabit(habit.name)
        }
        TodayList.markDone(named: habit.name)
        return .result(dialog: "\(habit.name): done.")
    }
}

@available(iOS 16.0, *)
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task"
    static var description = IntentDescription("Tick one of your open tasks done in Habyss")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task", requestValueDialog: "Which task?")
    var task: TaskEntity

    static var parameterSummary: some ParameterSummary { Summary("Complete \(\.$task)") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let arguments: [String: Any] = task.id.hasPrefix("task:") ? ["title": task.title] : ["task_id": task.id]
        do {
            _ = try await HabyssCloud.call("complete_task", arguments)
        } catch HabyssCloud.Failure.refused(let why) {
            return .result(dialog: "\(why)")
        } catch {
            return .result(dialog: "Habyss can't be reached right now. Try again in a minute.")
        }
        TodayList.markDone(named: task.title)
        return .result(dialog: "\(task.title): done. One less thing.")
    }
}

// MARK: - Asking

/// "What's next in Habyss": the first thing still to do today, and how the day is going.
@available(iOS 16.0, *)
struct WhatsNextIntent: AppIntent {
    static var title: LocalizedStringResource = "What's Next"
    static var description = IntentDescription("Hear the next thing to do today in Habyss")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        var left: [String] = []
        var total = 0
        if let today = try? await HabyssCloud.today() {
            left = today.habits.filter { !$0.done }.map(\.title) + today.tasks.map(\.title)
            total = today.habits.count + today.tasks.count
        } else {
            let items = TodayList.all
            left = items.filter { !$0.isCompleted }.map(\.name)
            total = items.count
        }
        guard total > 0 else { return .result(value: "", dialog: "Nothing planned today. Tell Habyss what matters.") }
        guard let next = left.first else { return .result(value: "", dialog: "All done. Nothing left but rest.") }
        let more = left.count - 1
        return .result(value: next, dialog: "Next: \(next).\(more > 0 ? " Then \(more) more." : " That's the last one.")")
    }
}

@available(iOS 16.0, *)
struct CheckProgressIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Today's Progress"
    static var description = IntentDescription("Hear how much of today's plan is done")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<Int> {
        var done = 0, habits = 0, tasks = 0
        if let today = try? await HabyssCloud.today() {
            habits = today.habits.count; done = today.habits.filter(\.done).count; tasks = today.tasks.count
        } else {
            let items = TodayList.all
            habits = items.count; done = items.filter(\.isCompleted).count
        }
        if habits == 0 && tasks == 0 { return .result(value: 0, dialog: "Nothing planned today. Bold strategy.") }
        let taskLine = tasks > 0 ? " \(tasks) task\(tasks == 1 ? "" : "s") open." : ""
        if done == habits && habits > 0 { return .result(value: done, dialog: "All \(habits) habits done.\(taskLine)") }
        return .result(value: done, dialog: "\(done) of \(habits) habits done.\(taskLine)")
    }
}

// MARK: - More: moving, undoing, asking about any stretch of time (in Shortcuts and automations)

/// Which task, to the server: its own id when it came from there, else its title to find it by.
@available(iOS 16.0, *)
private func taskRef(_ task: TaskEntity) -> [String: Any] { task.id.hasPrefix("task:") ? ["find": task.title] : ["task_id": task.id] }
@available(iOS 16.0, *)
private func habitRef(_ habit: HabitEntity) -> [String: Any] { habit.id.hasPrefix("habit:") ? ["find": habit.name] : ["habit_id": habit.id] }

/// "Move Essay to Friday": a task to another day (and time, when given).
@available(iOS 16.0, *)
struct RescheduleTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Move Task"
    static var description = IntentDescription("Move one of your tasks to another day in Habyss")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Task", requestValueDialog: "Which task?") var task: TaskEntity
    @Parameter(title: "To", requestValueDialog: "To when?") var day: Date
    static var parameterSummary: some ParameterSummary { Summary("Move \(\.$task) to \(\.$day)") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        var arguments = taskRef(task)
        arguments["due_date"] = dayString(day)
        let parts = Calendar.current.dateComponents([.hour, .minute], from: day)
        if let hour = parts.hour, let minute = parts.minute, hour + minute > 0 { arguments["due_time"] = String(format: "%02d:%02d", hour, minute) }
        do { return .result(dialog: "\(try await HabyssCloud.call("update_task", arguments))") }
        catch HabyssCloud.Failure.refused(let why) { return .result(dialog: "\(why)") }
        catch { return .result(dialog: "Habyss can't be reached right now. Try again in a minute.") }
    }
}

/// "Move what's left to tomorrow": every task still open today goes to tomorrow, in one go.
@available(iOS 16.0, *)
struct MoveLeftoversIntent: AppIntent {
    static var title: LocalizedStringResource = "Move Today's Leftovers to Tomorrow"
    static var description = IntentDescription("Every task still open today moves to tomorrow")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        let open: [HabyssCloud.Row]
        do { open = try await HabyssCloud.today().tasks.filter { !$0.done } }
        catch { return .result(value: 0, dialog: "Habyss can't be reached right now. Try again in a minute.") }
        guard !open.isEmpty else { return .result(value: 0, dialog: "Nothing left today. Clean slate.") }
        let tomorrow = dayString(Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date())
        var moved = 0
        for task in open where (try? await HabyssCloud.call("update_task", ["task_id": task.id, "due_date": tomorrow])) != nil { moved += 1 }
        return .result(value: moved, dialog: "Moved \(moved) task\(moved == 1 ? "" : "s") to tomorrow. Rest up.")
    }
}

/// The stretch of time to ask about.
@available(iOS 16.0, *)
enum ReviewPeriod: String, AppEnum {
    case today, week, month, year
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Period"
    static var caseDisplayRepresentations: [ReviewPeriod: DisplayRepresentation] = [
        .today: "Today", .week: "This week", .month: "This month", .year: "This year",
    ]
    var days: Int { switch self { case .today: return 0; case .week: return 6; case .month: return 29; case .year: return 364 } }
    var said: String { switch self { case .today: return "Today"; case .week: return "This week"; case .month: return "This month"; case .year: return "This year" } }
}

/// "How did I do this week": habits kept, the best and the weakest, tasks done and overdue.
@available(iOS 16.0, *)
struct ReviewIntent: AppIntent {
    static var title: LocalizedStringResource = "How Did I Do"
    static var description = IntentDescription("Your habits kept, best and weakest habit, tasks done and overdue, for any stretch of time")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Period", default: .week) var period: ReviewPeriod
    static var parameterSummary: some ParameterSummary { Summary("How did I do \(\.$period)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let to = Date()
        let from = Calendar.current.date(byAdding: .day, value: -period.days, to: to) ?? to
        let text: String
        do { text = try await HabyssCloud.call("get_stats", ["from": dayString(from), "to": dayString(to)]) }
        catch { return .result(value: "", dialog: "Habyss can't be reached right now. Try again in a minute.") }
        let lines = text.components(separatedBy: "\n")
        let habits = lines.first { $0.hasPrefix("Habits: ") }.map { String($0.dropFirst(8)) } ?? "nothing due"
        // Per habit: "- Run: 6/7 (86%), streak 12 (id …)": the best and the weakest.
        let rated: [(name: String, rate: Double)] = lines.compactMap { line in
            guard line.hasPrefix("- "), line.contains(", streak "), let colon = line.firstIndex(of: ":"),
                  let slash = line.firstIndex(of: "/") else { return nil }
            let name = String(line[line.index(line.startIndex, offsetBy: 2)..<colon])
            let done = Double(line[line.index(after: colon)..<slash].trimmingCharacters(in: .whitespaces)) ?? 0
            let rest = line[line.index(after: slash)...]
            let total = Double(rest.prefix { $0.isNumber }) ?? 0
            return total > 0 ? (name, done / total) : nil
        }
        let best = rated.max { $0.rate < $1.rate }
        let worst = rated.min { $0.rate < $1.rate }
        let tasks = lines.first { $0.hasPrefix("Tasks: ") }.map { line -> String in
            let done = line.dropFirst(7).prefix { $0.isNumber }
            let overdue = line.components(separatedBy: "; ").last?.prefix { $0.isNumber } ?? "0"
            return "\(done) task\(done == "1" ? "" : "s") done, \(overdue) overdue"
        } ?? ""
        var said = "\(period.said): habits \(habits). \(tasks)."
        if let best, let worst, best.name != worst.name {
            said += " Strongest: \(best.name). Needs you: \(worst.name)."
        }
        return .result(value: said, dialog: "\(said)")
    }
}

/// "What's my Run streak": days in a row, from the server.
@available(iOS 16.0, *)
struct StreakIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Habit Streak"
    static var description = IntentDescription("How many days in a row you have kept a habit")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Habit", requestValueDialog: "Which habit?") var habit: HabitEntity
    static var parameterSummary: some ParameterSummary { Summary("Streak of \(\.$habit)") }

    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        guard let text = try? await HabyssCloud.call("get_stats") else { return .result(value: 0, dialog: "Habyss can't be reached right now.") }
        let line = text.components(separatedBy: "\n").first { $0.hasPrefix("- \(habit.name):") || $0.contains("(id \(habit.id))") }
        let streak = line.flatMap { $0.components(separatedBy: "streak ").last }.map { Int($0.prefix { $0.isNumber }) ?? 0 } ?? 0
        return .result(value: streak, dialog: streak == 0 ? "No streak on \(habit.name) yet. Today can be day one." : "\(habit.name): \(streak) day\(streak == 1 ? "" : "s") in a row.")
    }
}

/// For automations: is this habit done today? (True or false, to branch on.)
@available(iOS 16.0, *)
struct IsHabitDoneIntent: AppIntent {
    static var title: LocalizedStringResource = "Is Habit Done Today"
    static var description = IntentDescription("True when the habit is done today: for automations that nudge you, or reward you")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Habit", requestValueDialog: "Which habit?") var habit: HabitEntity
    static var parameterSummary: some ParameterSummary { Summary("Is \(\.$habit) done today") }

    func perform() async throws -> some IntentResult & ReturnsValue<Bool> & ProvidesDialog {
        let today = try? await HabyssCloud.today()
        let done = today?.habits.first { $0.id == habit.id || $0.title.caseInsensitiveCompare(habit.name) == .orderedSame }?.done ?? habit.isCompleted
        return .result(value: done, dialog: done ? "Yes, \(habit.name) is done." : "Not yet. \(habit.name) is still waiting.")
    }
}

/// For automations: how much is left today (habits not done and open tasks).
@available(iOS 16.0, *)
struct ThingsLeftIntent: AppIntent {
    static var title: LocalizedStringResource = "Count What's Left Today"
    static var description = IntentDescription("How many habits and tasks are still to do today, as a number")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
        guard let today = try? await HabyssCloud.today() else { return .result(value: 0, dialog: "Habyss can't be reached right now.") }
        let left = today.habits.filter { !$0.done }.count + today.tasks.filter { !$0.done }.count
        return .result(value: left, dialog: left == 0 ? "Nothing left. You're done for today." : "\(left) thing\(left == 1 ? "" : "s") left today.")
    }
}

/// "Undo Run": un-tick a habit marked done by mistake.
@available(iOS 16.0, *)
struct UndoHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Undo Habit"
    static var description = IntentDescription("Un-tick a habit you marked done by mistake")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Habit", requestValueDialog: "Which habit?") var habit: HabitEntity
    static var parameterSummary: some ParameterSummary { Summary("Undo \(\.$habit)") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        do { _ = try await HabyssCloud.call("undo_habit", habitRef(habit)); return .result(dialog: "\(habit.name) is open again.") }
        catch HabyssCloud.Failure.refused(let why) { return .result(dialog: "\(why)") }
        catch { return .result(dialog: "Habyss can't be reached right now. Try again in a minute.") }
    }
}

/// "Delete a task": asks first.
@available(iOS 16.0, *)
struct DeleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Delete Task"
    static var description = IntentDescription("Delete one of your tasks (Habyss asks first)")
    static var openAppWhenRun: Bool = false
    @Parameter(title: "Task", requestValueDialog: "Which task?") var task: TaskEntity
    static var parameterSummary: some ParameterSummary { Summary("Delete \(\.$task)") }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await requestConfirmation(result: .result(dialog: "Delete \(task.title)?"))
        do { _ = try await HabyssCloud.call("delete_task", taskRef(task)); return .result(dialog: "Deleted \(task.title).") }
        catch HabyssCloud.Failure.refused(let why) { return .result(dialog: "\(why)") }
        catch { return .result(dialog: "Habyss can't be reached right now. Try again in a minute.") }
    }
}

/// "Read me my day": everything planned today, in order.
@available(iOS 16.0, *)
struct ReadMyDayIntent: AppIntent {
    static var title: LocalizedStringResource = "Read Me My Day"
    static var description = IntentDescription("Everything on today, what's done and what's left")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        guard let today = try? await HabyssCloud.today() else { return .result(value: "", dialog: "Habyss can't be reached right now.") }
        let left = today.habits.filter { !$0.done }.map(\.title) + today.tasks.filter { !$0.done }.map(\.title)
        let done = today.habits.filter(\.done).count + today.tasks.filter(\.done).count
        guard !left.isEmpty else { return .result(value: "", dialog: "All \(done) done. Nothing left but rest.") }
        let list = left.count <= 2 ? left.joined(separator: " and ") : left.dropLast().joined(separator: ", ") + ", and " + (left.last ?? "")
        let said = "\(done) done, \(left.count) to go: \(list)."
        return .result(value: said, dialog: "\(said)")
    }
}

// MARK: - Siri phrases (Apple allows 10; Stop Focus stays an action in Shortcuts)

@available(iOS 16.0, *)
struct HabyssShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task in \(.applicationName)",
                "New task in \(.applicationName)",
                "Remind me in \(.applicationName)"
            ],
            shortTitle: "Add Task",
            systemImageName: "plus.square"
        )
        AppShortcut(
            intent: LogHabitIntent(),
            phrases: [
                "Mark \(\.$habit) done in \(.applicationName)",
                "I did \(\.$habit) in \(.applicationName)",
                "Log \(\.$habit) in \(.applicationName)",
                "Mark a habit done in \(.applicationName)"
            ],
            shortTitle: "Mark Habit Done",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: [
                "Complete \(\.$task) in \(.applicationName)",
                "Tick \(\.$task) in \(.applicationName)",
                "Complete a task in \(.applicationName)"
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.square"
        )
        AppShortcut(
            intent: WhatsNextIntent(),
            phrases: [
                "What's next in \(.applicationName)",
                "What should I do now in \(.applicationName)"
            ],
            shortTitle: "What's Next",
            systemImageName: "arrow.right.circle"
        )
        AppShortcut(
            intent: CheckProgressIntent(),
            phrases: [
                "How am I doing in \(.applicationName)",
                "Check progress in \(.applicationName)"
            ],
            shortTitle: "Check Progress",
            systemImageName: "chart.bar"
        )
        AppShortcut(
            intent: TellHabyssIntent(),
            phrases: [
                "Tell \(.applicationName)",
                "Talk to \(.applicationName)",
                "Plan with \(.applicationName)",
                "Ask \(.applicationName)"
            ],
            shortTitle: "Tell Echo",
            systemImageName: "text.bubble"
        )
        AppShortcut(
            intent: AddHabitIntent(),
            phrases: [
                "Add a habit in \(.applicationName)",
                "New habit in \(.applicationName)"
            ],
            shortTitle: "Add Habit",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: MoveLeftoversIntent(),
            phrases: [
                "Move what's left to tomorrow in \(.applicationName)",
                "Push the rest to tomorrow in \(.applicationName)"
            ],
            shortTitle: "Move Leftovers",
            systemImageName: "arrow.uturn.forward"
        )
        AppShortcut(
            intent: StartFocusIntent(),
            phrases: [
                "Start focus in \(.applicationName)",
                "Focus with \(.applicationName)"
            ],
            shortTitle: "Start Focus",
            systemImageName: "timer"
        )
        AppShortcut(
            intent: BrainDumpIntent(),
            phrases: [
                "Brain dump in \(.applicationName)",
                "Note a thought in \(.applicationName)"
            ],
            shortTitle: "Brain Dump",
            systemImageName: "brain"
        )
    }

    static var shortcutTileColor: ShortcutTileColor = .navy
}

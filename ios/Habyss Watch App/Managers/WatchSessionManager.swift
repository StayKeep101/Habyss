import Foundation
import WatchConnectivity
import WatchKit
import Combine

/// One of today's habits, as the phone sends it.
struct WatchHabit: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var color: String
    var completed: Bool
    var streakCount: Int
    /// A timed habit is finished by its timer on the phone, not a tap.
    var canTick: Bool
    /// Where today's timeline has it, in minutes from midnight (-1: no place).
    var start: Int
    var end: Int
    /// Cut short to fit the day.
    var cut: Bool
    /// The one you are on.
    var now: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        color = (try? c.decode(String.self, forKey: .color)) ?? ""
        completed = (try? c.decode(Bool.self, forKey: .completed)) ?? false
        streakCount = (try? c.decode(Int.self, forKey: .streakCount)) ?? 0
        canTick = (try? c.decode(Bool.self, forKey: .canTick)) ?? true
        start = (try? c.decode(Int.self, forKey: .start)) ?? -1
        end = (try? c.decode(Int.self, forKey: .end)) ?? -1
        cut = (try? c.decode(Bool.self, forKey: .cut)) ?? false
        now = (try? c.decode(Bool.self, forKey: .now)) ?? false
    }
}

/// One of today's tasks, as the phone sends it.
struct WatchTask: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var completed: Bool
    /// "HH:MM", or empty.
    var time: String
    var start: Int
    var end: Int
    var cut: Bool
    var now: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        completed = (try? c.decode(Bool.self, forKey: .completed)) ?? false
        time = (try? c.decode(String.self, forKey: .time)) ?? ""
        start = (try? c.decode(Int.self, forKey: .start)) ?? -1
        end = (try? c.decode(Int.self, forKey: .end)) ?? -1
        cut = (try? c.decode(Bool.self, forKey: .cut)) ?? false
        now = (try? c.decode(Bool.self, forKey: .now)) ?? false
    }
}

/// The phone's focus session, mirrored here.
struct PhoneFocus: Equatable {
    var id: String
    var title: String
    /// When the countdown ends; nil while paused or for a stopwatch.
    var endsAt: Date?
    var startedAt: Date
    /// Seconds left, while paused.
    var left: Int
    var paused: Bool
    var stopwatch: Bool

    init?(_ raw: Any?) {
        guard let raw = raw as? [String: Any], let id = raw["id"] as? String, !id.isEmpty else { return nil }
        self.id = id
        title = raw["title"] as? String ?? "Focus"
        let ends = (raw["endsAt"] as? Double) ?? 0
        endsAt = ends > 0 ? Date(timeIntervalSince1970: ends / 1000) : nil
        startedAt = Date(timeIntervalSince1970: ((raw["startedAt"] as? Double) ?? Date().timeIntervalSince1970 * 1000) / 1000)
        left = (raw["left"] as? Int) ?? Int((raw["left"] as? Double) ?? 0)
        paused = raw["paused"] as? Bool ?? false
        stopwatch = raw["stopwatch"] as? Bool ?? false
    }
}

/// A task or a habit, as one row of today's timeline.
struct DayItem: Identifiable, Hashable {
    enum Kind: String { case task, habit }
    var kind: Kind
    var itemId: String
    var title: String
    var completed: Bool
    var canTick: Bool
    var streak: Int
    var start: Int
    var end: Int
    var cut: Bool
    var now: Bool
    var id: String { "\(kind.rawValue):\(itemId)" }

    /// How long the timeline gives it (cut length included), for the focus timer.
    var minutes: Int { start >= 0 && end > start ? end - start : 25 }

    /// "5:25–5:55 PM", or empty when it has no place today.
    var timeLabel: String {
        guard start >= 0, end > start else { return "" }
        return "\(Self.clock(start))–\(Self.clock(end))"
    }

    static func clock(_ minutes: Int) -> String {
        var parts = DateComponents()
        parts.hour = (minutes / 60) % 24
        parts.minute = minutes % 60
        let date = Calendar.current.date(from: parts) ?? Date()
        return date.formatted(date: .omitted, time: .shortened)
    }
}

/**
 * Today, on the wrist: the tasks and habits the phone sends, and a tap to tick
 * one. A tick shows at once and goes to the phone (by message when it is in
 * reach, otherwise queued by the system so it is never lost). Until the phone
 * sends a snapshot that agrees, the tick is kept here, so a stale snapshot
 * cannot undo it.
 */
final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published private(set) var habits: [WatchHabit] = []
    @Published private(set) var tasks: [WatchTask] = []
    @Published private(set) var dayKey: String = ""
    /// The phone's focus session, while one is on.
    @Published private(set) var phoneFocus: PhoneFocus?

    private let store = UserDefaults.standard
    /// "habit:<id>" / "task:<id>" → the state tapped here, until the phone agrees.
    private var pending: [String: Bool] = [:]

    private override init() {
        super.init()
        pending = (store.dictionary(forKey: "watchPending") as? [String: Bool]) ?? [:]
        if let data = store.data(forKey: "watchSnapshot"),
           let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            apply(raw, persist: false)
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    static var today: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    /// The snapshot is from an earlier day: the phone has not sent today yet.
    var isStale: Bool { !dayKey.isEmpty && dayKey != Self.today }

    var doneCount: Int { tasks.filter(\.completed).count + habits.filter(\.completed).count }

    /// Today's tasks and habits as one timeline, in the order the phone placed them.
    var items: [DayItem] {
        let all = tasks.map { DayItem(kind: .task, itemId: $0.id, title: $0.title, completed: $0.completed, canTick: true, streak: 0, start: $0.start, end: $0.end, cut: $0.cut, now: $0.now) }
            + habits.map { DayItem(kind: .habit, itemId: $0.id, title: $0.title, completed: $0.completed, canTick: $0.canTick, streak: $0.streakCount, start: $0.start, end: $0.end, cut: $0.cut, now: $0.now) }
        return all.sorted { a, b in
            let (x, y) = (a.start < 0 ? Int.max : a.start, b.start < 0 ? Int.max : b.start)
            return x != y ? x < y : a.title < b.title
        }
    }

    /// What to do now: the one the phone says you are on, else the first not done.
    var current: DayItem? { items.first { $0.now && !$0.completed } ?? items.first { !$0.completed } }

    func toggle(_ item: DayItem) {
        switch item.kind {
        case .task: if let task = tasks.first(where: { $0.id == item.itemId }) { toggleTask(task) }
        case .habit: if let habit = habits.first(where: { $0.id == item.itemId }) { toggleHabit(habit) }
        }
    }

    /// The next thing after `id`, in the timeline's order: what Next moves on to.
    func next(after id: String) -> DayItem? {
        items.first { !$0.completed && $0.id != id && $0.now } ?? items.first { !$0.completed && $0.id != id }
    }

    /// Next, while the phone is focusing: the phone finishes this one and moves on (its plan, its order).
    func focusNextOnPhone() {
        HapticService.play(.success)
        let message: [String: Any] = ["action": "FOCUS_NEXT", "payload": ["id": phoneFocus?.id ?? ""]]
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in session.transferUserInfo(message) }
        } else {
            session.transferUserInfo(message)
        }
    }

    /// Finished from the focus timer: marks it done (never undoes one already done).
    func finish(_ item: DayItem) {
        guard let fresh = items.first(where: { $0.id == item.id }), !fresh.completed else { return }
        switch item.kind {
        case .task: if let task = tasks.first(where: { $0.id == item.itemId }) { toggleTask(task) }
        case .habit:
            // A timed habit is finished by its timer: this is that timer.
            guard let index = habits.firstIndex(where: { $0.id == item.itemId }) else { return }
            habits[index].completed = true
            send(id: "habit:\(item.itemId)", done: true, source: "focus")
        }
    }
    var totalCount: Int { tasks.count + habits.count }

    // MARK: - Ticking

    func toggleTask(_ task: WatchTask) {
        guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[index].completed.toggle()
        send(id: "task:\(task.id)", done: tasks[index].completed)
    }

    func toggleHabit(_ habit: WatchHabit) {
        guard habit.canTick, let index = habits.firstIndex(where: { $0.id == habit.id }) else { return }
        habits[index].completed.toggle()
        send(id: "habit:\(habit.id)", done: habits[index].completed)
    }

    private func send(id: String, done: Bool, source: String? = nil) {
        pending[id] = done
        store.set(pending, forKey: "watchPending")
        HapticService.playTick(done)
        if done && doneCount == totalCount { HapticService.playAllComplete() }

        var payload: [String: Any] = [
            "id": id, "done": done, "day": Self.today,
            "eventId": UUID().uuidString, "timestamp": Date().timeIntervalSince1970 * 1000,
        ]
        if let source { payload["source"] = source }
        let message: [String: Any] = ["action": "TOGGLE", "payload": payload]
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in session.transferUserInfo(message) }
        } else {
            session.transferUserInfo(message)
        }
    }

    // MARK: - Snapshot

    private func requestSnapshot() {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["action": "REQUEST_INITIAL_DATA", "payload": [:]], replyHandler: { [weak self] reply in
            DispatchQueue.main.async { self?.apply(reply, persist: true) }
        }, errorHandler: nil)
    }

    private func apply(_ data: [String: Any], persist: Bool) {
        for (key, stored) in [("accent", "watchAccent"), ("accentFrom", "watchAccentFrom"), ("accentTo", "watchAccentTo")] {
            if let hex = data[key] as? String { store.set(hex, forKey: stored) }
        }
        if data.keys.contains("focus") { phoneFocus = PhoneFocus(data["focus"]) }
        guard data["habits"] != nil || data["tasks"] != nil else { return }
        var nextHabits = decode([WatchHabit].self, data["habits"]) ?? habits
        var nextTasks = decode([WatchTask].self, data["tasks"]) ?? tasks
        let day = data["dayKey"] as? String ?? dayKey
        if day != dayKey { pending = pending.filter { _ in day == Self.today } }

        // A tick made here wins until the phone's snapshot shows the same.
        for (key, done) in pending {
            if key.hasPrefix("habit:"), let i = nextHabits.firstIndex(where: { "habit:\($0.id)" == key }) {
                if nextHabits[i].completed == done { pending[key] = nil } else { nextHabits[i].completed = done }
            } else if key.hasPrefix("task:"), let i = nextTasks.firstIndex(where: { "task:\($0.id)" == key }) {
                if nextTasks[i].completed == done { pending[key] = nil } else { nextTasks[i].completed = done }
            } else {
                pending[key] = nil
            }
        }
        store.set(pending, forKey: "watchPending")

        habits = nextHabits
        tasks = nextTasks
        dayKey = day
        if persist, let saved = try? JSONSerialization.data(withJSONObject: [
            "habits": data["habits"] ?? [], "tasks": data["tasks"] ?? [], "dayKey": day,
        ]) {
            store.set(saved, forKey: "watchSnapshot")
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ value: Any?) -> T? {
        guard let value, JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        guard activationState == .activated else { return }
        let context = session.receivedApplicationContext
        DispatchQueue.main.async {
            if !context.isEmpty { self.apply(context, persist: true) }
            self.requestSnapshot()
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.apply(applicationContext, persist: true) }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.apply(message, persist: true) }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        DispatchQueue.main.async { self.apply(userInfo, persist: true) }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        if session.isReachable { DispatchQueue.main.async { self.requestSnapshot() } }
    }
}

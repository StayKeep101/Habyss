import Foundation
import WatchConnectivity
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

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        color = (try? c.decode(String.self, forKey: .color)) ?? ""
        completed = (try? c.decode(Bool.self, forKey: .completed)) ?? false
        streakCount = (try? c.decode(Int.self, forKey: .streakCount)) ?? 0
        canTick = (try? c.decode(Bool.self, forKey: .canTick)) ?? true
    }
}

/// One of today's tasks, as the phone sends it.
struct WatchTask: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var completed: Bool
    /// "HH:MM", or empty.
    var time: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        completed = (try? c.decode(Bool.self, forKey: .completed)) ?? false
        time = (try? c.decode(String.self, forKey: .time)) ?? ""
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

    private func send(id: String, done: Bool) {
        pending[id] = done
        store.set(pending, forKey: "watchPending")
        HapticService.playTick(done)
        if done && doneCount == totalCount { HapticService.playAllComplete() }

        let message: [String: Any] = ["action": "TOGGLE", "payload": [
            "id": id, "done": done, "day": Self.today,
            "eventId": UUID().uuidString, "timestamp": Date().timeIntervalSince1970 * 1000,
        ]]
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

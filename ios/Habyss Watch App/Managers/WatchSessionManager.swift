import Foundation
import WatchConnectivity
import Combine
import WatchKit

class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()
    
    @Published var habits: [Habit] = []
    @Published var isReachable = false
    @Published var lastSyncDate: Date?
    
    private var offlineQueue: [[String: Any]] = []
    
    var lastSyncString: String {
        guard let date = lastSyncDate else { return "Never" }
        let formatter = RelativeDateTimeFormatter()
        return formatter.localizedString(for: date, relativeTo: .now)
    }
    
    override private init() {
        super.init()
        // Initialize haptics as enabled by default
        if UserDefaults.standard.object(forKey: "watchHapticsEnabled") == nil {
            UserDefaults.standard.set(true, forKey: "watchHapticsEnabled")
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
        loadCachedHabits()
    }
    
    // MARK: - Send Operations
    
    func sendAction(_ action: String, payload: [String: Any]) {
        let message: [String: Any] = ["action": action, "payload": payload]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message, replyHandler: nil, errorHandler: { [weak self] error in
                print("Error sending message: \(error.localizedDescription)")
                self?.queueOfflineMessage(message)
            })
        } else {
            queueOfflineMessage(message)
        }
    }
    
    func sendMessage(message: [String: Any]) {
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message, replyHandler: nil, errorHandler: { error in
                print("Error sending message: \(error.localizedDescription)")
            })
        }
    }
    
    func requestFullSync() {
        let request: [String: Any] = ["action": "REQUEST_FULL_SYNC", "payload": ["timestamp": Date().timeIntervalSince1970]]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(request, replyHandler: { [weak self] response in
                if let habitsData = response["habits"] as? [[String: Any]] {
                    DispatchQueue.main.async {
                        self?.habits = habitsData.map { Habit(dictionary: $0) }
                        self?.saveHabitsToCache()
                        self?.lastSyncDate = .now
                    }
                }
            }, errorHandler: nil)
        }
    }
    
    func requestUpdate() {
        guard WCSession.default.isReachable else { return }
        sendAction("REQUEST_INITIAL_DATA", payload: [:])
    }
    
    // MARK: - Cache
    
    func saveHabitsToCache() {
        if let data = try? JSONEncoder().encode(habits) {
            UserDefaults.standard.set(data, forKey: HabyssConstants.cachedHabitsKey)
            UserDefaults.standard.set(Date(), forKey: HabyssConstants.habitCacheDateKey)
        }
    }
    
    func loadCachedHabits() {
        // Try Codable cache first
        if let data = UserDefaults.standard.data(forKey: HabyssConstants.cachedHabitsKey),
           let cached = try? JSONDecoder().decode([Habit].self, from: data) {
            self.habits = cached
            return
        }
        // Fallback to App Group (shared with iOS app)
        if let userDefaults = UserDefaults(suiteName: HabyssConstants.appGroupId),
           let jsonStr = userDefaults.string(forKey: "habitsData"),
           let data = jsonStr.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([Habit].self, from: data) {
            self.habits = decoded
        }
    }
    
    func markHabitCompleted(habitId: String, count: Int = 1) {
        if let idx = habits.firstIndex(where: { $0.id == habitId }) {
            habits[idx].isCompletedToday = true
            if habits[idx].supportsCountable {
                habits[idx].completionCount = min(
                    habits[idx].completionCount + count,
                    habits[idx].targetCount
                )
            } else {
                habits[idx].completionCount = habits[idx].targetCount
            }
            habits[idx].streakCount += 1
            saveHabitsToCache()
        }
        // Notify phone
        sendAction("COMPLETE_HABIT", payload: ["id": habitId, "count": count, "source": "watch"])
    }
    
    // MARK: - Offline Queue
    
    private func queueOfflineMessage(_ message: [String: Any]) {
        offlineQueue.append(message)
        persistOfflineQueue()
    }
    
    private func flushOfflineQueue() {
        let pending = offlineQueue
        offlineQueue.removeAll()
        persistOfflineQueue()
        for msg in pending {
            if WCSession.default.isReachable {
                WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: nil)
            } else {
                // Use transferUserInfo for guaranteed delivery
                WCSession.default.transferUserInfo(msg)
            }
        }
    }
    
    private func persistOfflineQueue() {
        // Simplified persistence — convert to Data via NSKeyedArchiver or store count
        UserDefaults.standard.set(offlineQueue.count, forKey: "offlineQueueCount")
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("WCSession activation failed: \(error.localizedDescription)")
        } else {
            print("WCSession activated with state: \(activationState.rawValue)")
            DispatchQueue.main.async {
                self.isReachable = session.isReachable
            }
            if activationState == .activated {
                requestUpdate()
                flushOfflineQueue()
            }
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.handleMessage(message) }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.handleMessage(applicationContext) }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        DispatchQueue.main.async { self.handleMessage(userInfo) }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable { self.flushOfflineQueue() }
        }
    }
    
    private func handleMessage(_ data: [String: Any]) {
        // The phone's theme, so the watch is the same colour as the app.
        for (key, stored) in [("accent", "watchAccent"), ("accentFrom", "watchAccentFrom"), ("accentTo", "watchAccentTo")] {
            if let hex = data[key] as? String { UserDefaults.standard.set(hex, forKey: stored) }
        }
        if let habitsData = data["habits"] as? [[String: Any]] {
            self.habits = habitsData.map { Habit(dictionary: $0) }
            self.lastSyncDate = .now
            saveHabitsToCache()
        }
    }
}

// MARK: - Habit Model

struct Habit: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var emoji: String
    var icon: String            // SF Symbol fallback
    var category: HabitCategory
    var frequency: HabitFrequency
    var targetCount: Int
    var unit: String
    var color: String           // hex string
    var streakCount: Int
    var longestStreak: Int
    var isCompletedToday: Bool
    var completionCount: Int
    var isPinned: Bool
    var supportsCountable: Bool
    var watchPriority: Int
    
    // Computed
    var progress: Double {
        targetCount > 0 ? Double(completionCount) / Double(targetCount) : 0
    }
    
    init(dictionary: [String: Any]) {
        self.id = dictionary["id"] as? String ?? UUID().uuidString
        self.title = dictionary["title"] as? String ?? "Unknown"
        self.emoji = dictionary["emoji"] as? String ?? "⭐"
        self.icon = dictionary["icon"] as? String ?? "star"
        self.category = HabitCategory(rawValue: dictionary["category"] as? String ?? "custom") ?? .custom
        self.frequency = HabitFrequency(rawValue: dictionary["frequency"] as? String ?? "daily") ?? .daily
        self.targetCount = dictionary["targetCount"] as? Int ?? dictionary["target_count"] as? Int ?? 1
        self.unit = dictionary["unit"] as? String ?? ""
        self.color = dictionary["color"] as? String ?? "#3B82F6"
        self.streakCount = dictionary["streakCount"] as? Int ?? dictionary["streak_count"] as? Int ?? 0
        self.longestStreak = dictionary["longestStreak"] as? Int ?? dictionary["longest_streak"] as? Int ?? 0
        self.isCompletedToday = dictionary["completed"] as? Bool ?? dictionary["isCompletedToday"] as? Bool ?? false
        self.completionCount = dictionary["completionCount"] as? Int ?? dictionary["completion_count"] as? Int ?? (self.isCompletedToday ? self.targetCount : 0)
        self.isPinned = dictionary["isPinned"] as? Bool ?? dictionary["is_pinned"] as? Bool ?? false
        self.supportsCountable = dictionary["supportsCountable"] as? Bool ?? dictionary["supports_countable"] as? Bool ?? false
        self.watchPriority = dictionary["watchPriority"] as? Int ?? dictionary["watch_priority"] as? Int ?? 0
    }
    
    // Default init for previews/testing
    init(
        id: String = UUID().uuidString,
        title: String,
        emoji: String = "⭐",
        icon: String = "star",
        category: HabitCategory = .custom,
        frequency: HabitFrequency = .daily,
        targetCount: Int = 1,
        unit: String = "",
        color: String = "#3B82F6",
        streakCount: Int = 0,
        longestStreak: Int = 0,
        isCompletedToday: Bool = false,
        completionCount: Int = 0,
        isPinned: Bool = false,
        supportsCountable: Bool = false,
        watchPriority: Int = 0
    ) {
        self.id = id
        self.title = title
        self.emoji = emoji
        self.icon = icon
        self.category = category
        self.frequency = frequency
        self.targetCount = targetCount
        self.unit = unit
        self.color = color
        self.streakCount = streakCount
        self.longestStreak = longestStreak
        self.isCompletedToday = isCompletedToday
        self.completionCount = completionCount
        self.isPinned = isPinned
        self.supportsCountable = supportsCountable
        self.watchPriority = watchPriority
    }
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
    case custom = "custom"
}

// MARK: - UserContext

struct UserContext {
    let name: String
    let level: Int
    
    init(dictionary: [String: Any]) {
        self.name = dictionary["name"] as? String ?? "User"
        self.level = dictionary["level"] as? Int ?? 1
    }
}

import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

@available(iOS 16.0, *)
class ScreenTimeManager: ObservableObject {
    static let shared = ScreenTimeManager()
    
    private let store = ManagedSettingsStore()
    private let appGroupId = "group.com.habyss.data"
    @Published var activitySelection = FamilyActivitySelection()
    /// A focus session wants the shield up. Kept so that apps chosen in the
    /// picker mid-session are blocked the moment the picker closes.
    private(set) var shieldWanted = false
    
    private init() {
        loadSelection()
    }
    
    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            print("Screen Time Authorization Granted")
        } catch {
            print("Screen Time Authorization Failed: \(error)")
        }
    }
    
    func setShieldEnabled(_ enabled: Bool) {
        shieldWanted = enabled
        if enabled {
            // Reload saved selection to make sure we have latest
            loadSelection()
            
            // Apply shields to selected apps and categories
            store.shield.applications = activitySelection.applicationTokens
            store.shield.applicationCategories = ShieldSettings.ActivityCategoryPolicy.specific(activitySelection.categoryTokens)
            store.shield.webDomainCategories = ShieldSettings.ActivityCategoryPolicy.specific(activitySelection.categoryTokens)
            print("Screen Time shields ENABLED for \(activitySelection.applicationTokens.count) apps")
        } else {
            // Clear all shields
            store.shield.applications = nil
            store.shield.applicationCategories = nil
            store.shield.webDomainCategories = nil
            print("Screen Time shields DISABLED")
        }
    }
    
    // MARK: Earn your scroll (ios/Gate/GateShared.swift)

    /// The app's view of today (lib/appGate.ts): saved for the block screen and
    /// the monitor, then applied. Keeps an hour already bought.
    func setGate(_ json: String) {
        guard let data = json.data(using: .utf8),
              var state = try? JSONDecoder().decode(Gate.State.self, from: data) else { return }
        if let saved = Gate.load() { state.unlockedUntil = max(state.unlockedUntil, saved.unlockedUntil) }
        Gate.save(state)
        Gate.apply()
        // Midnight: a new day starts blocked again, even if Habyss is never opened.
        let center = DeviceActivityCenter()
        let daily = DeviceActivityName(Gate.dailyActivity)
        if state.on {
            if !center.activities.contains(daily) {
                let schedule = DeviceActivitySchedule(intervalStart: DateComponents(hour: 0, minute: 0),
                                                      intervalEnd: DateComponents(hour: 23, minute: 59), repeats: true)
                try? center.startMonitoring(daily, during: schedule)
            }
        } else {
            center.stopMonitoring([daily, DeviceActivityName(Gate.unlockActivity)])
        }
    }

    /// Bought with Shards (already spent on the server): open for `minutes`, then
    /// the monitor puts the block back, whether or not Habyss is open.
    func unlockGate(minutes: Int) -> Double {
        let until = Date().addingTimeInterval(TimeInterval(minutes * 60))
        guard Gate.load() != nil else { return 0 }
        Gate.openUntil(until)
        return until.timeIntervalSince1970
    }

    /// Echo's lines for each scrolling threshold, written by the app (lib/echoScroll.ts), and the
    /// daily watch over the chosen apps that makes the monitor extension say them.
    func setScrollLines(_ json: String) {
        guard let data = json.data(using: .utf8),
              let lines = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return }
        UserDefaults(suiteName: Gate.groupId)?.set(lines, forKey: Gate.scrollLinesKey)
        // Only the words change: the watch keeps running. Restarting it replays every
        // threshold already passed today. It starts with the chosen apps (saveSelection).
    }

    /// Watches the chosen apps all day, every day: an event at each threshold. Restarted when the
    /// apps change, so the events always cover what was chosen.
    func watchScrolling() {
        loadSelection()
        let center = DeviceActivityCenter()
        let name = DeviceActivityName(Gate.scrollActivity)
        let chosen = activitySelection
        guard !(chosen.applicationTokens.isEmpty && chosen.categoryTokens.isEmpty && chosen.webDomainTokens.isEmpty) else {
            center.stopMonitoring([name])
            return
        }
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        for minutes in Gate.scrollThresholds {
            events[DeviceActivityEvent.Name("scroll.\(minutes)")] = DeviceActivityEvent(
                applications: chosen.applicationTokens, categories: chosen.categoryTokens, webDomains: chosen.webDomainTokens,
                threshold: DateComponents(minute: minutes))
        }
        let schedule = DeviceActivitySchedule(intervalStart: DateComponents(hour: 0, minute: 0),
                                              intervalEnd: DateComponents(hour: 23, minute: 59), repeats: true)
        center.stopMonitoring([name])
        Gate.markScrollWatchStarted()
        try? center.startMonitoring(name, during: schedule, events: events)
    }

    func saveSelection() {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        if let data = try? JSONEncoder().encode(activitySelection) {
            defaults.set(data, forKey: "ScreenTimeSelection")
            print("Screen Time selection saved (\(activitySelection.applicationTokens.count) apps)")
        }
        if shieldWanted { setShieldEnabled(true) }
        Gate.apply()
        watchScrolling()
    }
    
    func loadSelection() {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        if let data = defaults.data(forKey: "ScreenTimeSelection"),
           let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
            self.activitySelection = selection
            print("Screen Time selection loaded (\(selection.applicationTokens.count) apps)")
        }
    }
}

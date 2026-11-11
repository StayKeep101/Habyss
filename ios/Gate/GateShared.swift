import Foundation
import DeviceActivity
import FamilyControls
import ManagedSettings

/// "Earn your scroll": the apps you chose stay blocked until today's top 3 are
/// done, or for an hour bought with 100 Shards. One copy of the rule, compiled
/// into the app and into its three Screen Time extensions (the block screen,
/// its buttons, and the monitor that puts the block back), so they always agree.
///
/// The app writes `GateState` (lib/appGate.ts → ScreenTimeModule.setGate) into
/// the shared App Group; everything here only reads it.
@available(iOS 16.0, *)
enum Gate {
    static let groupId = "group.com.habyss.data"
    static let stateKey = "HabyssGate"
    static let selectionKey = "ScreenTimeSelection"
    /// Its own store, apart from Focus's: either one blocking is enough, and
    /// lifting one never lifts the other.
    static let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("habyss.gate"))
    static let dailyActivity = "habyss.gate.daily"
    static let unlockActivity = "habyss.gate.unlock"

    struct State: Codable {
        /// The gate is switched on (Settings).
        var on: Bool
        /// The day this state is about ("2026-11-08").
        var day: String
        /// Today's top 3 are done: open until midnight.
        var earned: Bool
        /// Today's top 3 still to do, by title.
        var remaining: [String]
        /// How many things are planned today (none: "plan your day first").
        var planned: Int
        /// Bought with Shards: open until this moment (seconds since 1970).
        var unlockedUntil: Double
        /// What the block screen says, in Echo's voice (lib/appGate.ts shieldWords).
        var title: String?
        var lines: [String]?
        /// Said once on the block screen after a tap that could not buy ("Not enough Shards…").
        var notice: String?
    }

    static func today(_ date: Date = Date()) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func load() -> State? {
        guard let data = UserDefaults(suiteName: groupId)?.data(forKey: stateKey) else { return nil }
        return try? JSONDecoder().decode(State.self, from: data)
    }

    static func save(_ state: State) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults(suiteName: groupId)?.set(data, forKey: stateKey)
    }

    static func selection() -> FamilyActivitySelection? {
        guard let data = UserDefaults(suiteName: groupId)?.data(forKey: selectionKey) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    /// Open right now: earned today, or within an hour bought with Shards.
    static func isOpen(_ state: State, now: Date = Date()) -> Bool {
        (state.earned && state.day == today(now)) || now.timeIntervalSince1970 < state.unlockedUntil
    }

    /// Puts the block up or takes it down, from the saved state. `now` lets the
    /// monitor look a moment ahead when an hour ends, so it never lands a hair early.
    static func apply(now: Date = Date()) {
        guard let state = load(), state.on, let chosen = selection(), !isOpen(state, now: now) else {
            clear()
            return
        }
        store.shield.applications = chosen.applicationTokens.isEmpty ? nil : chosen.applicationTokens
        store.shield.applicationCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
        store.shield.webDomains = chosen.webDomainTokens.isEmpty ? nil : chosen.webDomainTokens
        store.shield.webDomainCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
    }

    // MARK: An hour for Shards

    static let price = 100
    static let walletKey = "HabyssWallet"
    static let pendingKey = "HabyssPendingUnlocks"

    /// What the server last said you can spend (the app keeps it current, lib/appGate.ts).
    static func spendable() -> Int? {
        UserDefaults(suiteName: groupId)?.object(forKey: walletKey) as? Int
    }

    static func setSpendable(_ value: Int) {
        UserDefaults(suiteName: groupId)?.set(value, forKey: walletKey)
    }

    /// Bought here and not yet charged on the server; the app charges them when it next runs.
    static func pendingUnlocks() -> [Double] {
        UserDefaults(suiteName: groupId)?.array(forKey: pendingKey) as? [Double] ?? []
    }

    static func takePendingUnlocks() -> [Double] {
        let pending = pendingUnlocks()
        UserDefaults(suiteName: groupId)?.removeObject(forKey: pendingKey)
        return pending
    }

    /// Opens the chosen apps until `until`, and has Screen Time lock them again then,
    /// whether or not Habyss is running.
    static func openUntil(_ until: Date) {
        guard var state = load() else { return }
        state.unlockedUntil = until.timeIntervalSince1970
        state.notice = nil
        save(state)
        apply()
        let calendar = Calendar.current
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents([.hour, .minute, .second], from: Date()),
            intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: until),
            repeats: false)
        let center = DeviceActivityCenter()
        let name = DeviceActivityName(unlockActivity)
        center.stopMonitoring([name])
        try? center.startMonitoring(name, during: schedule)
    }

    /// The block screen's "1 hour · 100 Shards": opens the apps for an hour when the
    /// balance allows (charged on the server when Habyss next runs), or says why not.
    /// Returns when the apps lock again, or nil when it could not buy.
    static func buyHourHere() -> Date? {
        guard var state = load() else { return nil }
        let balance = spendable() ?? 0
        guard balance >= price else {
            state.notice = spendable() == nil
                ? "Open Habyss once so it knows your Shards."
                : "Not enough Shards: you have \(balance), an hour is \(price)."
            save(state)
            return nil
        }
        setSpendable(balance - price)
        UserDefaults(suiteName: groupId)?.set(pendingUnlocks() + [Date().timeIntervalSince1970], forKey: pendingKey)
        let until = Date().addingTimeInterval(60 * 60)
        openUntil(until)
        return until
    }

    // MARK: Scrolling (Echo notices time in the chosen apps)

    static let scrollActivity = "habyss.scroll.daily"
    /** Minutes in the chosen apps at which Echo speaks up. */
    static let scrollThresholds = [15, 30, 45, 60, 90, 120]
    static let scrolledKey = "HabyssScrolled"
    static let scrollLinesKey = "HabyssScrollLines"

    /// Minutes in the chosen apps today, as far as Screen Time has said.
    static func scrolledToday() -> Int {
        guard let saved = UserDefaults(suiteName: groupId)?.dictionary(forKey: scrolledKey),
              saved["day"] as? String == today() else { return 0 }
        return saved["minutes"] as? Int ?? 0
    }

    static func saveScrolled(_ minutes: Int) {
        UserDefaults(suiteName: groupId)?.set(["day": today(), "minutes": max(minutes, scrolledToday())], forKey: scrolledKey)
    }

    static func resetScrolled() {
        UserDefaults(suiteName: groupId)?.set(["day": today(), "minutes": 0], forKey: scrolledKey)
    }

    /// What Echo says at a threshold, written by the app in the chosen voice (lib/echoScroll.ts).
    static func scrollLine(for minutes: Int) -> (title: String, body: String) {
        let lines = UserDefaults(suiteName: groupId)?.dictionary(forKey: scrollLinesKey) as? [String: String]
        let body = lines?[String(minutes)] ?? "\(minutes) minutes of scrolling today. That's \(minutes) minutes not spent on your plan."
        return (lines?["title"] ?? "Echo", body)
    }

    static func clear() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.shield.webDomainCategories = nil
    }
}

/// Bedtime lock: from bedtime to wake, the apps you chose are blocked, whatever the
/// gate says (earned, or an hour bought). Its own store, so nothing that opens the
/// gate opens the night. The app writes `Night.Settings` (lib/bedtimeLock.ts →
/// ScreenTimeModule.setNight); the monitor puts the block up at bedtime and takes it
/// down at wake, whether or not Habyss is running.
@available(iOS 16.0, *)
enum Night {
    static let key = "HabyssNight"
    static let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("habyss.night"))
    /// Bedtime to midnight, and midnight to wake (an interval never crosses midnight).
    static let eveningActivity = "habyss.night.evening"
    static let morningActivity = "habyss.night.morning"

    struct Settings: Codable {
        var on: Bool
        /// Minutes from midnight.
        var sleep: Int
        var wake: Int
    }

    static func load() -> Settings? {
        guard let data = UserDefaults(suiteName: Gate.groupId)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Settings.self, from: data)
    }

    static func save(_ settings: Settings) {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        UserDefaults(suiteName: Gate.groupId)?.set(data, forKey: key)
    }

    /// The same rule as lib/bedtimeLock.ts isNight.
    static func isNight(_ settings: Settings, now: Date = Date()) -> Bool {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: now)
        let minute = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
        if settings.sleep == settings.wake { return false }
        return settings.sleep > settings.wake
            ? (minute >= settings.sleep || minute < settings.wake)
            : (minute >= settings.sleep && minute < settings.wake)
    }

    /// Blocking right now.
    static func active(now: Date = Date()) -> Bool {
        guard let settings = load(), settings.on else { return false }
        return isNight(settings, now: now)
    }

    static func wakeText() -> String {
        guard let settings = load() else { return "morning" }
        var parts = DateComponents()
        parts.hour = settings.wake / 60
        parts.minute = settings.wake % 60
        guard let date = Calendar.current.date(from: parts) else { return "morning" }
        let clock = DateFormatter()
        clock.timeStyle = .short
        return clock.string(from: date)
    }

    static func apply(now: Date = Date()) {
        guard active(now: now), let chosen = Gate.selection() else { clear(); return }
        store.shield.applications = chosen.applicationTokens.isEmpty ? nil : chosen.applicationTokens
        store.shield.applicationCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
        store.shield.webDomains = chosen.webDomainTokens.isEmpty ? nil : chosen.webDomainTokens
        store.shield.webDomainCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
    }

    static func clear() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.shield.webDomainCategories = nil
    }

    /// Saves the settings, applies them now, and has Screen Time keep them every night.
    static func set(_ settings: Settings) {
        save(settings)
        apply()
        let center = DeviceActivityCenter()
        let evening = DeviceActivityName(eveningActivity)
        let morning = DeviceActivityName(morningActivity)
        center.stopMonitoring([evening, morning])
        guard settings.on, settings.sleep != settings.wake else { return }
        let at = { (minute: Int) in DateComponents(hour: minute / 60, minute: minute % 60) }
        if settings.sleep > settings.wake {
            // 23:00 → 07:00: tonight until midnight, then midnight until wake.
            try? center.startMonitoring(evening, during: DeviceActivitySchedule(
                intervalStart: at(settings.sleep), intervalEnd: DateComponents(hour: 23, minute: 59, second: 59), repeats: true))
            try? center.startMonitoring(morning, during: DeviceActivitySchedule(
                intervalStart: DateComponents(hour: 0, minute: 0), intervalEnd: at(settings.wake), repeats: true))
        } else {
            // Bedtime after midnight (01:00 → 08:00): one interval.
            try? center.startMonitoring(morning, during: DeviceActivitySchedule(
                intervalStart: at(settings.sleep), intervalEnd: at(settings.wake), repeats: true))
        }
    }
}

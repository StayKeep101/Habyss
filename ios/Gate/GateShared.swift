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
        /// The block screen's two buttons, so their words ship with an update (lib/appGate.ts shieldWords).
        var primary: String?
        var secondary: String?
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
        guard let state = load(), state.on, !isOpen(state, now: now) else {
            clear()
            return
        }
        // Blocked by default, before anything is chosen: iOS only lets a person pick
        // apps, but sites can be named, so the scrolling ones are closed in every browser.
        store.webContent.blockedByFilter = .specific(scrollSites)
        guard let chosen = selection() else {
            clearApps()
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

    static let scrollStartedKey = "HabyssScrollWatchStarted"

    /// When the watch was (re)started: iOS replays every threshold already passed today
    /// right after, and those are old news, not new scrolling.
    static func markScrollWatchStarted() {
        UserDefaults(suiteName: groupId)?.set(Date().timeIntervalSince1970, forKey: scrollStartedKey)
    }

    /// Say this threshold out loud? Not when it was already said today, nor when it is
    /// iOS catching up in the minute after a restart (then it is only recorded).
    static func shouldAnnounce(_ minutes: Int, now: Date = Date()) -> Bool {
        if minutes <= scrolledToday() { return false }
        let started = UserDefaults(suiteName: groupId)?.double(forKey: scrollStartedKey) ?? 0
        return now.timeIntervalSince1970 - started > 60
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

    /// YouTube and the scrolling social sites, closed whenever the gate is (and their subdomains, m. and www.).
    static let scrollSites: Set<WebDomain> = Set([
        "youtube.com", "tiktok.com", "instagram.com", "facebook.com", "x.com", "twitter.com",
        "reddit.com", "snapchat.com", "threads.net", "pinterest.com", "twitch.tv",
    ].map { WebDomain(domain: $0) })

    static func clear() {
        clearApps()
        store.webContent.blockedByFilter = nil
    }

    private static func clearApps() {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        store.shield.webDomainCategories = nil
    }
}

/// Bedtime lock: from bedtime to wake, every app is blocked, whatever the
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

    /// At night every app is blocked, not only the chosen ones. iOS never blocks
    /// calls and Emergency SOS, so what matters in an emergency still works.
    static func apply(now: Date = Date()) {
        guard active(now: now) else { clear(); return }
        store.shield.applications = nil
        store.shield.applicationCategories = .all()
        store.shield.webDomains = nil
        store.shield.webDomainCategories = .all()
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

// MARK: - App time: habits that tick themselves from time in chosen apps

/// "Read 20 min" ticks itself after 20 minutes in Kindle or Books; "Under an hour
/// of social" is kept when the day ends under it, and lost the moment it goes over.
/// The app writes the habits (lib/appTime.ts → ScreenTimeModule.setAppTimeHabits);
/// each one is a daily watch over its own chosen apps, and the monitor extension
/// records what happened and says it, whether or not Habyss is open. The app
/// turns the records into ticks when it next runs.
@available(iOS 16.0, *)
enum AppTime {
    static let prefix = "habyss.apptime."
    static let habitsKey = "HabyssAppTimeHabits"
    static let resultsKey = "HabyssAppTimeResults"
    static let startedKey = "HabyssAppTimeStarted"
    /// iOS allows about 20 watched activities in all; the gate, scrolling and the night use a few.
    static let most = 12

    struct Habit: Codable {
        let id: String
        let name: String
        let minutes: Int
        /// A habit being broken: kept under the time, lost over it.
        let quit: Bool
    }

    static func selectionKey(_ id: String) -> String { "HabyssAppTimeSelection.\(id)" }

    static func selection(_ id: String) -> FamilyActivitySelection? {
        guard let data = UserDefaults(suiteName: Gate.groupId)?.data(forKey: selectionKey(id)) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func saveSelection(_ selection: FamilyActivitySelection, for id: String) {
        guard let data = try? JSONEncoder().encode(selection) else { return }
        UserDefaults(suiteName: Gate.groupId)?.set(data, forKey: selectionKey(id))
    }

    static func chosenCount(_ id: String) -> Int {
        guard let s = selection(id) else { return 0 }
        return s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count
    }

    static func habits() -> [Habit] {
        guard let data = UserDefaults(suiteName: Gate.groupId)?.data(forKey: habitsKey) else { return [] }
        return (try? JSONDecoder().decode([Habit].self, from: data)) ?? []
    }

    static func habit(for activity: DeviceActivityName) -> Habit? {
        guard activity.rawValue.hasPrefix(prefix) else { return nil }
        let id = String(activity.rawValue.dropFirst(prefix.count))
        return habits().first { $0.id == id }
    }

    /// "id|day|done", "id|day|kept" or "id|day|over", once per habit per day. True when new.
    @discardableResult
    static func record(_ id: String, _ outcome: String, day: String = Gate.today()) -> Bool {
        let defaults = UserDefaults(suiteName: Gate.groupId)
        var results = defaults?.stringArray(forKey: resultsKey) ?? []
        let head = "\(id)|\(day)|"
        if results.contains(where: { $0.hasPrefix(head) }) { return false }
        results.append(head + outcome)
        // Only the last few weeks matter; the app takes them as it runs.
        defaults?.set(Array(results.suffix(400)), forKey: resultsKey)
        return true
    }

    static func recorded(_ id: String, day: String = Gate.today()) -> String? {
        let head = "\(id)|\(day)|"
        return (UserDefaults(suiteName: Gate.groupId)?.stringArray(forKey: resultsKey) ?? [])
            .first { $0.hasPrefix(head) }.map { String($0.dropFirst(head.count)) }
    }

    /// What happened since the app last looked; each is handed over once.
    static func takeResults() -> [String] {
        let defaults = UserDefaults(suiteName: Gate.groupId)
        let results = defaults?.stringArray(forKey: resultsKey) ?? []
        let handed = Set(defaults?.stringArray(forKey: resultsKey + ".handed") ?? [])
        let fresh = results.filter { !handed.contains($0) }
        defaults?.set(Array(results.suffix(400)), forKey: resultsKey + ".handed")
        return fresh
    }

    /// Saves the habits and (re)starts a daily watch over each one's apps.
    static func watch(_ list: [Habit]) {
        let kept = Array(list.filter { $0.minutes > 0 && chosenCount($0.id) > 0 }.prefix(most))
        if let data = try? JSONEncoder().encode(kept) { UserDefaults(suiteName: Gate.groupId)?.set(data, forKey: habitsKey) }
        let center = DeviceActivityCenter()
        let wanted = Set(kept.map { prefix + $0.id })
        let running = center.activities.filter { $0.rawValue.hasPrefix(prefix) }
        center.stopMonitoring(running.filter { !wanted.contains($0.rawValue) })
        let schedule = DeviceActivitySchedule(intervalStart: DateComponents(hour: 0, minute: 0),
                                              intervalEnd: DateComponents(hour: 23, minute: 59), repeats: true)
        UserDefaults(suiteName: Gate.groupId)?.set(Date().timeIntervalSince1970, forKey: startedKey)
        for habit in kept {
            guard let chosen = selection(habit.id) else { continue }
            let name = DeviceActivityName(prefix + habit.id)
            let event = DeviceActivityEvent(applications: chosen.applicationTokens, categories: chosen.categoryTokens,
                                            webDomains: chosen.webDomainTokens, threshold: DateComponents(minute: habit.minutes))
            center.stopMonitoring([name])
            try? center.startMonitoring(name, during: schedule, events: [DeviceActivityEvent.Name("reached"): event])
        }
    }

    /// The monitor: the time was reached today.
    static func reached(_ activity: DeviceActivityName) -> (title: String, body: String)? {
        guard let habit = habit(for: activity) else { return nil }
        guard record(habit.id, habit.quit ? "over" : "done") else { return nil }
        // iOS replays thresholds already passed right after a restart: recorded, not said again.
        let started = UserDefaults(suiteName: Gate.groupId)?.double(forKey: startedKey) ?? 0
        if Date().timeIntervalSince1970 - started < 60 { return nil }
        return habit.quit
            ? ("\(habit.name): gone for today.", "Over \(habit.minutes) min. Put it down. Tomorrow's a clean slate.")
            : ("\(habit.name): done.", "\(habit.minutes) min in your apps. Not a single tap.")
    }

    /// The monitor: the day ended. A habit being broken that never went over is kept.
    static func dayEnded(_ activity: DeviceActivityName, now: Date = Date()) {
        guard let habit = habit(for: activity), habit.quit else { return }
        // Only the real end of the day: a restart can end an interval early.
        guard Calendar.current.component(.hour, from: now) >= 23 else { return }
        if recorded(habit.id) == nil { record(habit.id, "kept") }
    }
}

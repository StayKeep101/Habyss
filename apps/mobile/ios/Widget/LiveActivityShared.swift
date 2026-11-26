//
//  LiveActivityShared.swift
//  In both the app and the widget extension: the Live Activity's attributes,
//  and its Done button, which iOS runs in the app's process.
//

import ActivityKit
import AppIntents
import Foundation

// Must stay identical to WidgetAttributes in modules/habyss-live-activity/ios/HabyssLiveActivityModule.swift.
// ActivityKit pairs an activity with the widget declaring an attributes type of the same name.
struct WidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
        var timerEndDateInMilliseconds: Double?
        var progress: Double
        var profileImagePath: String?
        var scheduledStartDateInMilliseconds: Double?
        var scheduledEndDateInMilliseconds: Double?
        var url: String?
        var accentHex: String?
        /// The habit or task on the card ("habit:<id>", "task:<id>"), for its Done button.
        var itemId: String?
        /// What comes after it on the timeline: shown once this one's time is up.
        var nextTitle: String?
        var nextStartMs: Double?
        var nextEndMs: Double?
        var nextItemId: String?
        var nextUrl: String?
        /// What follows the next, as JSON [{t,s,e,i,u}] (title, start ms, end ms, item id, url): Done moves through them.
        var later: String?

        /// What the card is on now: itself, or once its time is up, what comes next.
        func current(stale: Bool) -> ContentState {
            guard stale, let next = nextTitle else { return self }
            return ContentState(title: next, subtitle: "", timerEndDateInMilliseconds: nil, progress: 0,
                profileImagePath: nil, scheduledStartDateInMilliseconds: nextStartMs, scheduledEndDateInMilliseconds: nextEndMs,
                url: nextUrl ?? url, accentHex: accentHex, itemId: nextItemId, later: later)
        }
    }

    var name: String
    var totalDurationSeconds: Double?
}

/**
 * Done, on the Lock Screen card and the Dynamic Island.
 *
 * Records the tick the way the Home Screen widget does (a small file the app
 * applies when it next runs, with the minute it was made, so how long it took
 * is kept), then moves the card straight on to what comes next on the
 * timeline, or closes it when nothing does. A LiveActivityIntent, so iOS runs
 * it in the app's process, which is the only place a card can be updated
 * without the app on screen.
 */
@available(iOS 17.0, *)
struct CompleteNowIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Done"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Item")
    var itemId: String

    @Parameter(title: "Card")
    var activityName: String

    init() {}

    init(itemId: String, activityName: String) {
        self.itemId = itemId
        self.activityName = activityName
    }

    func perform() async throws -> some IntentResult {
        struct Event: Codable { let eventId: String; let id: String; let day: String; let done: Bool; let timestamp: Double }
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        let day = String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
        let event = Event(eventId: UUID().uuidString, id: itemId, day: day, done: true, timestamp: Date().timeIntervalSince1970 * 1000)
        if let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.habyss.data") {
            let inbox = container.appendingPathComponent("widget-events", isDirectory: true)
            try? FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
            if let data = try? JSONEncoder().encode(event) {
                try? data.write(to: inbox.appendingPathComponent(event.eventId + ".json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            }
        }
        guard let activity = Activity<WidgetAttributes>.activities.first(where: { $0.attributes.name == activityName }) else { return .result() }
        let state = activity.content.state
        // The day as the card knows it: what it shows, what is next, and what follows (`later`).
        // The one ticked comes off; the card moves to the first left, with the rest behind it.
        struct Upcoming: Codable { let t: String; let s: Double?; let e: Double?; let i: String?; let u: String? }
        var line: [Upcoming] = [Upcoming(t: state.title, s: state.scheduledStartDateInMilliseconds, e: state.scheduledEndDateInMilliseconds, i: state.itemId, u: state.url)]
        if let next = state.nextTitle { line.append(Upcoming(t: next, s: state.nextStartMs, e: state.nextEndMs, i: state.nextItemId, u: state.nextUrl)) }
        if let raw = state.later, let data = raw.data(using: .utf8), let rest = try? JSONDecoder().decode([Upcoming].self, from: data) { line.append(contentsOf: rest) }
        // Ticked: it and anything before it on the line (its time had come) are behind.
        if let at = line.firstIndex(where: { $0.i == itemId }) { line.removeFirst(at + 1) } else if !line.isEmpty { line.removeFirst() }
        guard let first = line.first else { await activity.end(nil, dismissalPolicy: .immediate); return .result() }
        let second = line.count > 1 ? line[1] : nil
        let rest = Array(line.dropFirst(2))
        let restJson = rest.isEmpty ? nil : (try? JSONEncoder().encode(rest)).flatMap { String(data: $0, encoding: .utf8) }
        let moved = WidgetAttributes.ContentState(title: first.t, subtitle: "", timerEndDateInMilliseconds: nil, progress: 0, profileImagePath: nil,
            scheduledStartDateInMilliseconds: first.s, scheduledEndDateInMilliseconds: first.e, url: first.u ?? state.url, accentHex: state.accentHex,
            itemId: first.i, nextTitle: second?.t, nextStartMs: second?.s, nextEndMs: second?.e, nextItemId: second?.i, nextUrl: second?.u, later: restJson)
        let ends = first.e.map { Date(timeIntervalSince1970: $0 / 1000) }
        await activity.update(ActivityContent(state: moved, staleDate: ends))
        return .result()
    }
}

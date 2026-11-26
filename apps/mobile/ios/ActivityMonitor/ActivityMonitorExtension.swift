import DeviceActivity
import Foundation
import UserNotifications

/// Runs when Habyss is closed:
/// - at bedtime and at wake (the Bedtime lock, Night in GateShared.swift);
/// - at midnight (a new day starts blocked again, and its scrolling count starts at zero);
/// - when an hour bought with Shards ends (the block comes back);
/// - when a habit timed in its apps reaches its minutes, or a day of one ends (AppTime);
/// - when the chosen apps reach 15, 30, 45, 60, 90 or 120 minutes today: Echo says so,
///   in the line the app wrote for that moment (lib/echoScroll.ts), and the count is kept
///   so Echo knows it in the app too.
@available(iOS 16.0, *)
final class ActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        if activity.rawValue.hasPrefix(AppTime.prefix) { return }
        // A start of the day (NowGuide): said under one name, replacing the last one, then the next booked.
        if activity == NowGuide.activity {
            if let request = NowGuide.fire() { UNUserNotificationCenter.current().add(request) }
            return
        }
        if activity.rawValue == Gate.scrollActivity { Gate.resetScrolled(); return }
        // Bedtime: the night's block goes up (and stays through midnight).
        if activity.rawValue.hasPrefix("habyss.night") { Night.apply(); return }
        Gate.apply()
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity.rawValue.hasPrefix(AppTime.prefix) { AppTime.dayEnded(activity); return }
        if activity == NowGuide.activity { return }
        if activity.rawValue == Gate.scrollActivity { return }
        // Wake: a moment ahead, so the night never lifts a hair early, nor lingers.
        if activity.rawValue.hasPrefix("habyss.night") { Night.apply(now: Date().addingTimeInterval(5)); return }
        // A moment ahead, so the hour's last second never keeps it open.
        Gate.apply(now: Date().addingTimeInterval(5))
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        // A habit timed in its apps (AppTime): ticked, or lost, and said.
        if activity.rawValue.hasPrefix(AppTime.prefix) {
            // A step on the way: noted for the habit's page, nothing said.
            if event.rawValue.hasPrefix("p."), let minutes = Int(event.rawValue.dropFirst(2)) {
                AppTime.progress(activity, minutes: minutes)
                // Five minutes in: said once a day, so you know it is being counted.
                guard let line = AppTime.started(activity, minutes: minutes) else { return }
                let content = UNMutableNotificationContent()
                content.title = line.title
                content.body = line.body
                content.sound = .default
                content.userInfo = ["body": ["type": "app_time", "url": "/(root)/(tabs)/roadmap"], "type": "app_time"]
                UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "habyss.apptime.start.\(activity.rawValue)", content: content, trigger: nil))
                return
            }
            guard let line = AppTime.reached(activity) else { return }
            let content = UNMutableNotificationContent()
            content.title = line.title
            content.body = line.body
            content.sound = .default
            content.userInfo = ["body": ["type": "app_time", "url": "/(root)/(tabs)/roadmap"], "type": "app_time"]
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "habyss.apptime.\(activity.rawValue)", content: content, trigger: nil))
            return
        }
        guard activity.rawValue == Gate.scrollActivity,
              let minutes = Int(event.rawValue.replacingOccurrences(of: "scroll.", with: "")) else { return }
        let announce = Gate.shouldAnnounce(minutes)
        Gate.saveScrolled(minutes)
        guard announce else { return }
        let line = Gate.scrollLine(for: minutes)
        let content = UNMutableNotificationContent()
        content.title = line.title
        content.body = line.body
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        content.userInfo = ["body": ["type": "echo_scroll", "url": "/(root)/(tabs)/roadmap"], "type": "echo_scroll"]
        let request = UNNotificationRequest(identifier: "habyss.scroll.\(minutes)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}

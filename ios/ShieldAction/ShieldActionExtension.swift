import ManagedSettings
import UserNotifications

/// The block screen's two buttons.
/// - "1 hour · 100 Shards": bought right here when the balance allows. The apps open at
///   once and Screen Time locks them again in an hour (ios/Gate/GateShared.swift
///   buyHourHere); the Shards are charged on the server when Habyss next runs. Short of
///   Shards, the screen says so and stays.
/// - "Not now": closes the app.
@available(iOS 16.0, *)
final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    private func respond(to action: ShieldAction, _ completionHandler: @escaping (ShieldActionResponse) -> Void) {
        // At bedtime there is nothing to buy: every button closes the app.
        guard action == .primaryButtonPressed, !Night.active() else { completionHandler(.close); return }
        guard let until = Gate.buyHourHere() else {
            // Not enough: the screen is drawn again, now saying why.
            completionHandler(.defer)
            return
        }
        let clock = DateFormatter()
        clock.timeStyle = .short
        let content = UNMutableNotificationContent()
        content.title = "Your apps are open"
        content.body = "Until \(clock.string(from: until)). Then they lock again. 100 Shards spent."
        content.userInfo = ["body": ["type": "gate_open", "url": "/(root)/unlock"], "type": "gate_open"]
        let request = UNNotificationRequest(identifier: "habyss.gate.open", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { _ in
            // The block is gone: carry on into the app.
            completionHandler(.defer)
        }
    }
}

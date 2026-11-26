import Foundation
import React

@objc(WatchModule)
class WatchModule: RCTEventEmitter {
    
    private var hasListeners = false

    override init() {
        super.init()
        WatchSessionManager.shared.activateSession()
        // What the watch sends (a habit ticked, a request for data) reaches JS.
        NotificationCenter.default.addObserver(self, selector: #selector(forward(_:)),
                                               name: NSNotification.Name("WatchMessageReceived"), object: nil)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    @objc private func forward(_ notification: Notification) {
        guard hasListeners, let message = notification.object as? [String: Any] else { return }
        sendEvent(withName: "onWatchMessage", body: message)
    }
    
    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onWatchMessage"]
    }
    
    @objc(updateContext:)
    func updateContext(context: [String: Any]) {
        WatchSessionManager.shared.updateContext(context: context)
    }
    
    @objc(sendMessage:resolver:rejecter:)
    func sendMessage(message: [String: Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        WatchSessionManager.shared.sendMessage(message: message, replyHandler: { reply in
            resolve(reply)
        }, errorHandler: { error in
            reject("SEND_ERROR", error.localizedDescription, error)
        })
    }
}

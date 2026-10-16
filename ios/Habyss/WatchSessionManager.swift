import Foundation
import WatchConnectivity

@objc
class WatchSessionManager: NSObject, WCSessionDelegate {
    
    static let shared = WatchSessionManager()
    
    private override init() {
        super.init()
    }
    
    @objc
    func activateSession() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if let error = error {
            print("WCSession activation failed with error: \(error.localizedDescription)")
            return
        }
        print("WCSession activated with state: \(activationState.rawValue)")
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        // Code to handle the session becoming inactive
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        // Code to handle the session deactivating
        session.activate()
    }
    
    // MARK: - Sending Data
    
    /// The last snapshot sent, so a watch that asks (or wakes up) gets it at once.
    private(set) var lastContext: [String: Any] = [:]

    func updateContext(context: [String: Any]) {
        lastContext = context
        guard WCSession.default.activationState == .activated else { return }

        do {
            try WCSession.default.updateApplicationContext(context)
        } catch {
            print("Error updating application context: \(error.localizedDescription)")
        }
    }
    
    func sendMessage(message: [String: Any], replyHandler: (([String: Any]) -> Void)? = nil, errorHandler: ((Error) -> Void)? = nil) {
        guard WCSession.default.isReachable else {
            errorHandler?(NSError(domain: "WatchSessionManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "Watch is not reachable"]))
            return
        }
        
        WCSession.default.sendMessage(message, replyHandler: replyHandler, errorHandler: errorHandler)
    }
    
    // A watch asking for the latest snapshot gets it in the reply.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        replyHandler(lastContext)
        self.session(session, didReceiveMessage: message)
    }

    // Messages the watch queued while out of reach arrive this way.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        self.session(session, didReceiveMessage: userInfo)
    }

    // Listen for Focus events from Watch
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if let type = message["type"] as? String {
            if type == "focus_start" || type == "focus_resume" {
                DispatchQueue.main.async {
                    if #available(iOS 16.0, *) {
                        ScreenTimeManager.shared.setShieldEnabled(true)
                    }
                }
            } else if type == "focus_pause" || type == "focus_end" || type == "focus_complete" {
                DispatchQueue.main.async {
                    if #available(iOS 16.0, *) {
                        ScreenTimeManager.shared.setShieldEnabled(false)
                    }
                }
            }
        }
        
        // Forward to React Native
        NotificationCenter.default.post(name: NSNotification.Name("WatchMessageReceived"), object: message)
    }

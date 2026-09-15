import Foundation
import React

@objc(WatchModule)
class WatchModule: RCTEventEmitter {
    
    override init() {
        super.init()
        WatchSessionManager.shared.activateSession()
    }
    
    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onWatchMessage"] // Example event
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

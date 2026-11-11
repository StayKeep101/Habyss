import Foundation
import React
import SwiftUI
import FamilyControls
import ManagedSettings

@objc(ScreenTimeModule)
class ScreenTimeModule: NSObject {
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                if #available(iOS 16.0, *) {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    resolve(true)
                } else {
                    reject("UNSUPPORTED", "Requires iOS 16+", nil)
                }
            } catch {
                reject("AUTH_FAILED", error.localizedDescription, error)
            }
        }
    }
    
    @objc func isAuthorized(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) {
            let status = AuthorizationCenter.shared.authorizationStatus
            resolve(status == .approved)
        } else {
            resolve(false)
        }
    }
    
    @objc func presentPicker() {
        if #available(iOS 16.0, *) {
            DispatchQueue.main.async {
                guard let rootViewController = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .flatMap({ $0.windows })
                    .first(where: { $0.isKeyWindow })?.rootViewController else { return }
                
                let picker = ScreenTimePickerView()
                let hostingController = UIHostingController(rootView: picker)
                rootViewController.present(hostingController, animated: true)
            }
        }
    }
    
    @objc func setShieldEnabled(_ enabled: Bool) {
        if #available(iOS 16.0, *) {
            ScreenTimeManager.shared.setShieldEnabled(enabled)
        }
    }
    
    /// Bedtime lock (lib/bedtimeLock.ts): {on, sleep, wake} in minutes from midnight.
    @objc func setNight(_ json: String) {
        if #available(iOS 16.0, *) {
            guard let data = json.data(using: .utf8),
                  let settings = try? JSONDecoder().decode(Night.Settings.self, from: data) else { return }
            Night.set(settings)
        }
    }

    @objc func setGate(_ json: String) {
        if #available(iOS 16.0, *) {
            ScreenTimeManager.shared.setGate(json)
        }
    }

    @objc func unlockGate(_ minutes: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) {
            resolve(ScreenTimeManager.shared.unlockGate(minutes: minutes.intValue))
        } else {
            reject("UNSUPPORTED", "Requires iOS 16+", nil)
        }
    }

    @objc func setScrollLines(_ json: String) {
        if #available(iOS 16.0, *) { ScreenTimeManager.shared.setScrollLines(json) }
    }

    @objc func scrolledToday(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(Gate.scrolledToday()) } else { resolve(0) }
    }

    @objc func setWallet(_ spendable: NSNumber) {
        if #available(iOS 16.0, *) { Gate.setSpendable(spendable.intValue) }
    }

    @objc func takePendingUnlocks(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(Gate.takePendingUnlocks()) } else { resolve([]) }
    }

    @objc func gateOpenUntil(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(Gate.load()?.unlockedUntil ?? 0) } else { resolve(0) }
    }

    @objc func hasSelectedApps(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) {
            // A whole category ("Social") counts as a choice, not only single apps.
            ScreenTimeManager.shared.loadSelection()
            let selection = ScreenTimeManager.shared.activitySelection
            resolve(selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count > 0)
        } else {
            resolve(false)
        }
    }
}

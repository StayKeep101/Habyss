import Foundation
import React
import SwiftUI
import FamilyControls
import ManagedSettings
import DeviceActivity

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
    
    /// The picker that keeps the block from loosening (lib/ScreenTimeService.ts pickApps):
    /// resolves "saved", "held" or "cancelled" once it closes.
    @objc func presentGuardedPicker(_ allowRemoval: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.0, *) else { reject("UNSUPPORTED", "Requires iOS 16+", nil); return }
        DispatchQueue.main.async {
            guard let root = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController else { resolve("cancelled"); return }
            var top = root
            while let shown = top.presentedViewController { top = shown }
            let picker = ScreenTimePickerView(allowRemoval: allowRemoval, onClose: { result in resolve(result) })
            top.present(UIHostingController(rootView: picker), animated: true)
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

    // MARK: App time (AppTime in GateShared.swift, lib/appTime.ts)

    /// The apps that count for one habit: resolves the number chosen, or -1 when closed without saving.
    @objc func pickAppTimeApps(_ habitId: String, title: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.0, *) else { reject("UNSUPPORTED", "Requires iOS 16+", nil); return }
        DispatchQueue.main.async {
            guard let root = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController else { resolve(-1); return }
            var top = root
            while let shown = top.presentedViewController { top = shown }
            let picker = AppTimePickerView(habitId: habitId, title: title, onClose: { count in resolve(count) })
            top.present(UIHostingController(rootView: picker), animated: true)
        }
    }

    /// Minutes in a habit's apps so far today (in steps of 5 or so; the full time once reached).
    @objc func appTimeProgress(_ habitId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(AppTime.progressToday(habitId)) } else { resolve(0) }
    }

    /// The day's starts, said by the monitor one at a time under one name (NowGuide).
    @objc func setNowPlan(_ json: String) {
        guard #available(iOS 16.0, *), let data = json.data(using: .utf8),
              let list = try? JSONDecoder().decode([NowGuide.Moment].self, from: data) else { return }
        NowGuide.setPlan(list)
    }

    @objc func appTimeChosen(_ habitId: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(AppTime.chosenCount(habitId)) } else { resolve(0) }
    }

    /// [{id, name, minutes, quit}]: saved, and each one's daily watch (re)started.
    @objc func setAppTimeHabits(_ json: String) {
        guard #available(iOS 16.0, *), let data = json.data(using: .utf8),
              let list = try? JSONDecoder().decode([AppTime.Habit].self, from: data) else { return }
        AppTime.watch(list)
    }

    @objc func takeAppTimeResults(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.0, *) { resolve(AppTime.takeResults()) } else { resolve([]) }
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

// MARK: - Screen time, drawn by the report extension (ios/ScreenTimeReport)


/// The Focus page's Screen time side (lib/screenTimeReport.tsx): `days` (7 or 30)
/// ending `offset` windows ago, drawn by the report extension; the app never sees the numbers.
@objc(ScreenTimeReportViewManager)
class ScreenTimeReportViewManager: RCTViewManager {
    override static func requiresMainQueueSetup() -> Bool { true }
    override func view() -> UIView! {
        if #available(iOS 16.0, *) { return ScreenTimeReportView() }
        return UIView()
    }
}

@available(iOS 16.0, *)
class ScreenTimeReportView: UIView {
    @objc var days: NSNumber = 7 { didSet { render() } }
    @objc var offset: NSNumber = 0 { didSet { render() } }
    /// The first day of the week (0 Sunday, 1 Monday), so a week matches the Focus side.
    @objc var weekStart: NSNumber = 1 { didSet { render() } }
    private var host: UIHostingController<AnyView>?

    override init(frame: CGRect) { super.init(frame: frame); backgroundColor = .clear; render() }
    required init?(coder: NSCoder) { super.init(coder: coder); render() }

    private func interval() -> DateInterval {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let count = max(1, days.intValue)
        var start: Date
        if count == 7 {
            // The calendar week, like the Focus side.
            let weekday = calendar.component(.weekday, from: today) - 1
            let back = (weekday - weekStart.intValue + 7) % 7
            start = calendar.date(byAdding: .day, value: -back - 7 * offset.intValue, to: today) ?? today
        } else {
            start = calendar.date(byAdding: .day, value: -(count - 1) - count * offset.intValue, to: today) ?? today
        }
        let end = min(calendar.date(byAdding: .day, value: count, to: start) ?? today, calendar.date(byAdding: .day, value: 1, to: today) ?? today)
        return DateInterval(start: start, end: end)
    }

    private func render() {
        let filter = DeviceActivityFilter(segment: .daily(during: interval()), users: .all, devices: .init([.iPhone]))
        let report = AnyView(DeviceActivityReport(DeviceActivityReport.Context("habyss.usage"), filter: filter).background(Color.clear))
        if let host {
            host.rootView = report
        } else {
            let made = UIHostingController(rootView: report)
            made.view.backgroundColor = .clear
            made.view.frame = bounds
            made.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            addSubview(made.view)
            host = made
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        host?.view.frame = bounds
    }
}

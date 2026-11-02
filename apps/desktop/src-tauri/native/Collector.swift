import AppKit
import ApplicationServices
import CoreGraphics
import WidgetKit

typealias Sink = @convention(c) (UnsafePointer<CChar>?) -> Void
private var collector: Collector?
private var lastWidgetReload: TimeInterval = 0
private final class Collector {
    let sink: Sink
    var timer: Timer?
    var tokens: [NSObjectProtocol] = []
    var sleeping = false
    var locked = false
    var displaySleeping = false
    var titles = false
    var ax: AXObserver?
    var observedPID: pid_t = 0
    var focusedWindow: AXUIElement?
    init(_ sink: @escaping Sink) {
        self.sink = sink
        let center = NSWorkspace.shared.notificationCenter
        for name in [NSWorkspace.didActivateApplicationNotification, NSWorkspace.willSleepNotification, NSWorkspace.didWakeNotification, NSWorkspace.screensDidSleepNotification, NSWorkspace.screensDidWakeNotification, NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.sessionDidBecomeActiveNotification] {
            tokens.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] note in
                guard let self else { return }
                switch note.name {
                case NSWorkspace.willSleepNotification: self.sleeping = true
                case NSWorkspace.didWakeNotification: self.sleeping = false
                case NSWorkspace.screensDidSleepNotification: self.displaySleeping = true
                case NSWorkspace.screensDidWakeNotification: self.displaySleeping = false
                case NSWorkspace.sessionDidResignActiveNotification: self.locked = true
                case NSWorkspace.sessionDidBecomeActiveNotification: self.locked = false
                default: break
                }
                self.sample()
            })
        }
        for name in ["com.apple.screenIsLocked", "com.apple.screenIsUnlocked"] {
            tokens.append(DistributedNotificationCenter.default().addObserver(forName: NSNotification.Name(name), object: nil, queue: .main) { [weak self] note in
                self?.locked = note.name.rawValue == "com.apple.screenIsLocked"; self?.sample()
            })
        }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.sample() }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
        sample()
    }
    func watch(_ pid: pid_t) {
        if observedPID == pid && ax != nil { return }
        if let ax { CFRunLoopRemoveSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(ax), .commonModes) }
        ax = nil; focusedWindow = nil; observedPID = pid
        guard titles, AXIsProcessTrusted() else { return }
        var observer: AXObserver?
        guard AXObserverCreate(pid, { _, _, _, _ in collector?.sample() }, &observer) == .success, let observer else { return }
        ax = observer
        let app = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(app, 0.05)
        AXObserverAddNotification(observer, app, kAXFocusedWindowChangedNotification as CFString, nil)
        CFRunLoopAddSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer), .commonModes)
    }
    func sample() {
        let app = NSWorkspace.shared.frontmostApplication
        let trusted = AXIsProcessTrusted()
        var title: String?
        var windowID: String?
        if let app { watch(app.processIdentifier) }
        if titles && trusted, let app {
            let element = AXUIElementCreateApplication(app.processIdentifier)
            AXUIElementSetMessagingTimeout(element, 0.05)
            var window: CFTypeRef?
            if AXUIElementCopyAttributeValue(element, kAXFocusedWindowAttribute as CFString, &window) == .success, let window, CFGetTypeID(window) == AXUIElementGetTypeID() {
                let axWindow = unsafeBitCast(window, to: AXUIElement.self)
                AXUIElementSetMessagingTimeout(axWindow, 0.05)
                if focusedWindow == nil || !CFEqual(focusedWindow!, axWindow) {
                    if let ax, let old = focusedWindow { AXObserverRemoveNotification(ax, old, kAXTitleChangedNotification as CFString) }
                    focusedWindow = axWindow
                    if let ax { AXObserverAddNotification(ax, axWindow, kAXTitleChangedNotification as CFString, nil) }
                }
                var value: CFTypeRef?
                if AXUIElementCopyAttributeValue(axWindow, kAXTitleAttribute as CFString, &value) == .success { title = value as? String }
                value = nil
                if AXUIElementCopyAttributeValue(axWindow, kAXIdentifierAttribute as CFString, &value) == .success { windowID = value as? String }
            }
        }
        let session = CGSessionCopyCurrentDictionary() as? [String: Any]
        let screenLocked = locked || (session?["CGSSessionScreenIsLocked"] as? Bool ?? false)
        let state = sleeping ? "sleeping" : screenLocked ? "locked" : displaySleeping ? "display_sleep" : app == nil ? "unknown" : "active"
        var payload: [String: Any] = ["utc": Int64(Date().timeIntervalSince1970 * 1000), "mono": Int64(ProcessInfo.processInfo.systemUptime * 1000), "idle_ms": Int64(min(CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: UInt32.max)!), 31536000) * 1000), "name": app?.localizedName ?? "Unknown", "pid": app?.processIdentifier ?? 0, "state": state, "trusted": trusted, "availability": !titles ? "disabled" : !trusted ? "permission_denied" : title == nil ? "unavailable" : "available"]
        payload["bundle"] = app?.bundleIdentifier ?? app.map { "process:\($0.processIdentifier)" }
        payload["title"] = title
        payload["window_id"] = windowID
        if let data = try? JSONSerialization.data(withJSONObject: payload), let string = String(data: data, encoding: .utf8) { string.withCString { sink($0) } }
    }
}
@_cdecl("habyss_start") public func habyssStart(_ sink: @escaping @convention(c) (UnsafePointer<CChar>?) -> Void) { DispatchQueue.main.async { if collector == nil { collector = Collector(sink) } } }
@_cdecl("habyss_titles") public func habyssTitles(_ enabled: Bool) { DispatchQueue.main.async { collector?.titles = enabled; collector?.observedPID = 0 } }
@_cdecl("habyss_permission") public func habyssPermission() { DispatchQueue.main.async { let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary; _ = AXIsProcessTrustedWithOptions(opts) } }
@_cdecl("habyss_open_permissions") public func habyssOpenPermissions() { DispatchQueue.main.async { if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") { NSWorkspace.shared.open(url) } } }
@_cdecl("habyss_publish") public func habyssPublish(_ json: UnsafePointer<CChar>) -> Bool {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "HabyssAppGroup") as? String,
          let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return false }
    do { try Data(String(cString: json).utf8).write(to: container.appendingPathComponent("snapshot.json"), options: .atomic); let now = ProcessInfo.processInfo.systemUptime; if now - lastWidgetReload >= 900 { WidgetCenter.shared.reloadAllTimelines(); lastWidgetReload = now }; return true } catch { return false }
}

// The JSON is copied before dispatch, so the Rust CString may be released immediately.
@_cdecl("habyss_save_export")
public func habyssSaveExport(_ json: UnsafePointer<CChar>, _ reply: @escaping @convention(c) (UnsafeMutableRawPointer?, UnsafePointer<CChar>?) -> Void, _ context: UnsafeMutableRawPointer?) {
    let data = Data(String(cString: json).utf8)
    DispatchQueue.main.async {
        let panel = NSSavePanel()
        panel.title = "Export Habyss history"
        panel.nameFieldStringValue = "habyss-export.json"
        panel.canCreateDirectories = true
        panel.begin { response in
            var result: [String: String] = [:]
            if response == .OK, let url = panel.url {
                do { try data.write(to: url, options: .atomic); result["path"] = url.path }
                catch { result["error"] = error.localizedDescription }
            }
            let encoded = (try? JSONSerialization.data(withJSONObject: result)) ?? Data("{}".utf8)
            String(decoding: encoded, as: UTF8.self).withCString { reply(context, $0) }
        }
    }
}

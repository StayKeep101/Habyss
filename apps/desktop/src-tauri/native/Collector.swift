import AppKit
import ApplicationServices
import CoreAudio
import CoreGraphics
import IOKit.pwr_mgt
import WidgetKit

typealias Sink = @convention(c) (UnsafePointer<CChar>?) -> Void
private var collector: Collector?
private var lastWidgetReload: TimeInterval = 0

// Browsers whose front tab URL can be read over Apple Events (each asks once for Automation consent).
private let browserScripts: [String: String] = [
    "com.apple.Safari": "tell application id \"com.apple.Safari\" to return URL of front document",
    "com.apple.SafariTechnologyPreview": "tell application id \"com.apple.SafariTechnologyPreview\" to return URL of front document",
    "com.google.Chrome": "tell application id \"com.google.Chrome\" to return URL of active tab of front window",
    "com.google.Chrome.beta": "tell application id \"com.google.Chrome.beta\" to return URL of active tab of front window",
    "com.brave.Browser": "tell application id \"com.brave.Browser\" to return URL of active tab of front window",
    "com.microsoft.edgemac": "tell application id \"com.microsoft.edgemac\" to return URL of active tab of front window",
    "com.vivaldi.Vivaldi": "tell application id \"com.vivaldi.Vivaldi\" to return URL of active tab of front window",
    "com.operasoftware.Opera": "tell application id \"com.operasoftware.Opera\" to return URL of active tab of front window",
    "company.thebrowser.Browser": "tell application id \"company.thebrowser.Browser\" to return URL of active tab of front window",
    "org.chromium.Chromium": "tell application id \"org.chromium.Chromium\" to return URL of active tab of front window",
]
/// Reads browser URLs off the main thread; `sample()` only ever reads the cache, so a slow browser never stalls the 1 s tick.
private final class BrowserURLReader {
    private let queue = DispatchQueue(label: "habyss.browser-url", qos: .utility)
    private let lock = NSLock()
    private var cache: (bundle: String, title: String?, url: String?, at: TimeInterval)?
    private var inFlight = false
    func url(bundle: String, title: String?) -> String? {
        guard let source = browserScripts[bundle] else { return nil }
        let now = ProcessInfo.processInfo.systemUptime
        lock.lock(); let cached = cache; let busy = inFlight; lock.unlock()
        let fresh = cached.map { $0.bundle == bundle && $0.title == title && now - $0.at < 3 } ?? false
        if !fresh && !busy {
            lock.lock(); inFlight = true; lock.unlock()
            queue.async { [weak self] in
                var error: NSDictionary?
                let value = NSAppleScript(source: source)?.executeAndReturnError(&error).stringValue
                self?.lock.lock(); self?.cache = (bundle, title, value.flatMap { $0.isEmpty ? nil : $0 }, ProcessInfo.processInfo.systemUptime); self?.inFlight = false; self?.lock.unlock()
            }
        }
        // A cached URL from another app or another title is never attributed to this sample.
        guard let cached, cached.bundle == bundle, cached.title == title else { return nil }
        return cached.url
    }
}
/// True while any process captures audio input (a call, a recording). CoreAudio reports this without a microphone permission.
private func microphoneInUse() -> Bool {
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var device = AudioDeviceID(0); var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &device) == noErr, device != 0 else { return false }
    address.mSelector = kAudioDevicePropertyDeviceIsRunningSomewhere
    var running = UInt32(0); size = UInt32(MemoryLayout<UInt32>.size)
    return AudioObjectGetPropertyData(device, &address, 0, nil, &size, &running) == noErr && running != 0
}
/// True when `pid` holds a display-sleep assertion, which video players and browsers do while playing video.
private func holdsDisplayAssertion(_ pid: pid_t) -> Bool {
    var raw: Unmanaged<CFDictionary>?
    guard IOPMCopyAssertionsByProcess(&raw) == kIOReturnSuccess, let dict = raw?.takeRetainedValue() as? [NSNumber: [[String: Any]]] else { return false }
    return dict[NSNumber(value: pid)]?.contains { ($0["AssertType"] as? String).map { $0 == "PreventUserIdleDisplaySleep" || $0 == "NoDisplaySleepAssertion" } ?? false } ?? false
}
private func secondsSince(_ types: [CGEventType]) -> Double { types.map { CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: $0) }.min() ?? 31536000 }
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
    let browser = BrowserURLReader()
    var micTick = 0
    var mic = false
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
        var document: String?
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
                value = nil
                if AXUIElementCopyAttributeValue(axWindow, kAXDocumentAttribute as CFString, &value) == .success { document = value as? String }
            }
        }
        let session = CGSessionCopyCurrentDictionary() as? [String: Any]
        let screenLocked = locked || (session?["CGSSessionScreenIsLocked"] as? Bool ?? false)
        let state = sleeping ? "sleeping" : screenLocked ? "locked" : displaySleeping ? "display_sleep" : app == nil ? "unknown" : "active"
        var payload: [String: Any] = ["utc": Int64(Date().timeIntervalSince1970 * 1000), "mono": Int64(ProcessInfo.processInfo.systemUptime * 1000), "idle_ms": Int64(min(CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: CGEventType(rawValue: UInt32.max)!), 31536000) * 1000), "name": app?.localizedName ?? "Unknown", "pid": app?.processIdentifier ?? 0, "state": state, "trusted": trusted, "availability": !titles ? "disabled" : !trusted ? "permission_denied" : title == nil ? "unavailable" : "available"]
        payload["bundle"] = app?.bundleIdentifier ?? app.map { "process:\($0.processIdentifier)" }
        payload["title"] = title
        payload["window_id"] = windowID
        payload["document"] = document
        // URLs follow the same opt-in as titles: nothing beyond the app name leaves the window unless the user enabled it.
        if titles, state == "active", let bundle = app?.bundleIdentifier { payload["url"] = browser.url(bundle: bundle, title: title) }
        let clamp = { (v: Double) in Int64(min(v, 31536000) * 1000) }
        payload["key_idle_ms"] = clamp(secondsSince([.keyDown, .flagsChanged]))
        payload["pointer_idle_ms"] = clamp(secondsSince([.mouseMoved, .leftMouseDown, .rightMouseDown, .scrollWheel, .leftMouseDragged]))
        micTick += 1; if micTick % 2 == 1 { mic = microphoneInUse() }
        payload["mic"] = mic
        payload["media"] = app.map { holdsDisplayAssertion($0.processIdentifier) } ?? false
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

/// The app's Finder icon as a 64 px PNG, base64-encoded; nil when no app has this bundle identifier.
/// The caller releases the string with `habyss_free`.
@_cdecl("habyss_app_icon")
public func habyssAppIcon(_ bundle: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>? {
    guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: String(cString: bundle)) else { return nil }
    let icon = NSWorkspace.shared.icon(forFile: url.path)
    let side = 64
    guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0) else { return nil }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    icon.draw(in: NSRect(x: 0, y: 0, width: side, height: side), from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    guard let png = rep.representation(using: .png, properties: [:]) else { return nil }
    return strdup(png.base64EncodedString())
}
@_cdecl("habyss_free") public func habyssFree(_ p: UnsafeMutablePointer<CChar>?) { free(p) }

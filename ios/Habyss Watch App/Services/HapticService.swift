import WatchKit

struct HapticService {
    static let device = WKInterfaceDevice.current()

    /// Plays a haptic unless the user turned them off (on by default).
    static func play(_ type: WKHapticType) {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: "watchHapticsEnabled") == nil || defaults.bool(forKey: "watchHapticsEnabled") else { return }
        device.play(type)
    }

    /// The whole day ticked off.
    static func playAllComplete() {
        play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { play(.success) }
    }
}

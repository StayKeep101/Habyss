import WatchKit

struct HapticService {
    static let device = WKInterfaceDevice.current()
    
    /// Play a haptic only if haptics are enabled in user preferences
    static func play(_ type: WKHapticType) {
        guard UserDefaults.standard.bool(forKey: "watchHapticsEnabled") else { return }
        device.play(type)
    }
    
    /// Celebratory double-tap for streak milestones
    static func playMilestone() {
        play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { play(.success) }
    }
    
    /// Triple click for 100% daily completion
    static func playAllComplete() {
        play(.success)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { play(.success) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { play(.success) }
    }
    
    /// Single click for quick log confirmation
    static func playQuickLog() {
        play(.click)
    }
    
    /// Breathing cues
    static func playInhale() { play(.directionUp) }
    static func playExhale() { play(.directionDown) }
}

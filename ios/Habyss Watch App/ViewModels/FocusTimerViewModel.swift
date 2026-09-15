import Foundation
import WatchConnectivity
import SwiftUI
import Combine

class FocusTimerViewModel: ObservableObject {
    // Session State
    @Published var session: FocusSession?
    @Published var isRunning = false
    @Published var isPaused = false
    @Published var selectedMode: FocusMode = .pomodoro
    @Published var duration: TimeInterval = 25 * 60
    @Published var linkedHabit: Habit?
    
    // Digital Crown
    @Published var crownValue: Double = 25.0
    
    // Timer
    private var timer: Timer?
    
    // Dependencies
    private var watchSessionManager = WatchSessionManager.shared
    
    init() {
        NotificationCenter.default.addObserver(self, selector: #selector(handleRemoteUpdate), name: NSNotification.Name("FocusUpdate"), object: nil)
    }
    
    // MARK: - Computed
    
    var timeRemainingString: String {
        guard let session = session else { return "00:00" }
        let total = Int(session.remainingTime)
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    // MARK: - User Intents
    
    func selectMode(_ mode: FocusMode) {
        selectedMode = mode
        duration = mode.defaultDuration
        crownValue = mode.defaultDuration / 60.0
    }
    
    func updateDurationFromCrown() {
        let minutes = max(1, Int(crownValue))
        duration = TimeInterval(minutes * 60)
    }
    
    func startSession() {
        let newSession = FocusSession(
            id: UUID(),
            mode: selectedMode,
            totalDuration: duration,
            elapsed: 0,
            isRunning: true,
            isPaused: false,
            startedAt: Date(),
            completedAt: nil,
            habitId: linkedHabit.map { UUID(uuidString: $0.id) ?? UUID() }
        )
        
        self.session = newSession
        self.isRunning = true
        self.isPaused = false
        
        startLocalTimer()
        HapticService.play(.start)
        
        watchSessionManager.sendMessage(message: [
            "type": "focus_start",
            "sessionId": newSession.id.uuidString,
            "mode": newSession.mode.rawValue,
            "duration": newSession.totalDuration
        ])
    }
    
    func pauseSession() {
        guard var s = session else { return }
        s.isRunning = false
        s.isPaused = true
        self.session = s
        self.isRunning = false
        self.isPaused = true
        
        stopLocalTimer()
        HapticService.play(.click)
        
        watchSessionManager.sendMessage(message: ["type": "focus_pause"])
    }
    
    func resumeSession() {
        guard var s = session else { return }
        s.isRunning = true
        s.isPaused = false
        self.session = s
        self.isRunning = true
        self.isPaused = false
        
        startLocalTimer()
        HapticService.play(.click)
        
        watchSessionManager.sendMessage(message: ["type": "focus_resume"])
    }
    
    func endSession() {
        self.session = nil
        self.isRunning = false
        self.isPaused = false
        self.linkedHabit = nil
        
        stopLocalTimer()
        HapticService.play(.stop)
        
        watchSessionManager.sendMessage(message: ["type": "focus_end"])
    }
    
    // MARK: - Timer Logic
    
    private func startLocalTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }
    
    private func stopLocalTimer() {
        timer?.invalidate()
        timer = nil
    }
    
    private func tick() {
        guard var s = session else { return }
        
        if s.mode == .flow {
            s.elapsed += 1
        } else {
            s.elapsed += 1
            
            // Countdown haptics in final 10 seconds
            let remaining = s.totalDuration - s.elapsed
            if remaining <= 10 && remaining > 0 {
                HapticService.play(.click)
            }
            
            if s.elapsed >= s.totalDuration {
                completeSession()
                return
            }
        }
        self.session = s
    }
    
    private func completeSession() {
        guard var s = session else { return }
        s.isRunning = false
        s.completedAt = Date()
        self.session = s
        self.isRunning = false
        
        stopLocalTimer()
        HapticService.playMilestone()
        
        // Auto-complete linked habit
        if let habit = linkedHabit {
            watchSessionManager.markHabitCompleted(habitId: habit.id)
        }
        
        watchSessionManager.sendMessage(message: ["type": "focus_complete"])
    }
    
    @objc private func handleRemoteUpdate(_ notification: Notification) {
        // Handle sync from phone (future)
    }
}

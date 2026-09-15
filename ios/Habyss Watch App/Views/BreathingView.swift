import SwiftUI
import WatchKit
import Combine

struct BreathingView: View {
    @State private var phase: BreathingPhase = .inhale
    @State private var circleSize: CGFloat = 40
    @State private var isRunning = false
    @State private var completedCycles = 0
    @State private var countdownSeconds: Int = 4
    
    let totalCycles = 4
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    @State private var phaseSecondsRemaining: Double = 4
    
    var body: some View {
        VStack(spacing: 16) {
            // Instruction
            Text(phase.instruction)
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundColor(.secondary)
                .animation(.easeInOut, value: phase)
            
            // Breathing circle — expands/contracts
            Circle()
                .fill(Color.habyssBlue.opacity(0.3))
                .frame(width: circleSize, height: circleSize)
                .animation(.easeInOut(duration: phase.duration), value: circleSize)
                .overlay(
                    Circle()
                        .stroke(Color.habyssBlue, lineWidth: 2)
                )
            
            // Countdown
            Text("\(countdownSeconds)")
                .font(.system(size: 28, weight: .bold, design: .rounded).monospacedDigit())
            
            // Session progress dots
            HStack(spacing: 6) {
                ForEach(0..<totalCycles, id: \.self) { i in
                    Circle()
                        .fill(i < completedCycles ? Color.habyssBlue : Color.white.opacity(0.2))
                        .frame(width: 6, height: 6)
                }
            }
            
            // Start/Stop button
            Button(isRunning ? "Stop" : "Begin") {
                if isRunning {
                    stop()
                } else {
                    start()
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(isRunning ? .secondary : .habyssBlue)
        }
        .padding()
        .navigationTitle("Breathe")
        .onReceive(timer) { _ in
            guard isRunning else { return }
            tick()
        }
    }
    
    func start() {
        isRunning = true
        completedCycles = 0
        phase = .inhale
        phaseSecondsRemaining = phase.duration
        countdownSeconds = Int(phase.duration)
        updateCircleSize()
        HapticService.playInhale()
    }
    
    func stop() {
        isRunning = false
        phase = .inhale
        circleSize = 40
        countdownSeconds = 4
    }
    
    func tick() {
        phaseSecondsRemaining -= 1
        countdownSeconds = max(0, Int(phaseSecondsRemaining))
        
        if phaseSecondsRemaining <= 0 {
            advancePhase()
        }
    }
    
    func advancePhase() {
        switch phase {
        case .inhale:
            phase = .hold
        case .hold:
            phase = .exhale
            HapticService.playExhale()
        case .exhale:
            phase = .pause
        case .pause:
            completedCycles += 1
            if completedCycles >= totalCycles {
                // Session complete
                WKInterfaceDevice.current().play(.success)
                stop()
                return
            }
            phase = .inhale
            HapticService.playInhale()
        }
        
        phaseSecondsRemaining = phase.duration
        countdownSeconds = Int(phase.duration)
        updateCircleSize()
    }
    
    func updateCircleSize() {
        switch phase {
        case .inhale:
            circleSize = 100
        case .hold:
            circleSize = 100
        case .exhale:
            circleSize = 40
        case .pause:
            circleSize = 40
        }
    }
}

// MARK: - Breathing Phase

enum BreathingPhase: Equatable {
    case inhale, hold, exhale, pause
    
    var instruction: String {
        switch self {
        case .inhale: return "Breathe In"
        case .hold: return "Hold"
        case .exhale: return "Breathe Out"
        case .pause: return "Pause"
        }
    }
    
    var duration: Double {
        switch self {
        case .inhale: return 4
        case .hold: return 4
        case .exhale: return 6
        case .pause: return 2
        }
    }
}

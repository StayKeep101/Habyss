import Foundation

struct FocusSession: Codable, Identifiable {
    let id: UUID
    var mode: FocusMode
    var totalDuration: TimeInterval
    var elapsed: TimeInterval
    var isRunning: Bool
    var isPaused: Bool
    var startedAt: Date?
    var completedAt: Date?
    var habitId: UUID?      // linked habit (optional)
    
    var remainingTime: TimeInterval { max(0, totalDuration - elapsed) }
    var progress: Double { totalDuration > 0 ? elapsed / totalDuration : 0 }
}

enum FocusMode: String, Codable, CaseIterable {
    case pomodoro = "pomodoro"          // 25 min
    case deepFocus = "deep_focus"       // 90 min
    case flow = "flow"                  // Open-ended
    case sprint = "sprint"              // 10 min
    case checkIn = "check_in"           // Quick task
    case shortBreak = "short_break"     // 5 min
    case longBreak = "long_break"       // 15 min
    
    var defaultDuration: TimeInterval {
        switch self {
        case .pomodoro: return 25 * 60
        case .deepFocus: return 90 * 60
        case .flow: return 0 // Infinite
        case .sprint: return 10 * 60
        case .checkIn: return 5 * 60
        case .shortBreak: return 5 * 60
        case .longBreak: return 15 * 60
        }
    }
    
    var displayName: String {
        switch self {
        case .pomodoro: return "Focus"
        case .deepFocus: return "Deep Work"
        case .flow: return "Flow State"
        case .sprint: return "Sprint"
        case .checkIn: return "Check-in"
        case .shortBreak: return "Short Break"
        case .longBreak: return "Long Break"
        }
    }
    
    var icon: String {
        switch self {
        case .pomodoro: return "timer"
        case .deepFocus: return "brain.head.profile"
        case .flow: return "infinity"
        case .sprint: return "hare.fill"
        case .checkIn: return "checkmark.circle"
        case .shortBreak: return "cup.and.saucer.fill"
        case .longBreak: return "moon.fill"
        }
    }
    
    var colorHex: String {
        switch self {
        case .pomodoro: return "#3B82F6"  // Blue
        case .deepFocus: return "#6366F1" // Indigo
        case .flow: return "#10B981"      // Emerald
        case .sprint: return "#F59E0B"    // Amber
        case .checkIn: return "#A855F7"   // Purple
        case .shortBreak: return "#10B981" // Green
        case .longBreak: return "#10B981"  // Green
        }
    }
    
    /// Alias matching the spec naming convention
    var accentColor: String { colorHex }
}

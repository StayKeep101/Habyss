import Foundation
import SwiftUI

enum HabyssConstants {
    // Streak milestones for celebrations
    static let streakMilestones = [7, 14, 21, 30, 50, 66, 100, 365]
    
    // Default focus durations (seconds)
    static let pomodoroDefault: TimeInterval = 25 * 60
    static let deepFocusDefault: TimeInterval = 90 * 60
    static let shortBreakDefault: TimeInterval = 5 * 60
    static let longBreakDefault: TimeInterval = 15 * 60
    
    // UserDefaults keys
    static let cachedHabitsKey = "cachedHabits"
    static let offlineQueueKey = "offlineHabitLogs"
    static let habitCacheDateKey = "habitCacheDate"
    
    // App Group
    static let appGroupId = "group.com.habyss.data"
    
    // UI Constants
    static let cornerRadius: CGFloat = 12
    static let smallCornerRadius: CGFloat = 8
    static let cardPadding: CGFloat = 12
}

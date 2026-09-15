import Foundation
import SwiftUI
import Combine

class WatchViewModel: ObservableObject {
    @Published var habits: [Habit] = []
    @Published var activeHabitName: String?
    @Published var timerEndDate: Date?
    @Published var dailyProgress: Double = 0.0
    
    private let appGroup = HabyssConstants.appGroupId
    private var timer: Timer?
    
    // Computed properties
    var completedCount: Int { habits.filter(\.isCompletedToday).count }
    var totalCount: Int { habits.count }
    var completionRatio: Double { totalCount > 0 ? Double(completedCount) / Double(totalCount) : 0 }
    var topStreak: Int { habits.map(\.streakCount).max() ?? 0 }
    
    var nextIncompleteHabit: Habit? {
        habits.first(where: { !$0.isCompletedToday })
    }
    
    var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "⚡ Good morning"
        case 12..<17: return "☀️ Good afternoon"
        case 17..<21: return "🌆 Good evening"
        default: return "🌙 Good night"
        }
    }
    
    init() {
        loadData()
        startPeriodicRefresh()
    }
    
    func loadData() {
        guard let userDefaults = UserDefaults(suiteName: appGroup) else { return }
        
        // Load habits from app group (JSON string format)
        if let jsonStr = userDefaults.string(forKey: "habitsData"),
           let data = jsonStr.data(using: .utf8),
           let decodedHabits = try? JSONDecoder().decode([Habit].self, from: data) {
            DispatchQueue.main.async {
                self.habits = decodedHabits
                self.calculateProgress()
            }
        }
        
        // Load active habit
        if let name = userDefaults.string(forKey: "activeHabitName"), name != "No Active Habit" {
            DispatchQueue.main.async { self.activeHabitName = name }
        } else {
            DispatchQueue.main.async { self.activeHabitName = nil }
        }
        
        // Load timer end date
        if let timestamp = userDefaults.object(forKey: "timerEndDate") as? Double {
            DispatchQueue.main.async {
                self.timerEndDate = Date(timeIntervalSince1970: timestamp / 1000)
            }
        } else {
            DispatchQueue.main.async { self.timerEndDate = nil }
        }
    }
    
    private func calculateProgress() {
        dailyProgress = completionRatio
    }
    
    func toggleHabit(id: String) {
        if let index = habits.firstIndex(where: { $0.id == id }) {
            habits[index].isCompletedToday.toggle()
            if habits[index].isCompletedToday {
                habits[index].completionCount = habits[index].targetCount
            } else {
                habits[index].completionCount = 0
            }
            calculateProgress()
            saveHabits()
        }
    }
    
    func logAllRemaining() {
        for i in habits.indices where !habits[i].isCompletedToday {
            habits[i].isCompletedToday = true
            habits[i].completionCount = habits[i].targetCount
        }
        calculateProgress()
        saveHabits()
        HapticService.playAllComplete()
    }
    
    func checkIn(habit: Habit, count: Int = 1) {
        if let idx = habits.firstIndex(where: { $0.id == habit.id }) {
            if habits[idx].supportsCountable {
                habits[idx].completionCount = min(
                    habits[idx].completionCount + count,
                    habits[idx].targetCount
                )
                habits[idx].isCompletedToday = habits[idx].completionCount >= habits[idx].targetCount
            } else {
                habits[idx].isCompletedToday = true
                habits[idx].completionCount = habits[idx].targetCount
            }
            calculateProgress()
            saveHabits()
            HapticService.playQuickLog()
        }
    }
    
    private func saveHabits() {
        guard let userDefaults = UserDefaults(suiteName: appGroup) else { return }
        if let newData = try? JSONEncoder().encode(habits),
           let jsonString = String(data: newData, encoding: .utf8) {
            userDefaults.set(jsonString, forKey: "habitsData")
        }
    }
    
    private func startPeriodicRefresh() {
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.loadData()
        }
    }
}

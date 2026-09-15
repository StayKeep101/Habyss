import SwiftUI

struct StreakBoardView: View {
    @EnvironmentObject var session: WatchSessionManager
    
    var topStreakHabit: Habit? {
        session.habits.max(by: { $0.streakCount < $1.streakCount })
    }
    
    var habitsWithStreaks: [Habit] {
        session.habits
            .filter { $0.streakCount > 0 }
            .sorted { $0.streakCount > $1.streakCount }
    }
    
    var atRiskHabits: [Habit] {
        // Habits with streaks ≥3 that aren't completed today
        session.habits.filter { $0.streakCount >= 3 && !$0.isCompletedToday }
    }
    
    var upcomingMilestones: [(habit: Habit, daysUntil: Int, targetStreak: Int)] {
        session.habits.compactMap { habit in
            for milestone in HabyssConstants.streakMilestones {
                if habit.streakCount < milestone && habit.streakCount >= milestone - 3 {
                    return (habit, milestone - habit.streakCount, milestone)
                }
            }
            return nil
        }
    }
    
    var body: some View {
        List {
            // Top streak — featured card
            if let champion = topStreakHabit, champion.streakCount > 0 {
                Section {
                    VStack(spacing: 6) {
                        Text(champion.emoji)
                            .font(.system(size: 28))
                        Text(champion.title)
                            .font(.system(.body, design: .rounded, weight: .bold))
                        HStack(spacing: 4) {
                            Text("🔥")
                            Text("\(champion.streakCount) days")
                                .font(.system(.caption, design: .rounded, weight: .bold))
                                .foregroundColor(.habyssAmber)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .listRowBackground(Color.habyssAmber.opacity(0.15))
                }
            }
            
            // All streaks
            if !habitsWithStreaks.isEmpty {
                Section("All Streaks") {
                    ForEach(habitsWithStreaks) { habit in
                        HStack {
                            Text(habit.emoji)
                            Text(habit.title)
                                .font(.system(.caption, design: .rounded))
                                .lineLimit(1)
                            Spacer()
                            Text("\(habit.streakCount)d")
                                .font(.system(.caption, design: .rounded, weight: .bold))
                                .foregroundColor(.habyssAmber)
                            if habit.streakCount >= 7 { Text("🔥").font(.caption2) }
                        }
                    }
                }
            }
            
            // At-risk habits
            if !atRiskHabits.isEmpty {
                Section {
                    ForEach(atRiskHabits) { habit in
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.habyssAmber)
                                .font(.caption)
                            Text("\(habit.emoji) \(habit.title)")
                                .font(.caption)
                                .foregroundColor(.habyssAmber)
                                .lineLimit(1)
                        }
                    }
                } header: {
                    Text("⚠️ At Risk Today")
                        .foregroundColor(.habyssAmber)
                }
            }
            
            // Upcoming milestones
            if !upcomingMilestones.isEmpty {
                Section("🌟 Coming Up") {
                    ForEach(upcomingMilestones, id: \.habit.id) { milestone in
                        HStack {
                            Text(milestone.habit.emoji)
                            VStack(alignment: .leading) {
                                Text(milestone.habit.title)
                                    .font(.caption)
                                    .lineLimit(1)
                                Text("\(milestone.daysUntil)d to \(milestone.targetStreak)d goal")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.carousel)
        .navigationTitle("Streaks")
    }
}

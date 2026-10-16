import SwiftUI
import WatchKit

struct DashboardView: View {
    @EnvironmentObject var session: WatchSessionManager
    
    var completedCount: Int { session.habits.filter(\.isCompletedToday).count }
    var totalCount: Int { session.habits.count }
    var completionRatio: Double {
        totalCount == 0 ? 0 : Double(completedCount) / Double(totalCount)
    }
    var nextIncompleteHabit: Habit? {
        session.habits.first(where: { !$0.isCompletedToday })
    }
    var topStreak: Int { session.habits.map(\.streakCount).max() ?? 0 }
    
    var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "⚡ Good morning"
        case 12..<17: return "☀️ Good afternoon"
        case 17..<21: return "🌆 Good evening"
        default: return "🌙 Good night"
        }
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Greeting
                Text(greeting)
                    .font(.system(.caption, design: .default))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Main Progress Arc
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 8)
                    
                    Circle()
                        .trim(from: 0.0, to: CGFloat(min(completionRatio, 1.0)))
                        .stroke(
                            completionRatio >= 1.0 ? Color.habyssGreen : Color.habyssBlue,
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .animation(.spring(response: 0.8, dampingFraction: 0.7), value: completionRatio)
                    
                    VStack(spacing: 2) {
                        Text("\(completedCount)")
                            .font(.system(size: 28, weight: .bold, design: .default))
                            .foregroundColor(.white)
                        Text("/ \(totalCount) habits")
                            .font(.system(.caption2, design: .default))
                            .foregroundColor(.secondary)
                    }
                }
                .frame(height: 100)
                
                // Streak Badge
                if topStreak > 0 {
                    NavigationLink(destination: StreakBoardView()) {
                        HStack(spacing: 6) {
                            Text("🔥")
                                .font(.system(size: 16))
                            Text("\(topStreak)-day streak")
                                .font(.system(.caption, design: .default, weight: .semibold))
                                .foregroundColor(.habyssAmber)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: HabyssConstants.smallCornerRadius)
                                .fill(Color.habyssAmber.opacity(0.15))
                        )
                    }
                    .buttonStyle(.plain)
                }
                
                // Next Habit Card
                if let next = nextIncompleteHabit {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Up Next")
                            .font(.system(.caption2, design: .default))
                            .foregroundColor(.secondary)
                        
                        NavigationLink(destination: HabitDetailView(habit: next)) {
                            HStack(spacing: 8) {
                                Text(next.emoji)
                                    .font(.system(size: 18))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(next.title)
                                        .font(.system(.body, design: .default, weight: .semibold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    if next.supportsCountable {
                                        Text("\(next.completionCount)/\(next.targetCount) \(next.unit)")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .padding(10)
                            .background(
                                RoundedRectangle(cornerRadius: HabyssConstants.cornerRadius)
                                    .fill(Color.white.opacity(0.05))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                
                // Action Buttons
                HStack(spacing: 8) {
                    NavigationLink(destination: FocusTimerView()) {
                        Label("Focus", systemImage: "timer")
                            .font(.system(.caption, design: .default, weight: .semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.habyssBlue)
                    
                    Button {
                        logAllRemaining()
                    } label: {
                        Text("Log All")
                            .font(.system(.caption, design: .default, weight: .semibold))
                    }
                    .buttonStyle(.bordered)
                    .disabled(completedCount >= totalCount)
                }
            }
            .padding()
        }
        .navigationTitle("Today")
    }
    
    func logAllRemaining() {
        let incomplete = session.habits.filter { !$0.isCompletedToday }
        for habit in incomplete {
            session.markHabitCompleted(habitId: habit.id)
        }
        WKInterfaceDevice.current().play(.success)
    }
}

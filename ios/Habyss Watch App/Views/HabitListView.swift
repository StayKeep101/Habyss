import SwiftUI
import WatchKit

struct HabitListView: View {
    @EnvironmentObject var session: WatchSessionManager
    @State private var sortByPriority = true
    
    var sortedHabits: [Habit] {
        if sortByPriority {
            return session.habits.sorted { a, b in
                // Pinned first, then by priority, then incomplete before complete
                if a.isPinned != b.isPinned { return a.isPinned }
                if a.isCompletedToday != b.isCompletedToday { return !a.isCompletedToday }
                return a.watchPriority < b.watchPriority
            }
        } else {
            return session.habits.sorted { $0.title < $1.title }
        }
    }
    
    var body: some View {
        List {
            Section {
                ForEach(sortedHabits) { habit in
                    NavigationLink(destination: HabitDetailView(habit: habit)) {
                        HabitRowView(
                            habit: habit,
                            onCheckIn: {
                                session.markHabitCompleted(habitId: habit.id)
                                WKInterfaceDevice.current().play(.success)
                            }
                        )
                    }
                    .listRowBackground(rowBackground(for: habit))
                }
            }
        }
        .listStyle(.carousel)
        .navigationTitle("Habits")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation { sortByPriority.toggle() }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
            }
        }
    }
    
    func rowBackground(for habit: Habit) -> some View {
        RoundedRectangle(cornerRadius: HabyssConstants.cornerRadius)
            .fill(habit.isCompletedToday
                  ? Color.habyssGreen.opacity(0.15)
                  : Color.white.opacity(0.05))
    }
}

// MARK: - Habit Row

struct HabitRowView: View {
    let habit: Habit
    let onCheckIn: () -> Void
    
    var body: some View {
        HStack(spacing: 10) {
            // Check-in button
            Button(action: onCheckIn) {
                ZStack {
                    Circle()
                        .strokeBorder(
                            habit.isCompletedToday ? Color.habyssGreen : Color.white.opacity(0.4),
                            lineWidth: 2
                        )
                        .frame(width: 28, height: 28)
                    
                    if habit.isCompletedToday {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.habyssGreen)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(habit.isCompletedToday && !habit.supportsCountable)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(habit.emoji)
                        .font(.system(size: 14))
                    Text(habit.title)
                        .font(.system(.body, design: .default))
                        .foregroundColor(habit.isCompletedToday ? .secondary : .primary)
                        .strikethrough(habit.isCompletedToday && !habit.supportsCountable)
                        .lineLimit(1)
                }
                
                // Progress bar for countable habits
                if habit.supportsCountable {
                    ProgressView(value: habit.progress)
                        .tint(Color(hex: habit.color))
                        .scaleEffect(y: 0.7)
                    Text("\(habit.completionCount)/\(habit.targetCount) \(habit.unit)")
                        .font(.system(.caption2, design: .default))
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Streak badge
            if habit.streakCount >= 3 {
                VStack(spacing: 1) {
                    Text("🔥")
                        .font(.system(size: 10))
                    Text("\(habit.streakCount)")
                        .font(.system(.caption2, design: .default, weight: .bold))
                        .foregroundColor(.habyssAmber)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

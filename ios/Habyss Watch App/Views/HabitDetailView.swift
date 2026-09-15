import SwiftUI
import WatchKit

struct HabitDetailView: View {
    let habit: Habit
    @EnvironmentObject var session: WatchSessionManager
    @Environment(\.dismiss) var dismiss
    
    @State private var currentCount: Int = 0
    @State private var crownValue: Double = 0
    
    var progress: Double {
        habit.targetCount > 0 ? Double(currentCount) / Double(habit.targetCount) : 0
    }
    
    var isAlreadyComplete: Bool {
        habit.isCompletedToday
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Header
                HStack {
                    Text(habit.emoji)
                        .font(.system(size: 28))
                    VStack(alignment: .leading) {
                        Text(habit.title)
                            .font(.system(.headline, design: .rounded, weight: .bold))
                        Text(habit.category.rawValue.capitalized)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                
                // Progress for countable habits
                if habit.supportsCountable {
                    VStack(spacing: 6) {
                        ProgressView(value: progress)
                            .tint(Color(hex: habit.color))
                        
                        // Stepper
                        HStack {
                            Button { if currentCount > 0 { currentCount -= 1 } } label: {
                                Image(systemName: "minus")
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.1))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                            
                            Spacer()
                            Text("\(currentCount)")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                            Text("/ \(habit.targetCount)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            
                            Button {
                                if currentCount < habit.targetCount { currentCount += 1 }
                            } label: {
                                Image(systemName: "plus")
                                    .frame(width: 32, height: 32)
                                    .background(Color.habyssBlue)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .focusable()
                    .digitalCrownRotation($crownValue, from: 0, through: Double(habit.targetCount), sensitivity: .medium)
                    .onChange(of: crownValue) { newValue in
                        currentCount = Int(newValue.rounded())
                    }
                }
                
                // Streak info pills
                HStack(spacing: 16) {
                    StatPill(emoji: "🔥", label: "Streak", value: "\(habit.streakCount)d")
                    StatPill(emoji: "⭐", label: "Best", value: "\(habit.longestStreak)d")
                }
                
                // Weekly mini heatmap
                WeeklyHeatmapView(habit: habit)
                
                // Actions
                VStack(spacing: 8) {
                    Button {
                        session.markHabitCompleted(habitId: habit.id, count: max(1, currentCount - habit.completionCount))
                        WKInterfaceDevice.current().play(.success)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { dismiss() }
                    } label: {
                        Label("Mark Complete", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.habyssGreen)
                    .disabled(isAlreadyComplete && !habit.supportsCountable)
                    
                    Button("Skip Today") {
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(habit.title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            currentCount = habit.completionCount
            crownValue = Double(habit.completionCount)
        }
    }
}

// MARK: - Stat Pill

struct StatPill: View {
    let emoji: String
    let label: String
    let value: String
    
    var body: some View {
        VStack(spacing: 2) {
            Text(emoji)
                .font(.system(size: 14))
            Text(value)
                .font(.system(.caption, design: .rounded, weight: .bold))
            Text(label)
                .font(.system(.caption2, design: .rounded))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: HabyssConstants.smallCornerRadius)
                .fill(Color.white.opacity(0.05))
        )
    }
}

// MARK: - Weekly Heatmap

struct WeeklyHeatmapView: View {
    let habit: Habit
    let days = ["M", "T", "W", "T", "F", "S", "S"]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("This Week")
                .font(.system(.caption2, design: .rounded))
                .foregroundColor(.secondary)
            
            HStack(spacing: 4) {
                ForEach(0..<7, id: \.self) { index in
                    let isToday = Calendar.current.component(.weekday, from: .now) == (index + 2) % 7 + 1
                    let isPast = index < todayIndex
                    let isDone = isPast && index < habit.streakCount  // Approximate from streak
                    
                    VStack(spacing: 2) {
                        Text(days[index])
                            .font(.system(size: 8, design: .rounded))
                            .foregroundColor(isToday ? .habyssBlue : .secondary)
                        
                        ZStack {
                            Circle()
                                .fill(isDone ? Color.habyssGreen.opacity(0.3) : Color.white.opacity(0.05))
                                .frame(width: 16, height: 16)
                            
                            if isDone {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 7, weight: .bold))
                                    .foregroundColor(.habyssGreen)
                            } else if isToday && habit.isCompletedToday {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 7, weight: .bold))
                                    .foregroundColor(.habyssGreen)
                            } else if !isPast && !isToday {
                                Text("—")
                                    .font(.system(size: 6))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }
    
    var todayIndex: Int {
        let weekday = Calendar.current.component(.weekday, from: .now)
        // Convert to Mon=0, Tue=1, ..., Sun=6
        return (weekday + 5) % 7
    }
}

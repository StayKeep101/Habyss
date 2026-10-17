import SwiftUI

/**
 * The whole watch app: today's tasks and habits in one list, a tap to tick.
 *
 * It used to be five pages stacked vertically, each scrolling inside the
 * pager; scrolling past the end of one fought the pager and crashed. One list,
 * one scroll.
 */
struct ContentView: View {
    @EnvironmentObject var day: WatchSessionManager

    var body: some View {
        NavigationStack {
            List {
                Header(done: day.doneCount, total: day.totalCount)
                    .listRowBackground(Color.clear)

                if day.totalCount == 0 {
                    Text(day.dayKey.isEmpty ? "Open Habyss on your iPhone to bring today here." : "Nothing set for today.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }

                if !day.tasks.isEmpty {
                    Section("Tasks") {
                        ForEach(day.tasks) { task in
                            Row(title: task.title, done: task.completed, trailing: task.time, tickable: true) {
                                day.toggleTask(task)
                            }
                        }
                    }
                }

                if !day.habits.isEmpty {
                    Section("Habits") {
                        ForEach(day.habits) { habit in
                            Row(title: habit.title, done: habit.completed,
                                trailing: habit.streakCount > 0 ? "\(habit.streakCount)" : "",
                                streak: habit.streakCount > 0, tickable: habit.canTick) {
                                day.toggleHabit(habit)
                            }
                        }
                    }
                }

                if day.isStale {
                    Text("From \(day.dayKey). Open Habyss on your iPhone to update.")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Today")
        }
        .tint(.habyssAccent)
    }
}

/// How much of today is done: a ring in the app's accent and the count.
private struct Header: View {
    let done: Int
    let total: Int

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: total > 0 ? CGFloat(done) / CGFloat(total) : 0)
                    .stroke(Color.habyssAccent, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.4), value: done)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 0) {
                Text("\(done) of \(total)")
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .animation(.default, value: done)
                Text(done == total && total > 0 ? "All done" : "done today")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }
}

/// One thing to do: a circle that fills with the accent when ticked.
private struct Row: View {
    let title: String
    let done: Bool
    var trailing: String = ""
    var streak = false
    let tickable: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .strokeBorder(done ? Color.clear : Color.white.opacity(0.35), lineWidth: 1.5)
                        .background(Circle().fill(done ? Color.habyssAccent : Color.clear))
                    if done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.black)
                    } else if !tickable {
                        Image(systemName: "timer")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 22, height: 22)
                .animation(.spring(duration: 0.25), value: done)

                Text(title)
                    .font(.system(.body))
                    .lineLimit(2)
                    .strikethrough(done)
                    .foregroundStyle(done ? .secondary : .primary)

                Spacer(minLength: 4)

                if !trailing.isEmpty {
                    HStack(spacing: 2) {
                        if streak { Image(systemName: "flame.fill").font(.system(size: 9)) }
                        Text(trailing).monospacedDigit()
                    }
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
        .disabled(!tickable)
        .accessibilityLabel("\(title), \(done ? "done" : "not done")")
    }
}

#Preview {
    ContentView().environmentObject(WatchSessionManager.shared)
}

import SwiftUI
import WidgetKit

struct DashboardEntry: TimelineEntry {
    let date: Date
    let snapshot: DashboardSnapshot?
    var accent: Color { Color(habyssHex: snapshot?.accent.from) ?? Habyss.fallbackFrom }
}
struct DashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry { DashboardEntry(date: .now, snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
        completion(DashboardEntry(date: .now, snapshot: DashboardSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
        let snapshot = DashboardSnapshot.read()
        let today = Calendar.current.startOfDay(for: .now)
        let entries = (0...8).compactMap { offset -> DashboardEntry? in
            guard let date = Calendar.current.date(byAdding: .day, value: offset, to: today) else { return nil }
            return DashboardEntry(date: offset == 0 ? .now : date, snapshot: snapshot)
        }
        completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

struct DashboardBackground: View {
    let accent: Color
    var body: some View {
        ZStack {
            Habyss.void
            RadialGradient(colors: [accent.opacity(0.22), .clear], center: .topLeading, startRadius: 0, endRadius: 230)
        }
    }
}

struct HabitHeatmapView: View {
    let entry: DashboardEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let today = SimpleEntry.todayKey(entry.date)
        let count = family == .systemSmall ? 49 : 91
        let cells = Array((entry.snapshot?.heatmap ?? []).filter { $0.date <= today }.suffix(count))
        let completed = cells.reduce(0) { $0 + $1.completed }
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("HABIT HEATMAP").sectionLabel()
                Spacer(minLength: 0)
                Image(systemName: "square.grid.3x3.fill").foregroundStyle(entry.accent).font(.caption)
            }
            if cells.isEmpty {
                Spacer()
                Text("Your consistency starts here.").font(.subheadline).foregroundStyle(Habyss.dim)
                Text("Open Habyss to sync your habits.").font(.caption).foregroundStyle(Habyss.faint)
                Spacer()
            } else {
                GeometryReader { geometry in
                    let columns = Int(ceil(Double(cells.count) / 7))
                    let size = min(12, max(2, min((geometry.size.height - 18) / 7, (geometry.size.width - CGFloat(columns - 1) * 3) / CGFloat(max(1, columns)))))
                    HStack(alignment: .top, spacing: 3) {
                        ForEach(0..<columns, id: \.self) { column in
                            VStack(spacing: 3) {
                                ForEach(0..<7, id: \.self) { row in
                                    let index = column * 7 + row
                                    if index < cells.count {
                                        let cell = cells[index]
                                        let fraction = cell.total > 0 ? min(1, Double(cell.completed) / Double(cell.total)) : 0
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(cell.completed > 0 ? entry.accent.opacity(0.3 + 0.7 * fraction) : Color.white.opacity(0.07))
                                            .frame(width: size, height: size)
                                            .overlay(RoundedRectangle(cornerRadius: 2).stroke(cell.date == today ? entry.accent : .clear, lineWidth: 1))
                                            .accessibilityLabel("\(cell.date): \(cell.completed) of \(cell.total) habits")
                                    }
                                }
                            }
                        }
                    }
                }
                Text("\(completed) check-ins · \(cells.count) days").font(.system(size: 10)).foregroundStyle(Habyss.faint)
            }
        }
        .widgetURL(URL(string: "habyss://progress"))
    }
}

struct GoalsProgressView: View {
    let entry: DashboardEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let goals = entry.snapshot?.goals ?? []
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("GOALS").sectionLabel()
                Spacer()
                Image(systemName: "flag.fill").foregroundStyle(entry.accent).font(.caption)
            }
            if goals.isEmpty {
                Spacer()
                Text("Make room for something big.").font(.subheadline).foregroundStyle(.white)
                Text("Add a goal in Habyss.").font(.caption).foregroundStyle(Habyss.dim)
                Spacer()
            } else {
                ForEach(goals.prefix(family == .systemSmall ? 2 : 3)) { goal in
                    Link(destination: URL(string: "habyss://goal-detail?goalId=\(goal.id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? goal.id)")!) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(goal.name).font(.system(size: 13, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                                Spacer(minLength: 4)
                                Text("\(Int(goal.progress.rounded()))%")
                                    .font(.system(size: 12, weight: .semibold, design: .rounded)).monospacedDigit()
                                    .foregroundStyle(Color(habyssHex: goal.color) ?? entry.accent)
                            }
                            ProgressView(value: min(1, max(0, goal.progress / 100)))
                                .tint(Color(habyssHex: goal.color) ?? entry.accent)
                        }
                    }
                }
                Spacer(minLength: 0)
                Text(goals.count > (family == .systemSmall ? 2 : 3) ? "+\(goals.count - (family == .systemSmall ? 2 : 3)) more in Habyss" : "One step closer.")
                    .font(.system(size: 10)).foregroundStyle(Habyss.faint)
            }
        }
        .widgetURL(URL(string: "habyss://roadmap"))
    }
}

struct HabyssHeatmapWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssHeatmap", provider: DashboardProvider()) { entry in
            HabitHeatmapView(entry: entry).containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .configurationDisplayName("Habit Heatmap")
        .description("Your habit consistency, one little square at a time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
struct HabyssGoalsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssGoals", provider: DashboardProvider()) { entry in
            GoalsProgressView(entry: entry).containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .configurationDisplayName("Goals Progress")
        .description("See the progress you’ve made. Tap a goal to take the next step.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

import SwiftUI
import WidgetKit
import AppIntents
import Charts

struct DashboardEntry: TimelineEntry {
    let date: Date
    let snapshot: DashboardSnapshot?
    var goalID: String? = nil
    var accent: Color { Habyss.accent(from: snapshot?.accent.from, to: snapshot?.accent.to) }
}
struct DashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry { DashboardEntry(date: .now, snapshot: .preview) }
    func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
        completion(DashboardEntry(date: .now, snapshot: context.isPreview ? .preview : DashboardSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
        completion(dashboardTimeline(snapshot: DashboardSnapshot.read()))
    }
}
private func dashboardTimeline(snapshot: DashboardSnapshot?, goalID: String? = nil) -> Timeline<DashboardEntry> {
    let today = Calendar.current.startOfDay(for: .now)
    let entries = (0...8).compactMap { offset -> DashboardEntry? in
        guard let date = Calendar.current.date(byAdding: .day, value: offset, to: today) else { return nil }
        return DashboardEntry(date: offset == 0 ? .now : date, snapshot: snapshot, goalID: goalID)
    }
    return Timeline(entries: entries, policy: .after(Date().addingTimeInterval(30 * 60)))
}

struct GoalChoice: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Goal"
    static var defaultQuery = GoalChoiceQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}
struct GoalChoiceQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [GoalChoice] {
        let goals = DashboardSnapshot.read()?.goals ?? []
        return identifiers.compactMap { id in goals.first { $0.id == id }.map { GoalChoice(id: $0.id, name: $0.name) } }
    }
    func suggestedEntities() async throws -> [GoalChoice] {
        (DashboardSnapshot.read()?.goals ?? []).map { GoalChoice(id: $0.id, name: $0.name) }
    }
    func defaultResult() async -> GoalChoice? { try? await suggestedEntities().first }
}
struct GoalWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose a goal"
    static var description = IntentDescription("Follow one goal from your Habyss plan.")
    @Parameter(title: "Goal") var goal: GoalChoice?
}
struct GoalWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry { DashboardEntry(date: .now, snapshot: .preview) }
    func snapshot(for configuration: GoalWidgetConfiguration, in context: Context) async -> DashboardEntry {
        DashboardEntry(date: .now, snapshot: context.isPreview ? .preview : DashboardSnapshot.read(), goalID: configuration.goal?.id)
    }
    func timeline(for configuration: GoalWidgetConfiguration, in context: Context) async -> Timeline<DashboardEntry> {
        dashboardTimeline(snapshot: DashboardSnapshot.read(), goalID: configuration.goal?.id)
    }
}

struct DashboardBackground: View {
    let accent: Color
    var body: some View {
        // The app's matte card: top-lit, no accent glow.
        LinearGradient(colors: [Habyss.matteTop, Habyss.matteMid, Habyss.matteBottom],
                       startPoint: .top, endPoint: .bottom)
    }
}

struct HabitHeatmapView: View {
    let entry: DashboardEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let today = widgetDayKey(entry.date)
        let count = family == .systemSmall ? 49 : 91
        let cells = Array((entry.snapshot?.heatmap ?? []).filter { $0.date <= today }.suffix(count))
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Image(systemName: "flame.fill").font(.system(size: 16)).foregroundStyle(entry.accent)
                Text(entry.snapshot?.streak.map(String.init) ?? "—").font(.system(size: 27, weight: .semibold)).foregroundStyle(.white)
                Text("day streak").font(.system(size: 11)).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
            }
            if cells.isEmpty {
                Spacer(minLength: 0)
                Text("Your story starts here").font(.system(size: 12, weight: .medium)).foregroundStyle(.white)
                Text("Open Habyss to sync your habits.").font(.system(size: 11)).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
            } else {
                GeometryReader { geometry in
                    let columns = Int(ceil(Double(cells.count) / 7))
                    let size = max(2, min((geometry.size.height - 18) / 7, (geometry.size.width - CGFloat(columns - 1) * 3) / CGFloat(columns)))
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
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                if entry.snapshot?.dayKey != today {
                    Text("Open Habyss to refresh").font(.system(size: 9)).foregroundStyle(Habyss.faint).lineLimit(1)
                }
            }
        }
        .padding(12)
        .widgetURL(URL(string: "habyss://progress"))
    }
}

struct GoalsProgressView: View {
    let entry: DashboardEntry
    private var goal: DashboardGoal? {
        if let id = entry.goalID { return entry.snapshot?.goals.first { $0.id == id } }
        return entry.snapshot?.goals.first
    }
    private var destination: URL {
        guard let goal else { return URL(string: "habyss://roadmap")! }
        var parts = URLComponents(string: "habyss://goal-detail")!
        parts.queryItems = [URLQueryItem(name: "goalId", value: goal.id)]
        return parts.url!
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            if let goal {
                let color = Color(habyssHex: goal.color) ?? entry.accent
                Text(goal.name).font(.system(size: 12, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text("\(Int(goal.progress.rounded()))").font(.system(size: 28, weight: .semibold)).foregroundStyle(color)
                    Text("% complete").font(.system(size: 10)).foregroundStyle(Habyss.dim)
                }
                let points = goal.points ?? []
                if points.isEmpty {
                    Spacer(minLength: 0)
                    Text("Open Habyss to load your graph").font(.system(size: 11)).foregroundStyle(Habyss.dim)
                    Spacer(minLength: 0)
                } else {
                    Chart {
                        ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                            AreaMark(x: .value("Day", index), yStart: .value("Baseline", 0), yEnd: .value("Progress", point.actual))
                                .foregroundStyle(LinearGradient(colors: [color.opacity(0.3), color.opacity(0.01)], startPoint: .top, endPoint: .bottom))
                            LineMark(x: .value("Day", index), y: .value("Progress", point.actual))
                                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round)).foregroundStyle(color)
                            if index == points.count - 1 {
                                PointMark(x: .value("Day", index), y: .value("Progress", point.actual)).symbolSize(20).foregroundStyle(color)
                            }
                        }
                    }
                    .chartXScale(domain: 0...max(1, points.count - 1))
                    .chartYScale(domain: 0...100)
                    .chartXAxis(.hidden).chartYAxis(.hidden)
                    .accessibilityLabel("\(goal.name), \(Int(goal.progress.rounded())) percent complete, from \(points.first?.date ?? "") to \(points.last?.date ?? "")")
                    HStack {
                        Text(points.first?.date.suffix(5).replacingOccurrences(of: "-", with: "/") ?? "")
                        Spacer()
                        Text(points.last?.date.suffix(5).replacingOccurrences(of: "-", with: "/") ?? "")
                    }.font(.system(size: 9)).foregroundStyle(Habyss.faint)
                }
            } else {
                Text("Goals").sectionLabel()
                Spacer(minLength: 0)
                Image(systemName: "chart.xyaxis.line").font(.system(size: 25)).foregroundStyle(entry.accent)
                Text(entry.snapshot == nil ? "Open Habyss to sync" : entry.goalID != nil ? "Choose another goal" : "Start with a goal")
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(.white)
                Text(entry.goalID != nil ? "Touch and hold, then Edit Widget." : "Add a goal in Habyss to follow it here.")
                    .font(.system(size: 10)).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
            }
        }
        .padding(12)
        .widgetURL(destination)
    }
}

struct HabyssHeatmapWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssHeatmap", provider: DashboardProvider()) { entry in
            HabitHeatmapView(entry: entry).containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Heatmap & Streak")
        .description("Your daily streak and the habit check-ins that built it.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
struct HabyssGoalsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "HabyssGoals", intent: GoalWidgetConfiguration.self, provider: GoalWidgetProvider()) { entry in
            GoalsProgressView(entry: entry).containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Goal Progress")
        .description("Choose a goal with Edit Widget and follow its progress over time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

extension DashboardSnapshot {
    static var preview: DashboardSnapshot {
        let today = widgetDayKey()
        let heatmap = (0..<91).map { offset in
            HeatmapDay(date: widgetDayKey(Calendar.current.date(byAdding: .day, value: offset - 90, to: .now)!),
                       completed: offset > 80 ? 3 : (offset * 7 + offset / 3) % 4, total: 3)
        }
        let points = (0..<30).map { offset in
            GoalGraphPoint(date: widgetDayKey(Calendar.current.date(byAdding: .day, value: offset - 29, to: .now)!), actual: min(68, Double(offset * 2 + offset / 4)))
        }
        return DashboardSnapshot(version: 1, generatedAt: today, dayKey: today,
                                 accent: .init(from: "#8BADD6", to: "#3A5A8C"), days: [], heatmap: heatmap,
                                 goals: [DashboardGoal(id: "preview", name: "Build something meaningful", progress: 65, color: "#8BADD6", taskWeights: [:], points: points)], streak: 10)
    }
}

#if DEBUG
#Preview(as: .systemSmall) { HabyssHeatmapWidget() } timeline: { DashboardEntry(date: .now, snapshot: .preview) }
#Preview(as: .systemMedium) { HabyssGoalsWidget() } timeline: { DashboardEntry(date: .now, snapshot: .preview) }
#endif

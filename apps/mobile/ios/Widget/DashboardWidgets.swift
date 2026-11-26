import SwiftUI
import WidgetKit
import AppIntents
import Charts

struct DashboardEntry: TimelineEntry {
    let date: Date
    let snapshot: DashboardSnapshot?
    /// The habit the streak widget follows; nil means every habit.
    var habitID: String? = nil
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
private func dashboardTimeline(snapshot: DashboardSnapshot?, habitID: String? = nil) -> Timeline<DashboardEntry> {
    let today = Calendar.current.startOfDay(for: .now)
    let entries = (0...8).compactMap { offset -> DashboardEntry? in
        guard let date = Calendar.current.date(byAdding: .day, value: offset, to: today) else { return nil }
        return DashboardEntry(date: offset == 0 ? .now : date, snapshot: snapshot, habitID: habitID)
    }
    return Timeline(entries: entries, policy: .after(Date().addingTimeInterval(30 * 60)))
}

/// A habit to follow on the streak widget. Leaving it empty follows every habit.
struct HabitChoice: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Habit"
    static var defaultQuery = HabitChoiceQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}
struct HabitChoiceQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [HabitChoice] {
        let habits = DashboardSnapshot.read()?.habits ?? []
        return identifiers.compactMap { id in habits.first { $0.id == id }.map { HabitChoice(id: $0.id, name: $0.name) } }
    }
    func suggestedEntities() async throws -> [HabitChoice] {
        (DashboardSnapshot.read()?.habits ?? []).map { HabitChoice(id: $0.id, name: $0.name) }
    }
}
struct StreakWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose a habit"
    static var description = IntentDescription("Follow one habit's streak, or leave it empty for all of them.")
    @Parameter(title: "Habit") var habit: HabitChoice?
}
struct StreakWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry { DashboardEntry(date: .now, snapshot: .preview) }
    func snapshot(for configuration: StreakWidgetConfiguration, in context: Context) async -> DashboardEntry {
        context.isPreview ? DashboardEntry(date: .now, snapshot: .preview)
            : DashboardEntry(date: .now, snapshot: DashboardSnapshot.read(), habitID: configuration.habit?.id)
    }
    func timeline(for configuration: StreakWidgetConfiguration, in context: Context) async -> Timeline<DashboardEntry> {
        dashboardTimeline(snapshot: DashboardSnapshot.read(), habitID: configuration.habit?.id)
    }
}

struct DashboardBackground: View {
    let accent: Color
    var body: some View {
        // The Live Activity's night, so every Habyss widget reads as one family.
        HabyssNightBackground()
    }
}

struct HabitHeatmapView: View {
    let entry: DashboardEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let today = widgetDayKey(entry.date)
        // One habit when one is chosen (Edit Widget), else every habit together.
        let habit = entry.habitID.flatMap { id in entry.snapshot?.habits?.first { $0.id == id } }
        let heatmap: [HeatmapDay] = habit.map { habit in
            zip(entry.snapshot?.heatmap ?? [], habit.days).map { day, mark in
                HeatmapDay(date: day.date, completed: mark == "1" ? 1 : 0, total: mark == "-" ? 0 : 1)
            }
        } ?? entry.snapshot?.heatmap ?? []
        let cells = Array(heatmap.filter { $0.date <= today })
        let streak = habit.map(\.streak) ?? entry.snapshot?.streak
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Image(systemName: "flame.fill").font(.system(size: 15)).foregroundStyle(entry.accent)
                    Text(streak.map(String.init) ?? "—").font(.system(size: 26, weight: .bold)).foregroundStyle(.white).monospacedDigit()
                    Text("day streak").font(.system(size: 12, weight: .medium)).foregroundStyle(Habyss.dim)
                    Spacer(minLength: 0)
                }
                if let habit {
                    Text(habit.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
                }
            }
            if cells.isEmpty {
                Spacer(minLength: 0)
                Text("Your story starts here").font(.system(size: 12, weight: .medium)).foregroundStyle(.white)
                Text("Open Habyss to sync your habits.").font(.system(size: 11)).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
            } else {
                // Fills the widget edge to edge: the rows set the square's size
                // from the height, then as many weeks as fit across are shown,
                // spread evenly so there is no empty strip on the right.
                GeometryReader { geometry in
                    let gap: CGFloat = 3
                    let fromHeight = (geometry.size.height - gap * 6) / 7
                    let columns = max(1, min(Int(ceil(Double(cells.count) / 7)), Int((geometry.size.width + gap) / (fromHeight + gap))))
                    let size = max(2, min(fromHeight, (geometry.size.width - CGFloat(columns - 1) * gap) / CGFloat(columns)))
                    let shown = Array(cells.suffix(columns * 7))
                    HStack(alignment: .top, spacing: 0) {
                        ForEach(0..<columns, id: \.self) { column in
                            if column > 0 { Spacer(minLength: gap) }
                            VStack(spacing: gap) {
                                ForEach(0..<7, id: \.self) { row in
                                    let index = column * 7 + row
                                    if index < shown.count {
                                        let cell = shown[index]
                                        let fraction = cell.total > 0 ? min(1, Double(cell.completed) / Double(cell.total)) : 0
                                        RoundedRectangle(cornerRadius: size * 0.28)
                                            .fill(cell.completed > 0 ? entry.accent.opacity(0.3 + 0.7 * fraction) : Color.white.opacity(0.07))
                                            .frame(width: size, height: size)
                                            .overlay(RoundedRectangle(cornerRadius: size * 0.28).stroke(cell.date == today ? Color.white.opacity(0.8) : .clear, lineWidth: 1))
                                            .accessibilityLabel("\(cell.date): \(cell.completed) of \(cell.total) habits")
                                    }
                                }
                            }
                        }
                    }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                if entry.snapshot?.dayKey != today {
                    Text("Open Habyss to refresh").font(.system(size: 9)).foregroundStyle(Habyss.faint).lineLimit(1)
                }
            }
        }
        .padding(14)
        .widgetURL(URL(string: "habyss://progress"))
    }
}

struct HabyssHeatmapWidget: Widget {
    var body: some WidgetConfiguration {
        // The same kind as before, so widgets already placed keep working (no habit chosen: every habit).
        AppIntentConfiguration(kind: "HabyssHeatmap", intent: StreakWidgetConfiguration.self, provider: StreakWidgetProvider()) { entry in
            HabitHeatmapView(entry: entry).containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Heatmap & Streak")
        .description("Your daily streak and the check-ins that built it. Choose one habit with Edit Widget.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
// MARK: - Streak: the flame and the days

/// The fire's two colours: warm at the base, bright at the tip.
private let flameColors = [Color(.sRGB, red: 1.0, green: 0.36, blue: 0.13), Color(.sRGB, red: 1.0, green: 0.72, blue: 0.25)]

/// The streak and the last seven days, for every habit or the one chosen.
private struct StreakFacts {
    let streak: Int?
    let habitName: String?
    /// Oldest first, today last: true done, false due and missed, nil nothing due.
    let week: [Bool?]
    init(_ entry: DashboardEntry) {
        let today = widgetDayKey(entry.date)
        let habit = entry.habitID.flatMap { id in entry.snapshot?.habits?.first { $0.id == id } }
        let heatmap = entry.snapshot?.heatmap ?? []
        habitName = habit?.name
        streak = habit.map(\.streak) ?? entry.snapshot?.streak
        let marks: [(String, Bool?)] = habit.map { habit in
            zip(heatmap, habit.days).map { day, mark in (day.date, mark == "-" ? nil : mark == "1") }
        } ?? heatmap.map { ($0.date, $0.total == 0 ? nil : $0.completed > 0) }
        week = Array(marks.filter { $0.0 <= today }.suffix(7).map(\.1))
    }
}

struct StreakFlameView: View {
    let entry: DashboardEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let facts = StreakFacts(entry)
        let days = facts.streak.map(String.init) ?? "—"
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "flame.fill").font(.system(size: 13, weight: .semibold))
                    Text(days).font(.system(size: 18, weight: .bold)).monospacedDigit()
                }
            }
            .accessibilityLabel("\(days) day streak")
        case .accessoryInline:
            Label("\(days) day streak", systemImage: "flame.fill")
        case .accessoryRectangular:
            HStack(spacing: 6) {
                Image(systemName: "flame.fill").font(.system(size: 22, weight: .semibold))
                VStack(alignment: .leading, spacing: 0) {
                    Text(days).font(.system(size: 22, weight: .bold)).monospacedDigit()
                    Text(facts.habitName ?? "day streak").font(.caption).lineLimit(1)
                }
            }
        case .systemMedium:
            HStack(spacing: 18) {
                flame(size: 54)
                VStack(alignment: .leading, spacing: 2) {
                    Text((facts.habitName ?? "Streak").uppercased()).font(WidgetType.eyebrow).tracking(1.6).foregroundStyle(Habyss.dim).lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(days).font(.system(size: 44, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                        Text(facts.streak == 1 ? "day" : "days").font(.system(size: 17, weight: .medium)).foregroundStyle(Habyss.dim)
                    }
                    WeekDots(week: facts.week, accent: flameColors[0]).padding(.top, 6)
                }
                Spacer(minLength: 0)
            }
            .padding(18)
        default:
            VStack(alignment: .leading, spacing: 0) {
                flame(size: 40)
                Spacer(minLength: 4)
                Text(days).font(.system(size: 46, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(facts.habitName ?? "day streak")
                    .font(WidgetType.meta).foregroundStyle(Habyss.dim).lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    /// The flame, lit: its gradient, a glow under it when the streak is alive.
    private func flame(size: CGFloat) -> some View {
        let alive = (StreakFacts(entry).streak ?? 0) > 0
        return Image(systemName: "flame.fill")
            .font(.system(size: size * 0.78, weight: .semibold))
            .foregroundStyle(alive ? AnyShapeStyle(LinearGradient(colors: flameColors, startPoint: .bottom, endPoint: .top)) : AnyShapeStyle(Color.white.opacity(0.25)))
            .shadow(color: alive ? flameColors[0].opacity(0.55) : .clear, radius: size * 0.22)
            .frame(width: size, height: size, alignment: .leading)
            .accessibilityHidden(true)
    }
}

/// The last seven days as dots: lit when done, a ring when missed, faint when nothing was due.
private struct WeekDots: View {
    let week: [Bool?]
    let accent: Color
    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                Group {
                    if day == true { Circle().fill(accent) }
                    else if day == false { Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1.2) }
                    else { Circle().fill(Color.white.opacity(0.08)) }
                }
                .frame(width: 11, height: 11)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Last 7 days: \(week.filter { $0 == true }.count) done")
    }
}

struct HabyssStreakFlameWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "HabyssStreak", intent: StreakWidgetConfiguration.self, provider: StreakWidgetProvider()) { entry in
            StreakFlameView(entry: entry)
                .widgetURL(URL(string: "habyss://progress"))
                .containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Streak")
        .description("Your streak, the flame and the days. Choose one habit with Edit Widget.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - Friends: the Marks race (Community's, lib/widgetRace.ts)

struct WidgetRacer: Codable, Identifiable {
    let id: String
    let name: String
    let initials: String
    let marks: Int
    let series: [Int]
    let me: Bool
    let rank: Int
}
struct WidgetRaceData: Codable {
    let version: Int
    let at: String
    let racers: [WidgetRacer]
    static func read() -> WidgetRaceData? {
        guard let raw = UserDefaults(suiteName: "group.com.habyss.data")?.string(forKey: "widgetRace"),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(Self.self, from: data), decoded.version == 1 else { return nil }
        return decoded
    }
    var mine: WidgetRacer? { racers.first { $0.me } }
    var size: Int { racers.count }

    static var preview: WidgetRaceData {
        func climb(_ start: Int, _ step: Int, _ wobble: Int) -> [Int] { (0..<30).map { start + $0 * step + ($0 * wobble) % 7 } }
        return WidgetRaceData(version: 1, at: "", racers: [
            WidgetRacer(id: "a", name: "Mia", initials: "M", marks: 420, series: climb(150, 9, 3), me: false, rank: 1),
            WidgetRacer(id: "b", name: "Leo", initials: "L", marks: 330, series: climb(170, 5, 5), me: false, rank: 3),
            WidgetRacer(id: "c", name: "Sam", initials: "S", marks: 250, series: climb(120, 4, 2), me: false, rank: 4),
            WidgetRacer(id: "me", name: "You", initials: "Y", marks: 380, series: climb(90, 10, 4), me: true, rank: 2),
        ])
    }
}

struct RaceEntry: TimelineEntry {
    let date: Date
    let race: WidgetRaceData?
    let accent: Color
}
struct RaceProvider: TimelineProvider {
    private func current(_ preview: Bool = false) -> RaceEntry {
        let snapshot = DashboardSnapshot.read()
        return RaceEntry(date: .now, race: preview ? .preview : WidgetRaceData.read(), accent: Habyss.accent(from: snapshot?.accent.from, to: snapshot?.accent.to))
    }
    func placeholder(in context: Context) -> RaceEntry { current(true) }
    func getSnapshot(in context: Context, completion: @escaping (RaceEntry) -> Void) { completion(current(context.isPreview)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RaceEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(60 * 60))))
    }
}

/// One line per person on one scale, the last 30 days, a face at the end of each.
/// Yours in the accent with a glow under it; your friends' in silver.
private struct RaceGraph: View {
    let racers: [WidgetRacer]
    let accent: Color
    var faces = true
    var body: some View {
        GeometryReader { geometry in
            let face: CGFloat = faces ? 24 : 0
            let width = geometry.size.width - (faces ? face / 2 + 2 : 4)
            let height = geometry.size.height
            let days = max(2, racers.map(\.series.count).max() ?? 2)
            let values = racers.flatMap(\.series)
            let low = Double(values.min() ?? 0), high = Double(max((values.max() ?? 1), (values.min() ?? 0) + 1))
            let pad = faces ? face / 2 : 4
            let point = { (index: Int, count: Int, value: Int) -> CGPoint in
                let x = width * CGFloat(days - count + index) / CGFloat(days - 1)
                let y = pad + (height - pad * 2) * CGFloat(1 - (Double(value) - low) / (high - low))
                return CGPoint(x: x, y: y)
            }
            let ordered = racers.sorted { !$0.me && $1.me }
            let ends = spread(ordered.map { racer in (racer.id, point(racer.series.count - 1, racer.series.count, racer.series.last ?? racer.marks).y) }, gap: face + 2, low: pad, high: height - pad)
            ZStack(alignment: .topLeading) {
                ForEach(ordered) { racer in
                    let points = racer.series.enumerated().map { point($0.offset, racer.series.count, $0.element) }
                    if racer.me, points.count > 1 {
                        smooth(points, closingTo: height).fill(LinearGradient(colors: [accent.opacity(0.30), accent.opacity(0)], startPoint: .top, endPoint: .bottom))
                    }
                    smooth(points).stroke(racer.me ? accent : Color.white.opacity(0.32), style: StrokeStyle(lineWidth: racer.me ? 2.5 : 1.5, lineCap: .round, lineJoin: .round))
                        .shadow(color: racer.me ? accent.opacity(0.6) : .clear, radius: 4)
                }
                if faces {
                    ForEach(ordered) { racer in
                        let size: CGFloat = racer.me ? face + 4 : face
                        Text(racer.initials).font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                            .frame(width: size, height: size)
                            .background(Circle().fill(racer.me ? AnyShapeStyle(accent) : AnyShapeStyle(Color(white: 0.22))))
                            .overlay(Circle().stroke(Color.white.opacity(racer.me ? 0.6 : 0.15), lineWidth: 1))
                            .position(x: width, y: ends[racer.id] ?? height / 2)
                    }
                } else if let me = ordered.last(where: \.me), let last = me.series.last {
                    Circle().fill(accent).frame(width: 7, height: 7).shadow(color: accent, radius: 3)
                        .position(point(me.series.count - 1, me.series.count, last))
                }
            }
        }
        .accessibilityElement()
        .accessibilityLabel(racers.sorted { $0.rank < $1.rank }.map { "\($0.me ? "You" : $0.name) \($0.marks)" }.joined(separator: ", "))
    }

    /// Faces never on top of each other: pushed apart, kept inside.
    private func spread(_ ends: [(String, CGFloat)], gap: CGFloat, low: CGFloat, high: CGFloat) -> [String: CGFloat] {
        var sorted = ends.sorted { $0.1 < $1.1 }
        for i in sorted.indices.dropFirst() where sorted[i].1 - sorted[i - 1].1 < gap { sorted[i].1 = sorted[i - 1].1 + gap }
        if let last = sorted.last, last.1 > high {
            let shift = last.1 - high
            sorted = sorted.map { ($0.0, max(low, $0.1 - shift)) }
        }
        return Dictionary(uniqueKeysWithValues: sorted.map { ($0.0, $0.1) })
    }

    /// Through every point, each corner softened (quad curves via the midpoints).
    private func smooth(_ points: [CGPoint], closingTo bottom: CGFloat? = nil) -> Path {
        Path { path in
            guard let first = points.first else { return }
            path.move(to: first)
            if points.count > 2 {
                for i in 1..<points.count - 1 {
                    let mid = CGPoint(x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2)
                    path.addQuadCurve(to: mid, control: points[i])
                }
            }
            if let last = points.last { path.addLine(to: last) }
            if let bottom, let last = points.last {
                path.addLine(to: CGPoint(x: last.x, y: bottom))
                path.addLine(to: CGPoint(x: first.x, y: bottom))
                path.closeSubpath()
            }
        }
    }
}

struct FriendsRaceView: View {
    let entry: RaceEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        if let race = entry.race, let me = race.mine, race.racers.count > 0 {
            switch family {
            case .systemSmall:
                VStack(alignment: .leading, spacing: 0) {
                    Text("MARKS").font(WidgetType.eyebrow).tracking(1.6).foregroundStyle(Habyss.dim)
                    Text("\(me.marks)").font(.system(size: 30, weight: .bold)).monospacedDigit().foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
                    Text("#\(me.rank) of \(race.size) friends").font(WidgetType.meta).foregroundStyle(Habyss.dim)
                    RaceGraph(racers: race.racers, accent: entry.accent, faces: false).padding(.top, 8)
                }
                .padding(15)
            case .systemLarge:
                VStack(alignment: .leading, spacing: 12) {
                    header(race, me)
                    RaceGraph(racers: race.racers, accent: entry.accent).frame(height: 150)
                    Rectangle().fill(Habyss.line).frame(height: 1)
                    VStack(spacing: 8) {
                        ForEach(race.racers.sorted { $0.rank < $1.rank }) { racer in
                            HStack(spacing: 10) {
                                Text("\(racer.rank)").font(.system(size: 13, weight: .semibold)).monospacedDigit().foregroundStyle(Habyss.dim).frame(width: 18, alignment: .leading)
                                Text(racer.initials).font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                                    .frame(width: 24, height: 24)
                                    .background(Circle().fill(racer.me ? AnyShapeStyle(entry.accent) : AnyShapeStyle(Color(white: 0.22))))
                                Text(racer.me ? "You" : racer.name).font(.system(size: 14, weight: racer.me ? .bold : .medium)).foregroundStyle(.white).lineLimit(1)
                                Spacer(minLength: 0)
                                Text("\(racer.marks)").font(.system(size: 14, weight: .semibold)).monospacedDigit().foregroundStyle(racer.me ? entry.accent : .white)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(16)
            default:
                VStack(alignment: .leading, spacing: 10) {
                    header(race, me)
                    RaceGraph(racers: race.racers, accent: entry.accent)
                }
                .padding(15)
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("FRIENDS").font(WidgetType.eyebrow).tracking(1.6).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
                Image(systemName: "person.2.fill").font(.system(size: 22, weight: .light)).foregroundStyle(entry.accent)
                Text("The race starts here").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                Text("Open Community to load it").font(WidgetType.meta).foregroundStyle(Habyss.dim)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
        }
    }

    private func header(_ race: WidgetRaceData, _ me: WidgetRacer) -> some View {
        WidgetHeader(eyebrow: "Friends", title: "\(me.marks) Marks") {
            WidgetPill(text: "#\(me.rank) of \(race.size)", tint: me.rank == 1 ? entry.accent : .white)
        }
    }
}

struct HabyssFriendsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssFriends", provider: RaceProvider()) { entry in
            FriendsRaceView(entry: entry)
                .widgetURL(URL(string: "habyss://community"))
                .containerBackground(for: .widget) { HabyssNightBackground() }
        }
        .contentMarginsDisabled()
        .configurationDisplayName("Friends")
        .description("Your Marks against your friends' over the last month.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

extension DashboardSnapshot {
    static var preview: DashboardSnapshot {
        let today = widgetDayKey()
        let heatmap = (0..<91).map { offset in
            HeatmapDay(date: widgetDayKey(Calendar.current.date(byAdding: .day, value: offset - 90, to: .now)!),
                       completed: offset > 80 ? 3 : (offset * 7 + offset / 3) % 4, total: 3)
        }
        // The gallery wears the person's own accent, like the widgets they already have.
        let accent = DashboardSnapshot.read()?.accent ?? .init(from: "#4268FF", to: "#7098FF")
        return DashboardSnapshot(version: 1, generatedAt: today, dayKey: today,
                                 accent: accent, days: [], heatmap: heatmap,
                                 streak: 10)
    }
}

#if DEBUG
#Preview(as: .systemSmall) { HabyssHeatmapWidget() } timeline: { DashboardEntry(date: .now, snapshot: .preview) }
#endif

import WidgetKit
import SwiftUI

// MARK: - Shards balance (lib/widgetDay.ts buildWidgetShards writes it)

struct WidgetShardsData: Codable {
    let version: Int
    let balance: Int
    let today: Int
    let line: [Int]
    let at: Double

    static func read() -> WidgetShardsData? {
        guard let raw = UserDefaults(suiteName: "group.com.habyss.data")?.string(forKey: "widgetShards"),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(Self.self, from: data), decoded.version == 1 else { return nil }
        return decoded
    }
}

struct ShardsEntry: TimelineEntry {
    let date: Date
    let data: WidgetShardsData?
    let accent: Color
    /// "Today" is only today's if it was written today.
    var today: Int {
        guard let data, widgetDayKey(Date(timeIntervalSince1970: data.at / 1000)) == widgetDayKey(date) else { return 0 }
        return data.today
    }
    static let up = Habyss.done
    static let down = Color(.sRGB, red: 1.0, green: 0.27, blue: 0.23)
    var tone: Color { today > 0 ? Self.up : today < 0 ? Self.down : Habyss.dim }

    static var preview: ShardsEntry {
        ShardsEntry(date: .now, data: WidgetShardsData(version: 1, balance: 132, today: 12,
            line: [100, 100, 104, 104, 110, 110, 112, 118, 118, 120, 120, 126, 132], at: Date().timeIntervalSince1970 * 1000),
            accent: Habyss.accent(from: nil, to: nil))
    }
}

struct ShardsProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShardsEntry { .preview }
    func getSnapshot(in context: Context, completion: @escaping (ShardsEntry) -> Void) {
        completion(context.isPreview ? .preview : entry(.now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ShardsEntry>) -> Void) {
        // The app writes a new balance as it moves; midnight resets "today".
        let start = Calendar.current.startOfDay(for: .now)
        let midnight = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry(.now), entry(midnight.addingTimeInterval(1))], policy: .atEnd))
    }
    private func entry(_ date: Date) -> ShardsEntry {
        let snapshot = DashboardSnapshot.read()
        return ShardsEntry(date: date, data: WidgetShardsData.read(), accent: Habyss.accent(from: snapshot?.accent.from, to: snapshot?.accent.to))
    }
}

/// The balance's last day as the app draws it: one line, green when up, red when down, fading below.
private struct ShardsLine: View {
    let values: [Int]
    let color: Color
    var body: some View {
        GeometryReader { geometry in
            let low = Double(values.min() ?? 0)
            let high = Double(values.max() ?? 1)
            let span = max(1, high - low)
            let points = values.enumerated().map { index, value in
                CGPoint(x: values.count > 1 ? geometry.size.width * CGFloat(index) / CGFloat(values.count - 1) : 0,
                        y: geometry.size.height * (1 - CGFloat((Double(value) - low) / span) * 0.85) - 2)
            }
            ZStack {
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: CGPoint(x: first.x, y: geometry.size.height))
                    points.forEach { path.addLine(to: $0) }
                    path.addLine(to: CGPoint(x: points.last?.x ?? 0, y: geometry.size.height))
                    path.closeSubpath()
                }
                .fill(LinearGradient(colors: [color.opacity(0.28), color.opacity(0)], startPoint: .top, endPoint: .bottom))
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    points.dropFirst().forEach { path.addLine(to: $0) }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                if let last = points.last {
                    Circle().fill(color).frame(width: 7, height: 7).position(last)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

struct ShardsWidgetView: View {
    let entry: ShardsEntry
    @Environment(\.widgetFamily) var family

    private var balance: String { entry.data.map { $0.balance.formatted() } ?? "—" }
    private var change: String {
        entry.today == 0 ? "Nothing yet today" : "\(entry.today > 0 ? "+" : "−")\(abs(entry.today)) today"
    }

    private var heading: some View {
        HStack(spacing: 5) {
            Image(systemName: "diamond.fill").font(.system(size: 11, weight: .semibold)).foregroundStyle(entry.accent)
            Text("Shards").font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundStyle(Habyss.dim)
        }
    }
    private var figure: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(balance)
                .font(.system(size: family == .systemSmall ? 34 : 38, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Text(change).font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundStyle(entry.tone).lineLimit(1)
        }
    }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("\(balance) Shards")
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Shards").font(.caption.weight(.semibold))
                Text(balance).font(.title2.weight(.bold)).monospacedDigit()
                Text(change).font(.caption)
            }
        case .systemMedium:
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    heading
                    Spacer(minLength: 0)
                    figure
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ShardsLine(values: entry.data?.line ?? [], color: entry.today < 0 ? ShardsEntry.down : ShardsEntry.up)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .padding(16)
        default:
            VStack(alignment: .leading, spacing: 6) {
                heading
                ShardsLine(values: entry.data?.line ?? [], color: entry.today < 0 ? ShardsEntry.down : ShardsEntry.up)
                    .frame(maxHeight: .infinity)
                figure
            }
            .padding(14)
        }
    }
}

struct HabyssShardsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssShards", provider: ShardsProvider()) { entry in
            ShardsWidgetView(entry: entry)
                .widgetURL(URL(string: "habyss://home"))
                .containerBackground(for: .widget) { HabyssNightBackground() }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(entry.data?.balance ?? 0) Shards")
        }
        .contentMarginsDisabled()
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
        .configurationDisplayName("Shards")
        .description("Your Shards balance and how it moved today.")
    }
}

#Preview("Small", as: .systemSmall) { HabyssShardsWidget() } timeline: { ShardsEntry.preview }
#Preview("Medium", as: .systemMedium) { HabyssShardsWidget() } timeline: { ShardsEntry.preview }

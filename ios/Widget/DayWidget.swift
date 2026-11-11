import WidgetKit
import SwiftUI

// MARK: - Today's timeline (lib/widgetDay.ts writes it)

struct WidgetDayItem: Codable, Identifiable, Hashable {
    let id: String
    let kind: String
    let title: String
    let start: Int
    let end: Int
    let done: Bool
    let color: String?
}

struct WidgetDayData: Codable {
    let version: Int
    let day: String
    let wake: Int
    let sleep: Int
    let items: [WidgetDayItem]

    static func read() -> WidgetDayData? {
        guard let raw = UserDefaults(suiteName: "group.com.habyss.data")?.string(forKey: "widgetDay"),
              let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(Self.self, from: data), decoded.version == 1 else { return nil }
        return decoded
    }
}

/// The Live Activity's background, on every Habyss widget: a little of the focus
/// page's night sky at the top, black below.
struct HabyssNightBackground: View {
    var body: some View {
        LinearGradient(colors: [Habyss.night, .black], startPoint: .top, endPoint: .bottom)
    }
}

/// "9:30", "14:05": the phone's own clock style.
func widgetClock(_ minutes: Int, on date: Date = Date()) -> String {
    let start = Calendar.current.startOfDay(for: date)
    let moment = start.addingTimeInterval(TimeInterval(minutes * 60))
    let clock = DateFormatter()
    clock.dateFormat = DateFormatter.dateFormat(fromTemplate: "j:mm", options: 0, locale: .current)
    return clock.string(from: moment)
}

func widgetKindIcon(_ kind: String) -> String {
    switch kind {
    case "habit": return "repeat"
    case "event": return "calendar"
    case "meal": return "fork.knife"
    default: return "checklist"
    }
}

struct DayEntry: TimelineEntry {
    let date: Date
    let data: WidgetDayData?
    let accent: Color

    var minute: Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }
    /// Written today: an older day means the app has not run since midnight.
    var fresh: Bool { data?.day == widgetDayKey(date) }
    var items: [WidgetDayItem] { fresh ? data?.items ?? [] : [] }
    /// The day is done: past bedtime (bedtime after midnight counts as that night).
    var night: Bool {
        guard let data, fresh else { return false }
        if data.sleep == data.wake { return false }
        return data.sleep > data.wake ? minute >= data.sleep : (minute >= data.sleep && minute < data.wake)
    }
    /// On now, unfinished.
    var current: WidgetDayItem? { items.first { !$0.done && $0.start <= minute && minute < $0.end } }
    /// Still to come after `current`, done or not, in order.
    var rest: [WidgetDayItem] {
        items.filter { $0.id != current?.id && $0.end > minute }
    }
    var left: Int { items.filter { !$0.done }.count }
    func color(_ item: WidgetDayItem) -> Color { Color(habyssHex: item.color) ?? accent }
    func at(_ minutes: Int) -> Date { Calendar.current.startOfDay(for: date).addingTimeInterval(TimeInterval(minutes * 60)) }

    static var preview: DayEntry {
        let now = Calendar.current.dateComponents([.hour, .minute], from: .now)
        let m = (now.hour ?? 9) * 60 + (now.minute ?? 0)
        let items = [
            WidgetDayItem(id: "1", kind: "task", title: "Send the project update", start: m - 20, end: m + 25, done: false, color: nil),
            WidgetDayItem(id: "2", kind: "event", title: "Team standup", start: m + 30, end: m + 45, done: false, color: "#5E5CE6"),
            WidgetDayItem(id: "3", kind: "habit", title: "Read", start: m + 45, end: m + 75, done: false, color: "#30D158"),
            WidgetDayItem(id: "4", kind: "meal", title: "Lunch", start: m + 90, end: m + 135, done: false, color: "#FF9F0A"),
            WidgetDayItem(id: "5", kind: "task", title: "Review the draft", start: m + 140, end: m + 200, done: false, color: nil),
            WidgetDayItem(id: "6", kind: "habit", title: "Walk", start: m + 210, end: m + 240, done: false, color: "#64D2FF"),
        ]
        return DayEntry(date: .now, data: WidgetDayData(version: 1, day: widgetDayKey(), wake: 420, sleep: 1380, items: items),
                        accent: Habyss.accent(from: nil, to: nil))
    }
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { .preview }
    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(context.isPreview ? .preview : entry(at: .now))
    }
    /// One entry now and one at every start and end left today, so "now" moves on
    /// with the clock without the app running; then again after midnight.
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let data = WidgetDayData.read()
        let accent = accentColor()
        let now = Date()
        let start = Calendar.current.startOfDay(for: now)
        var moments = Set<Int>()
        for item in data?.items ?? [] { moments.insert(item.start); moments.insert(item.end) }
        if let data { moments.insert(data.sleep) }
        let later = moments.map { start.addingTimeInterval(TimeInterval($0 * 60)) }.filter { $0 > now }.sorted().prefix(60)
        let entries = [DayEntry(date: now, data: data, accent: accent)] + later.map { DayEntry(date: $0, data: data, accent: accent) }
        let midnight = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(60))))
    }
    private func entry(at date: Date) -> DayEntry { DayEntry(date: date, data: WidgetDayData.read(), accent: accentColor()) }
    private func accentColor() -> Color {
        let snapshot = DashboardSnapshot.read()
        return Habyss.accent(from: snapshot?.accent.from, to: snapshot?.accent.to)
    }
}

// MARK: - Pieces

/// What is on now (or next): its kind and time, its name large, the time left filling.
private struct NowBlock: View {
    let entry: DayEntry
    var titleSize: CGFloat = 17
    var body: some View {
        if let item = entry.current ?? entry.rest.first(where: { !$0.done }) {
            let on = entry.current != nil
            let color = entry.color(item)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 5) {
                    Image(systemName: widgetKindIcon(item.kind)).font(.system(size: 11, weight: .semibold))
                    Text(on ? "Now" : "Next").font(.system(size: 12, weight: .semibold, design: .rounded))
                    Spacer(minLength: 0)
                    Text(widgetClock(item.start)).font(.system(size: 11, weight: .medium, design: .rounded)).foregroundStyle(Habyss.dim)
                }
                .foregroundStyle(color)
                Text(item.title)
                    .font(.system(size: titleSize, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 2)
                if on {
                    // The time left, counting down live, and the bar filling as it goes.
                    Text(timerInterval: Date()...entry.at(item.end), countsDown: true)
                        .font(.system(size: titleSize + 7, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    ProgressView(timerInterval: entry.at(item.start)...entry.at(item.end), countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                        .progressViewStyle(.linear)
                        .tint(color)
                } else {
                    Text("Until \(widgetClock(item.end))").font(.system(size: 12, weight: .medium, design: .rounded)).foregroundStyle(Habyss.dim)
                }
            }
        } else {
            DayMessage(entry: entry)
        }
    }
}

/// The day empty, finished, done for the night, or not yet synced today.
private struct DayMessage: View {
    let entry: DayEntry
    var body: some View {
        let (icon, title, subtitle): (String, String, String) =
            entry.night ? ("moon.fill", "The day is done", "Rest. Tomorrow is planned.")
            : !entry.fresh ? ("arrow.triangle.2.circlepath", "Let’s bring today in", "Open Habyss to sync")
            : entry.items.isEmpty ? ("sparkles", "Nothing planned", "Add something in Habyss")
            : ("checkmark.circle.fill", "All done", "The rest of the day is yours")
        VStack(alignment: .leading, spacing: 4) {
            Spacer(minLength: 0)
            Image(systemName: icon).font(.system(size: 22, weight: .light)).foregroundStyle(entry.accent).padding(.bottom, 2)
            Text(title).font(.system(size: 15, weight: .semibold, design: .rounded)).foregroundStyle(.white)
            Text(subtitle).font(.system(size: 11, weight: .medium)).foregroundStyle(Habyss.dim)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// One row of the rest of the day, like the app's timeline: the time, the item's
/// colour as a pill on the rail, its name (struck through once done).
private struct DayRow: View {
    let entry: DayEntry
    let item: WidgetDayItem
    var compact = false
    var body: some View {
        let color = entry.color(item)
        HStack(spacing: 8) {
            Text(widgetClock(item.start))
                .font(.system(size: compact ? 11 : 12, weight: .medium, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Habyss.dim)
                .frame(width: compact ? 38 : 44, alignment: .leading)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Capsule().fill(item.done ? Habyss.faint : color).frame(width: 4, height: compact ? 16 : 20)
            Image(systemName: widgetKindIcon(item.kind))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(item.done ? Habyss.faint : color)
                .frame(width: 14)
            Text(item.title)
                .font(.system(size: compact ? 12 : 13, weight: .medium, design: .rounded))
                .strikethrough(item.done, color: Habyss.dim)
                .foregroundStyle(item.done ? Habyss.dim : .white)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct DayHeader: View {
    let entry: DayEntry
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Today").font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(.white)
            Spacer(minLength: 4)
            if entry.fresh && !entry.items.isEmpty && !entry.night {
                Text(entry.left == 0 ? "All done" : "\(entry.left) left")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(entry.left == 0 ? Habyss.done : entry.accent)
            }
        }
    }
}

// MARK: - The widget

struct DayWidgetView: View {
    let entry: DayEntry
    @Environment(\.widgetFamily) var family

    /// After what is on now: the next ones still to come.
    private func upcoming(_ count: Int) -> [WidgetDayItem] {
        let skip = entry.current == nil ? entry.rest.first(where: { !$0.done })?.id : nil
        return Array(entry.rest.filter { $0.id != skip }.prefix(count))
    }

    var body: some View {
        switch family {
        case .systemSmall:
            NowBlock(entry: entry, titleSize: 16).padding(14)
        case .systemMedium:
            HStack(alignment: .top, spacing: 14) {
                NowBlock(entry: entry, titleSize: 16).frame(maxWidth: .infinity)
                if !entry.night && entry.fresh && !upcoming(3).isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Then").font(.system(size: 12, weight: .semibold, design: .rounded)).foregroundStyle(Habyss.dim)
                        ForEach(upcoming(3)) { DayRow(entry: entry, item: $0, compact: true) }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(14)
        case .systemExtraLarge:
            VStack(alignment: .leading, spacing: 12) {
                DayHeader(entry: entry)
                HStack(alignment: .top, spacing: 20) {
                    NowBlock(entry: entry, titleSize: 22).frame(maxWidth: .infinity, maxHeight: 150, alignment: .topLeading)
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(upcoming(14)) { DayRow(entry: entry, item: $0) }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(18)
        default: // Large
            VStack(alignment: .leading, spacing: 10) {
                DayHeader(entry: entry)
                NowBlock(entry: entry, titleSize: 19).frame(height: 116)
                if !entry.night && entry.fresh && !upcoming(7).isEmpty {
                    Rectangle().fill(Habyss.line).frame(height: 1)
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(upcoming(7)) { DayRow(entry: entry, item: $0) }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
        }
    }
}

struct HabyssDayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HabyssDay", provider: DayProvider()) { entry in
            DayWidgetView(entry: entry)
                .widgetURL(URL(string: "habyss://roadmap"))
                .containerBackground(for: .widget) { HabyssNightBackground() }
        }
        .contentMarginsDisabled()
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge])
        .configurationDisplayName("Today")
        .description("What is on now, and the rest of your day.")
    }
}

#Preview("Small", as: .systemSmall) { HabyssDayWidget() } timeline: { DayEntry.preview }
#Preview("Medium", as: .systemMedium) { HabyssDayWidget() } timeline: { DayEntry.preview }
#Preview("Large", as: .systemLarge) { HabyssDayWidget() } timeline: { DayEntry.preview }

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

/// "9:30", "14:05": the phone's clock without AM/PM, for lists where the order says it.
func widgetShortClock(_ minutes: Int) -> String {
    let h = minutes / 60 % 24, m = minutes % 60
    let twelve = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: .current)?.contains("a") ?? false
    return String(format: "%d:%02d", twelve ? (h % 12 == 0 ? 12 : h % 12) : h, m)
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
    /// How far through `item` this entry is, 0–1 (0 for an item with no length).
    func progress(_ item: WidgetDayItem) -> Double {
        let span = Double(item.end - item.start)
        guard span > 0 else { return 0 }
        let elapsed = date.timeIntervalSince(at(item.start)) / 60
        return min(1, max(0, elapsed / span))
    }
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
        for item in data?.items ?? [] {
            moments.insert(item.start); moments.insert(item.end)
            // Every 5 minutes inside it, so the bar of what is on now fills without the app.
            if item.end > item.start + 5 { for minute in stride(from: item.start + 5, to: item.end, by: 5) { moments.insert(minute) } }
        }
        if let data { moments.insert(data.sleep) }
        let later = moments.map { start.addingTimeInterval(TimeInterval($0 * 60)) }.filter { $0 > now }.sorted().prefix(150)
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

// MARK: - Pieces (the widget kit, HabyssWidget.swift)

/// "▶ NOW" (or "NEXT"), in the accent.
private struct NowEyebrow: View {
    let on: Bool
    let accent: Color
    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "play.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(accent)
            Text(on ? "NOW" : "NEXT").font(WidgetType.eyebrow).tracking(1.8).foregroundStyle(Habyss.dim)
        }
        .accessibilityElement(children: .combine)
    }
}

/// What is on now (or next): its name large, the time left counting down, the bar filling.
private struct NowBlock: View {
    let entry: DayEntry
    var titleSize: CGFloat = 18
    var figureSize: CGFloat = 26
    var body: some View {
        if let item = entry.current ?? entry.rest.first(where: { !$0.done }) {
            let on = entry.current != nil
            VStack(alignment: .leading, spacing: 0) {
                NowEyebrow(on: on, accent: entry.accent)
                Text(item.title)
                    .font(.system(size: titleSize, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 6)
                Spacer(minLength: 6)
                // Live without the app: counts down to its end (on now) or its start (next).
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    // Never a range that ends before it starts (a stale entry drawn late): the Live Activity's guard.
                    let target = entry.at(on ? item.end : item.start)
                    Text(timerInterval: min(entry.date, target)...target, countsDown: true)
                        .font(.system(size: figureSize, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .fixedSize()
                    Text(on ? "left" : "to go").font(.system(size: figureSize * 0.62, weight: .regular)).foregroundStyle(Habyss.dim)
                }
                if on {
                    // The widgets' own bar, not ProgressView(timerInterval:): the system's live bar
                    // crashed the widget renderer (a SwiftUI layout assertion). The timeline adds an
                    // entry every few minutes while something is on, so the bar still moves.
                    WidgetBar(progress: entry.progress(item), from: entry.accent, to: entry.accent)
                        .padding(.top, 8)
                } else {
                    Text("at \(widgetClock(item.start))").font(WidgetType.meta).foregroundStyle(Habyss.dim).padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
            Text(title).font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
            Text(subtitle).font(WidgetType.meta).foregroundStyle(Habyss.dim)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// "UP NEXT"
private struct UpNextLabel: View {
    var body: some View { Text("UP NEXT").font(WidgetType.eyebrow).tracking(1.8).foregroundStyle(Habyss.dim) }
}

/// One row of what comes next: a marker (the first lit), the time, the name.
private struct DayRow: View {
    let entry: DayEntry
    let item: WidgetDayItem
    let first: Bool
    var rail = false
    var compact = false
    var body: some View {
        HStack(spacing: compact ? 9 : 12) {
            Group {
                if rail {
                    Circle().fill(first ? entry.accent : Color.white.opacity(0.22)).frame(width: first ? 11 : 9, height: first ? 11 : 9)
                } else {
                    Capsule().fill(first ? entry.accent : Color.white.opacity(0.22)).frame(width: 4, height: 15)
                }
            }
            .frame(width: 12)
            Text(widgetShortClock(item.start))
                .font(.system(size: compact ? 13 : 14, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Habyss.dim)
                .lineLimit(1)
                .frame(width: compact ? 38 : 44, alignment: .leading)
                .minimumScaleFactor(0.8)
            Text(item.title)
                .font(.system(size: compact ? 13 : 14, weight: .medium))
                .strikethrough(item.done, color: Habyss.dim)
                .foregroundStyle(item.done ? Habyss.dim : .white)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The rows on a rail: a thin line joins the dots, like the app's timeline.
private struct UpNextList: View {
    let entry: DayEntry
    let items: [WidgetDayItem]
    var rail = false
    var compact = false
    var spacing: CGFloat = 10
    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                DayRow(entry: entry, item: item, first: index == 0, rail: rail, compact: compact)
            }
        }
        .background(alignment: .leading) {
            if rail && items.count > 1 {
                Rectangle().fill(Color.white.opacity(0.14)).frame(width: 1.5).padding(.vertical, 8).padding(.leading, 5.25)
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
    private var showsNext: Bool { !entry.night && entry.fresh }

    var body: some View {
        switch family {
        case .systemSmall:
            NowBlock(entry: entry, titleSize: 17, figureSize: 26).padding(15)
        case .systemMedium:
            HStack(alignment: .top, spacing: 14) {
                NowBlock(entry: entry, titleSize: 17, figureSize: 24).frame(maxWidth: .infinity)
                if showsNext && !upcoming(3).isEmpty {
                    Rectangle().fill(Habyss.line).frame(width: 1)
                    VStack(alignment: .leading, spacing: 11) {
                        UpNextLabel()
                        UpNextList(entry: entry, items: upcoming(3), compact: true, spacing: 9)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(15)
        case .systemExtraLarge:
            HStack(alignment: .top, spacing: 24) {
                NowBlock(entry: entry, titleSize: 24, figureSize: 36).frame(maxWidth: .infinity, maxHeight: 170, alignment: .topLeading)
                if showsNext && !upcoming(10).isEmpty {
                    Rectangle().fill(Habyss.line).frame(width: 1)
                    VStack(alignment: .leading, spacing: 12) {
                        UpNextLabel()
                        UpNextList(entry: entry, items: upcoming(10), rail: true, spacing: 12)
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(20)
        default: // Large
            VStack(alignment: .leading, spacing: 14) {
                NowBlock(entry: entry, titleSize: 22, figureSize: 34).frame(height: 132)
                if showsNext && !upcoming(5).isEmpty {
                    Rectangle().fill(Habyss.line).frame(height: 1)
                    UpNextLabel()
                    UpNextList(entry: entry, items: upcoming(5), rail: true, spacing: 12)
                }
                Spacer(minLength: 0)
            }
            .padding(18)
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

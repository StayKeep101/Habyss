//
//  Widget.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import WidgetKit
import SwiftUI
import AppIntents
import UserNotifications
import ActivityKit

// MARK: - The app's look, carried across

/// Hex as the app writes it (`#RRGGBB`), because the widget cannot import the
/// palette from JavaScript.
extension Color {
    init?(habyssHex hex: String?) {
        guard var value = hex?.trimmingCharacters(in: .whitespaces), !value.isEmpty else { return nil }
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        self.init(
            .sRGB,
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

enum Habyss {
    /// The void the app is drawn on. The widget sits on the Home Screen, so it
    /// keeps the same near-black rather than the system's translucent fill.
    static let void = Color(.sRGB, red: 0.043, green: 0.047, blue: 0.055)
    static let line = Color.white.opacity(0.10)
    static let dim = Color.white.opacity(0.55)
    /// The focus page's sky at the top of the screen, fading to black.
    static let night = Color(.sRGB, red: 0.067, green: 0.086, blue: 0.161)
    static let faint = Color.white.opacity(0.32)
    static let done = Color(.sRGB, red: 0.06, green: 0.72, blue: 0.51)
    /// Falls back to the app's default gradient, Habyss blue (#4268FF → #7098FF,
    /// context/AccentContext.tsx), when the app has not written one yet.
    static let fallbackFrom = Color(.sRGB, red: 0.259, green: 0.408, blue: 1.0)
    static let fallbackTo = Color(.sRGB, red: 0.439, green: 0.596, blue: 1.0)
    /// The app's matte card material (theme/designSystem.ts, Surfaces.abyss):
    /// lit at the top, falling off towards the bottom. Widgets and live
    /// activities sit on it so they read as part of the app.
    static let matteTop = Color(.sRGB, red: 0.094, green: 0.094, blue: 0.106)    // #18181B
    static let matteMid = Color(.sRGB, red: 0.067, green: 0.067, blue: 0.075)    // #111113
    static let matteBottom = Color(.sRGB, red: 0.047, green: 0.047, blue: 0.055) // #0C0C0E
    /// A control on the card: a step lighter, never the accent.
    static let raised = Color.white.opacity(0.08)

    /// The app's one accent colour: the middle of the theme's two gradient
    /// stops (context/AccentContext.tsx, mixHex). Using one end made the widget
    /// a different colour from every chip and ring inside the app.
    static func accent(from: String?, to: String?) -> Color {
        func rgb(_ hex: String?) -> (Double, Double, Double)? {
            guard var value = hex?.trimmingCharacters(in: .whitespaces), !value.isEmpty else { return nil }
            if value.hasPrefix("#") { value.removeFirst() }
            guard value.count == 6, let raw = UInt32(value, radix: 16) else { return nil }
            return (Double((raw >> 16) & 0xFF) / 255, Double((raw >> 8) & 0xFF) / 255, Double(raw & 0xFF) / 255)
        }
        let a = rgb(from) ?? (0.259, 0.408, 1.0)
        let b = rgb(to) ?? rgb(from) ?? (0.439, 0.596, 1.0)
        return Color(.sRGB, red: (a.0 + b.0) / 2, green: (a.1 + b.1) / 2, blue: (a.2 + b.2) / 2)
    }
}

/// A plain label, the way headings read in the app now: sentence case, no tracking.
struct SectionLabel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Habyss.dim)
    }
}

extension View {
    func sectionLabel() -> some View { modifier(SectionLabel()) }
}

// MARK: - The widget kit
// One look for every Habyss widget: the same night background, the same type
// (SF Pro: a spaced caps eyebrow, a bold title), a count in a pill, a glowing
// bar, and rows drawn as soft cards. New widgets are built from these.

enum WidgetType {
    static let eyebrow = Font.system(size: 11, weight: .semibold)
    static let title = Font.system(size: 19, weight: .bold)
    static let titleSmall = Font.system(size: 17, weight: .bold)
    static let row = Font.system(size: 13, weight: .medium)
    static let meta = Font.system(size: 12, weight: .medium)
}

/// "TODAY" over "Daily Focus", with an optional pill on the right.
struct WidgetHeader<Trailing: View>: View {
    let eyebrow: String
    let title: String
    var compact = false
    @ViewBuilder var trailing: () -> Trailing
    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow.uppercased()).font(WidgetType.eyebrow).tracking(1.6).foregroundStyle(Habyss.dim)
                Text(title).font(compact ? WidgetType.titleSmall : WidgetType.title).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            trailing()
        }
    }
}

/// A figure in a pill, "2 / 5".
struct WidgetPill: View {
    let text: String
    var tint: Color = .white
    var body: some View {
        Text(text).font(.system(size: 12, weight: .semibold)).monospacedDigit().foregroundStyle(tint)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(Color.white.opacity(0.06)))
            .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 0.75))
    }
}

/// The day's progress: a track and a fill in the accent's gradient, softly lit.
struct WidgetBar: View {
    let progress: Double
    let from: Color
    let to: Color
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.08))
                Capsule().fill(LinearGradient(colors: [from, to], startPoint: .leading, endPoint: .trailing))
                    .frame(width: progress > 0 ? max(5, geometry.size.width * progress) : 0)
                    .shadow(color: to.opacity(0.55), radius: 4)
            }
        }
        .frame(height: 5)
        .accessibilityHidden(true)
    }
}

/// A row on a soft card: a tick on the left, a name, a small icon on the right.
struct WidgetRowCard: View {
    let title: String
    let done: Bool
    let icon: String
    let accent: Color
    var height: CGFloat = 30
    /// Off on a small widget, so the name has the room.
    var showsIcon = true
    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 17, weight: .light))
                .foregroundStyle(done ? accent : Color.white.opacity(0.55))
            Text(title).font(WidgetType.row)
                .strikethrough(done, color: Habyss.dim)
                .foregroundStyle(done ? Habyss.dim : .white)
                .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
            if showsIcon {
                Image(systemName: icon).font(.system(size: 11, weight: .medium)).foregroundStyle(Habyss.dim)
                    .frame(width: 22, height: 22)
                    .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Color.white.opacity(0.05)))
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Color.white.opacity(0.08), lineWidth: 0.5))
            }
        }
        .padding(.leading, 9).padding(.trailing, showsIcon ? 5 : 9)
        .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white.opacity(0.045)))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Color.white.opacity(0.07), lineWidth: 0.75))
        .contentShape(Rectangle())
    }
}

/// "+2 more ›" at the foot of a list.
struct WidgetMore: View {
    let count: Int
    var body: some View {
        HStack(spacing: 4) {
            Text(count > 0 ? "+\(count) more" : "Open Habyss").font(WidgetType.meta).foregroundStyle(Habyss.dim)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(Habyss.dim)
        }
    }
}

/// What a row is, at a glance: from its words when they say it, else its kind.
func widgetRowIcon(id: String, title: String, time: String?) -> String {
    let words = title.lowercased()
    let guesses: [(keys: [String], icon: String)] = [
        (["send", "email", "mail", "reply", "message", "text "], "paperplane"),
        (["call", "phone", "ring "], "phone"),
        (["book", "appointment", "meeting", "meet", "dentist", "doctor"], "calendar"),
        (["plan", "organis", "organiz", "review", "prepare", "prep "], "square.stack.3d.up"),
        (["buy", "shop", "grocer", "order", "pick up"], "cart"),
        (["read", "study", "learn", "revise"], "book.closed"),
        (["write", "draft", "journal", "note"], "pencil"),
        (["run", "gym", "workout", "walk", "train", "swim", "lift", "yoga"], "figure.run"),
        (["clean", "dish", "laundry", "tidy", "wash"], "sparkles"),
        (["pay", "invoice", "bill", "bank", "budget"], "creditcard"),
        (["code", "build", "ship", "fix", "deploy"], "chevron.left.forwardslash.chevron.right"),
    ]
    if let hit = guesses.first(where: { $0.keys.contains { words.contains($0) } }) { return hit.icon }
    if id.hasPrefix("habit:") { return "repeat" }
    return time != nil ? "clock" : "arrow.up.right"
}

// MARK: - Data Model
struct HabitModel: Codable, Identifiable {
    let id: String
    let name: String
    var isCompleted: Bool
    var time: String? = nil
}

struct WidgetSummary: Codable {
    let total: Int
    let completed: Int
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry { .preview }
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(context.isPreview ? .preview : entry(at: .now, snapshot: DashboardSnapshot.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let snapshot = DashboardSnapshot.read()
        let start = Calendar.current.startOfDay(for: .now)
        let entries = (0...8).compactMap { offset -> SimpleEntry? in
            guard let date = Calendar.current.date(byAdding: .day, value: offset, to: start) else { return nil }
            return entry(at: offset == 0 ? .now : date, snapshot: snapshot)
        }
        completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(30 * 60))))
    }
    private func entry(at date: Date, snapshot: DashboardSnapshot?) -> SimpleEntry {
        let day = snapshot?.days.first { $0.date == widgetDayKey(date) }
        return SimpleEntry(date: date, habits: (day?.items ?? []).map {
            HabitModel(id: $0.id, name: $0.name, isCompleted: $0.isCompleted, time: $0.time)
        }, summary: day.map { WidgetSummary(total: $0.total, completed: $0.completed) },
            accentFrom: snapshot?.accent.from, accentTo: snapshot?.accent.to,
            dayKey: day?.date ?? snapshot?.dayKey)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let habits: [HabitModel]
    let summary: WidgetSummary?
    var accentFrom: String? = nil
    var accentTo: String? = nil
    var dayKey: String? = nil
    var needsSync: Bool { summary == nil || dayKey != Self.todayKey(date) }
    var accentSolid: Color { Habyss.accent(from: accentFrom, to: accentTo) }
    var accent: LinearGradient {
        LinearGradient(colors: [accentSolid, Color(habyssHex: accentTo) ?? Habyss.fallbackTo], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    static func todayKey(_ date: Date = .now) -> String { widgetDayKey(date) }
    static var preview: SimpleEntry {
        SimpleEntry(date: .now, habits: [
            HabitModel(id: "preview:1", name: "Send the project update", isCompleted: false),
            HabitModel(id: "preview:2", name: "Book the appointment", isCompleted: false),
            HabitModel(id: "preview:3", name: "Plan tomorrow", isCompleted: false),
            HabitModel(id: "preview:4", name: "Review the draft", isCompleted: false),
            HabitModel(id: "preview:5", name: "Pick up groceries", isCompleted: false)
        ], summary: WidgetSummary(total: 7, completed: 2),
           accentFrom: DashboardSnapshot.read()?.accent.from, accentTo: DashboardSnapshot.read()?.accent.to, dayKey: todayKey())
    }
}

struct WidgetEntryView: View {
    let entry: SimpleEntry
    @Environment(\.widgetFamily) var family
    var limit: Int { family == .systemSmall ? 3 : 5 }
    // Done ones stay, struck through: seeing what you finished is half the point.
    var rows: [HabitModel] { entry.needsSync ? [] : entry.habits }
    var remaining: Int { max(0, (entry.summary?.total ?? 0) - (entry.summary?.completed ?? 0)) }
    var progress: Double {
        let total = entry.summary?.total ?? 0
        return total > 0 ? min(1, Double(entry.summary?.completed ?? 0) / Double(total)) : 0
    }
    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: progress) { Text("Tasks") } currentValueLabel: {
                if entry.needsSync { Image(systemName: "arrow.clockwise") } else { Text("\(remaining)") }
            }.gaugeStyle(.accessoryCircular)
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Tasks").font(.caption.weight(.semibold))
                Text(entry.needsSync ? "Open Habyss to sync" : rows.first?.name ?? "All clear").font(.headline).lineLimit(1)
                if !entry.needsSync { Text("\(remaining) remaining").font(.caption) }
            }
        case .accessoryInline:
            Text(entry.needsSync ? "Open Habyss to sync" : "\(remaining) tasks remaining")
        default:
            focusList
        }
    }

    /// Small: two rows. Medium: four, in two columns. Both: header, bar, rows, "+N more".
    private var focusList: some View {
        let small = family == .systemSmall
        let shown = small ? 2 : 4
        let total = entry.summary?.total ?? 0
        let done = entry.summary?.completed ?? 0
        let allDone = total > 0 && remaining == 0
        return VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(eyebrow: "Today", title: "Daily Focus", compact: small) {
                if !entry.needsSync && total > 0 {
                    WidgetPill(text: allDone ? "Done" : "\(done) / \(total)", tint: allDone ? Habyss.done : .white)
                }
            }
            if !entry.needsSync && total > 0 {
                WidgetBar(progress: progress, from: entry.accentSolid, to: Color(habyssHex: entry.accentTo) ?? Habyss.fallbackTo)
                    .padding(.top, 9)
            }
            if entry.needsSync {
                emptyState("arrow.triangle.2.circlepath", "Let’s bring today in", "Open Habyss to sync")
            } else if rows.isEmpty {
                emptyState(remaining > 0 ? "arrow.clockwise" : "checkmark.circle.fill",
                           remaining > 0 ? "More tasks are waiting" : total > 0 ? "All done for today" : "A little breathing room",
                           remaining > 0 ? "Open Habyss to refresh" : "Add a task in Habyss")
            } else {
                let visible = Array(rows.prefix(shown))
                Group {
                    if small {
                        VStack(spacing: 5) { ForEach(visible) { row($0) } }
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 5) {
                            ForEach(visible) { row($0) }
                        }
                    }
                }
                .padding(.top, 10)
                Spacer(minLength: 4)
                HStack(spacing: 8) {
                    WidgetMore(count: max(0, rows.count - shown))
                    if !small {
                        QuickAddLink(kind: "task", label: "Task", accent: entry.accentSolid)
                        QuickAddLink(kind: "habit", label: "Habit", accent: entry.accentSolid)
                    }
                }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 13)
    }

    private func row(_ task: HabitModel) -> some View {
        Button(intent: ToggleHabitIntent(id: task.id)) {
            WidgetRowCard(title: task.name, done: task.isCompleted,
                          icon: widgetRowIcon(id: task.id, title: task.name, time: task.time), accent: entry.accentSolid,
                          showsIcon: family != .systemSmall)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(task.isCompleted ? "Reopen \(task.name)" : "Complete \(task.name)")
    }
    private func emptyState(_ icon: String, _ title: String, _ subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Spacer(minLength: 0)
            Image(systemName: icon).font(.system(size: 24, weight: .light)).foregroundStyle(entry.accentSolid).padding(.bottom, 3)
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
            Text(subtitle).font(.system(size: 10)).foregroundStyle(Habyss.dim)
            Spacer(minLength: 0)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct HabyssWidget: Widget {
    let kind = "HabyssWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetEntryView(entry: entry)
                .widgetURL(URL(string: "habyss://task-stats"))
                .containerBackground(for: .widget) { DashboardBackground(accent: entry.accentSolid) }
        }
        .contentMarginsDisabled()
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .configurationDisplayName("Daily Tasks")
        .description("Your top 3 or 5 tasks, in priority order. Tap any row to complete it.")
    }
}

// MARK: - Quick add

/// A widget cannot hold a text field, so the nearest thing to typing a name
/// into one is a single tap to the composer with the keyboard already up.
/// Opens `habyss://add?kind=…`, handled by app/add.tsx. (Without opening the
/// app at all: "Add a task in Habyss" to Siri, Spotlight or the Action button.)
struct QuickAddLink: View {
    let kind: String
    let label: String
    let accent: Color
    var body: some View {
        Link(destination: URL(string: "habyss://add?kind=\(kind)")!) {
            HStack(spacing: 2) {
                Image(systemName: "plus").font(.system(size: 9, weight: .bold))
                Text(label).font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(Capsule().fill(Habyss.raised))
        }
        .accessibilityLabel("Add a \(kind)")
    }
}

struct QuickAddEntry: TimelineEntry {
    let date: Date
    let accent: Color
}

struct QuickAddProvider: TimelineProvider {
    private func current() -> QuickAddEntry {
        QuickAddEntry(date: .now, accent: Habyss.accent(from: DashboardSnapshot.read()?.accent.from, to: DashboardSnapshot.read()?.accent.to))
    }
    func placeholder(in context: Context) -> QuickAddEntry { QuickAddEntry(date: .now, accent: Habyss.accent(from: nil, to: nil)) }
    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) { completion(current()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .after(Date().addingTimeInterval(6 * 60 * 60))))
    }
}

struct QuickAddView: View {
    let entry: QuickAddEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "plus").font(.system(size: 22, weight: .semibold))
            }
            .accessibilityLabel("Add a task")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Habyss").font(.caption.weight(.medium))
                Label("Add a task", systemImage: "plus.circle").font(.headline)
            }
        case .systemMedium:
            // The four, side by side, each a + you can tap.
            VStack(alignment: .leading, spacing: 10) {
                Text("QUICK ADD").font(WidgetType.eyebrow).tracking(1.6).foregroundStyle(Habyss.dim)
                HStack(spacing: 8) { ForEach(QuickAddKind.all) { tile($0, tall: true) } }
            }
            .padding(14)
        default:
            // Small: the four in a square, each its own tap.
            Grid(horizontalSpacing: 7, verticalSpacing: 7) {
                GridRow { tile(QuickAddKind.all[0]); tile(QuickAddKind.all[1]) }
                GridRow { tile(QuickAddKind.all[2]); tile(QuickAddKind.all[3]) }
            }
            .padding(11)
        }
    }

    private func tile(_ kind: QuickAddKind, tall: Bool = false) -> some View {
        WidgetAsk(kind: kind) {
            VStack(alignment: tall ? .center : .leading, spacing: tall ? 8 : 0) {
                if tall { Spacer(minLength: 0) }
                ZStack {
                    Circle().fill(LinearGradient(colors: [Color.white.opacity(0.14), Color.white.opacity(0.05)], startPoint: .top, endPoint: .bottom))
                    Circle().strokeBorder(Color.white.opacity(0.10), lineWidth: 0.5)
                    Image(systemName: kind.icon).font(.system(size: tall ? 17 : 14, weight: .semibold)).foregroundStyle(entry.accent)
                }
                .frame(width: tall ? 42 : 30, height: tall ? 42 : 30)
                // The + as a badge on the disc, so the name has the whole width.
                .overlay(alignment: .topTrailing) {
                    Image(systemName: "plus").font(.system(size: tall ? 9 : 8, weight: .heavy)).foregroundStyle(.white)
                        .frame(width: tall ? 16 : 14, height: tall ? 16 : 14)
                        .background(Circle().fill(entry.accent))
                        .offset(x: 3, y: -3)
                }
                if !tall { Spacer(minLength: 0) }
                Text(tall ? kind.title : kind.short).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                    .lineLimit(tall ? 2 : 1).multilineTextAlignment(tall ? .center : .leading).fixedSize(horizontal: false, vertical: true)
                    // Every name the same two-line room, so the discs line up across the row.
                    .frame(height: tall ? 32 : nil, alignment: .top)
                if tall { Spacer(minLength: 0) }
            }
            .padding(tall ? 8 : 9)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: tall ? .center : .leading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.045)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.white.opacity(0.07), lineWidth: 0.75))
            .contentShape(Rectangle())
        }
        .accessibilityLabel("Add a \(kind.title.lowercased())")
    }
}

/// What the + on a widget can make, and where each one opens (app/add.tsx).
struct QuickAddKind: Identifiable {
    let id: String
    let title: String
    let icon: String
    /// The name on a small widget's tile, where "Brain dump" does not fit at a readable size.
    var short: String { id == "braindump" ? "Dump" : title }
    static let all = [
        QuickAddKind(id: "task", title: "Task", icon: "checklist"),
        QuickAddKind(id: "habit", title: "Habit", icon: "repeat"),
        QuickAddKind(id: "any", title: "Anything", icon: "sparkles"),
        QuickAddKind(id: "braindump", title: "Brain dump", icon: "brain"),
    ]
}

/// Adding without opening Habyss: a tap on a tile posts a notification you
/// type into (hold it, type, Add). The app adds it in the background
/// (lib/quickAddResponse.ts) and says what it added. The categories, each
/// with its text field, are registered by the app (lib/notificationActions.ts
/// QUICK_ADD_CATEGORIES). With notifications off, the tile opens the composer.
@available(iOS 17.0, *)
struct AskToAddIntent: AppIntent {
    static var title: LocalizedStringResource = "Add to Habyss"
    static var isDiscoverable: Bool = false
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Kind") var kind: String

    init() {}
    init(kind: String) { self.kind = kind }

    private static let prompts: [String: (category: String, title: String)] = [
        "task": ("HABYSS_ADD_TASK", "New task"),
        "habit": ("HABYSS_ADD_HABIT", "New habit"),
        "braindump": ("HABYSS_ADD_THOUGHT", "Brain dump"),
        "any": ("HABYSS_ADD_ANY", "Tell Habyss"),
    ]

    func perform() async throws -> some IntentResult {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        let prompt = Self.prompts[kind] ?? Self.prompts["task"]!
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
            return .result()
        }
        // Only the newest one waits on screen.
        center.removeDeliveredNotifications(withIdentifiers: ["habyss-quick-add"])
        let content = UNMutableNotificationContent()
        content.title = prompt.title
        content.body = "Hold here and type it. Added without opening Habyss."
        content.categoryIdentifier = prompt.category
        content.threadIdentifier = "habyss-quick-add"
        let request = UNNotificationRequest(identifier: "habyss-quick-add", content: content, trigger: nil)
        try? await center.add(request)
        return .result()
    }
}

/// A Quick Add tile: asks in a notification on iOS 17 and later (AskToAddIntent),
/// opens the composer before that.
struct WidgetAsk<Label: View>: View {
    let kind: QuickAddKind
    @ViewBuilder var label: () -> Label
    var body: some View {
        if #available(iOS 17.0, *) {
            Button(intent: AskToAddIntent(kind: kind.id)) { label() }.buttonStyle(.plain)
        } else {
            Link(destination: URL(string: "habyss://add?kind=\(kind.id)")!) { label() }
        }
    }
}

/// Opens a Habyss link from anywhere on a widget, the small one included:
/// a button running OpenURLIntent on iOS 18, a link before it.
struct WidgetOpen<Label: View>: View {
    let url: URL
    @ViewBuilder var label: () -> Label
    var body: some View {
        if #available(iOS 18.0, *) {
            Button(intent: OpenURLIntent(url)) { label() }.buttonStyle(.plain)
        } else {
            Link(destination: url) { label() }
        }
    }
}

struct HabyssQuickAddWidget: Widget {
    let kind = "HabyssQuickAddWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { entry in
            QuickAddView(entry: entry)
                // The small widget and the Lock Screen ones are one tap target.
                .widgetURL(URL(string: "habyss://add?kind=task"))
                .containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .contentMarginsDisabled()
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
        .configurationDisplayName("Quick Add")
        .description("A task, a habit, anything at all or a brain dump, one tap away.")
    }
}

#if DEBUG
#Preview(as: .systemSmall) { HabyssWidget() } timeline: { SimpleEntry.preview }
#Preview(as: .systemMedium) { HabyssWidget() } timeline: { SimpleEntry.preview }
#endif

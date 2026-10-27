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
    /// Falls back to the default gradient when the app has not written one yet.
    static let fallbackFrom = Color(.sRGB, red: 0.227, green: 0.353, blue: 0.549)
    static let fallbackTo = Color(.sRGB, red: 0.545, green: 0.678, blue: 0.839)
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
        let a = rgb(from) ?? (0.227, 0.353, 0.549)
        let b = rgb(to) ?? rgb(from) ?? (0.545, 0.678, 0.839)
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

// MARK: - Data Model
struct HabitModel: Codable, Identifiable {
    let id: String
    let name: String
    var isCompleted: Bool
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
            HabitModel(id: $0.id, name: $0.name, isCompleted: $0.isCompleted)
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
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Today").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                    Spacer(minLength: 3)
                    if !entry.needsSync {
                        Text(remaining == 0 && !rows.isEmpty ? "All done" : "\(remaining) left").font(.system(size: 11, weight: .semibold)).foregroundStyle(remaining == 0 && !rows.isEmpty ? Habyss.done : entry.accentSolid)
                    }
                    // Medium only: a small widget has one tap target, its rows.
                    if family == .systemMedium {
                        QuickAddLink(kind: "task", label: "Task", accent: entry.accentSolid)
                        QuickAddLink(kind: "habit", label: "Habit", accent: entry.accentSolid)
                    }
                }
                // The day's progress, as the app's bars draw it.
                if !entry.needsSync && (entry.summary?.total ?? 0) > 0 {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.08))
                            Capsule().fill(remaining == 0 ? Habyss.done : entry.accentSolid)
                                .frame(width: max(4, geometry.size.width * progress))
                        }
                    }
                    .frame(height: 4)
                }
                if entry.needsSync {
                    emptyState("arrow.triangle.2.circlepath", "Let’s bring today in", "Open Habyss to sync")
                } else if rows.isEmpty {
                    emptyState(remaining > 0 ? "arrow.clockwise" : "checkmark.circle.fill",
                               remaining > 0 ? "More tasks are waiting" : (entry.summary?.total ?? 0) > 0 ? "All done for today" : "A little breathing room",
                               remaining > 0 ? "Open Habyss to refresh" : "Add a task in Habyss")
                } else {
                    VStack(spacing: family == .systemSmall ? 7 : 3) {
                        ForEach(rows.prefix(limit)) { task in
                            Button(intent: ToggleHabitIntent(id: task.id)) {
                                HStack(spacing: 8) {
                                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 18, weight: task.isCompleted ? .regular : .light))
                                        .foregroundStyle(task.isCompleted ? Habyss.done : entry.accentSolid)
                                    Text(task.name).font(.system(size: 12, weight: .medium))
                                        .strikethrough(task.isCompleted, color: Habyss.dim)
                                        .foregroundStyle(task.isCompleted ? Habyss.dim : .white)
                                        .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .frame(maxWidth: .infinity, minHeight: family == .systemSmall ? 25 : 20, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(task.isCompleted ? "Reopen \(task.name)" : "Complete \(task.name)")
                        }
                    }
                    Spacer(minLength: 0)
                    if family == .systemSmall && rows.count > limit {
                        Text("+\(rows.count - limit) more").font(.system(size: 10)).foregroundStyle(Habyss.faint)
                    }
                }
            }
            .padding(14)
        }
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
            HStack(spacing: 10) {
                tile(kind: "task", title: "Task", icon: "checklist")
                tile(kind: "habit", title: "Habit", icon: "repeat")
            }
            .padding(12)
        default:
            // The app's + button: a matte disc, the plus in the accent.
            VStack(alignment: .leading, spacing: 4) {
                ZStack {
                    Circle().fill(LinearGradient(colors: [Color.white.opacity(0.14), Color.white.opacity(0.06)], startPoint: .top, endPoint: .bottom))
                    Circle().strokeBorder(Color.white.opacity(0.10), lineWidth: 0.5)
                    Image(systemName: "plus").font(.system(size: 20, weight: .semibold)).foregroundStyle(entry.accent)
                }
                .frame(width: 44, height: 44)
                Spacer(minLength: 0)
                Text("New task").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                Text("Tap and type").font(.system(size: 11)).foregroundStyle(Habyss.dim)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(14)
        }
    }
    private func tile(kind: String, title: String, icon: String) -> some View {
        Link(destination: URL(string: "habyss://add?kind=\(kind)")!) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).font(.system(size: 18, weight: .medium)).foregroundStyle(entry.accent)
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    Image(systemName: "plus").font(.system(size: 12, weight: .bold))
                    Text(title).font(.system(size: 15, weight: .semibold))
                }.foregroundStyle(.white)
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [Color.white.opacity(0.10), Color.white.opacity(0.05)], startPoint: .top, endPoint: .bottom)))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.white.opacity(0.08), lineWidth: 0.5))
        }
        .accessibilityLabel("Add a \(kind)")
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
        .description("Add a task or habit by name in one tap.")
    }
}

#if DEBUG
#Preview(as: .systemSmall) { HabyssWidget() } timeline: { SimpleEntry.preview }
#Preview(as: .systemMedium) { HabyssWidget() } timeline: { SimpleEntry.preview }
#endif

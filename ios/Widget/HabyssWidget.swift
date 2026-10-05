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
    static let faint = Color.white.opacity(0.32)
    static let done = Color(.sRGB, red: 0.06, green: 0.72, blue: 0.51)
    /// Falls back to the default gradient when the app has not written one yet.
    static let fallbackFrom = Color(.sRGB, red: 0.227, green: 0.353, blue: 0.549)
    static let fallbackTo = Color(.sRGB, red: 0.545, green: 0.678, blue: 0.839)
}

/// Uppercase and widely tracked, the way every section heading in the app reads.
struct SectionLabel: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 11, weight: .bold))
            .tracking(1.5)
            .foregroundStyle(Habyss.faint)
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
    var accentSolid: Color { Color(habyssHex: accentFrom) ?? Habyss.fallbackFrom }
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
        ], summary: WidgetSummary(total: 7, completed: 2), dayKey: todayKey())
    }
}

struct WidgetEntryView: View {
    let entry: SimpleEntry
    @Environment(\.widgetFamily) var family
    var limit: Int { family == .systemSmall ? 3 : 5 }
    var rows: [HabitModel] { entry.needsSync ? [] : entry.habits.filter { !$0.isCompleted } }
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
                Text("HABYSS · TASKS").font(.caption.bold())
                Text(entry.needsSync ? "Open Habyss to sync" : rows.first?.name ?? "All clear").font(.headline).lineLimit(1)
                if !entry.needsSync { Text("\(remaining) remaining").font(.caption) }
            }
        case .accessoryInline:
            Text(entry.needsSync ? "Open Habyss to sync" : "\(remaining) tasks remaining")
        default:
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text("TODAY").sectionLabel()
                    Spacer(minLength: 3)
                    if !entry.needsSync {
                        Text("\(remaining) left").font(.system(size: 11, weight: .semibold, design: .rounded)).foregroundStyle(entry.accentSolid)
                    }
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
                                    Image(systemName: "circle").font(.system(size: 18, weight: .light)).foregroundStyle(entry.accentSolid)
                                    Text(task.name).font(.system(size: 12, weight: .medium)).foregroundStyle(.white)
                                        .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .frame(maxWidth: .infinity, minHeight: family == .systemSmall ? 25 : 20, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Complete \(task.name)")
                        }
                    }
                    Spacer(minLength: 0)
                    if family == .systemSmall && remaining > limit {
                        Text("+\(remaining - limit) more").font(.system(size: 10)).foregroundStyle(Habyss.faint)
                    }
                }
            }
            .padding(12)
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

#if DEBUG
#Preview(as: .systemSmall) { HabyssWidget() } timeline: { SimpleEntry.preview }
#Preview(as: .systemMedium) { HabyssWidget() } timeline: { SimpleEntry.preview }
#endif

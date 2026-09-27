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
    let appGroup = "group.com.habyss.data"

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), habits: [
            HabitModel(id: "1", name: "Meditate", isCompleted: false),
            HabitModel(id: "2", name: "Drink Water", isCompleted: true),
            HabitModel(id: "3", name: "Read", isCompleted: false)
        ], activeHabitName: "Deep Work", timerEndDate: Date().addingTimeInterval(25 * 60), summary: WidgetSummary(total: 3, completed: 1), dayKey: SimpleEntry.todayKey())
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        completion(entry(from: getData()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let start = Calendar.current.startOfDay(for: .now)
        let entries = (0...8).compactMap { offset -> SimpleEntry? in
            guard let date = Calendar.current.date(byAdding: .day, value: offset, to: start) else { return nil }
            return entry(from: getData(), at: offset == 0 ? .now : date)
        }
        completion(Timeline(entries: entries, policy: .after(Date().addingTimeInterval(30 * 60))))
    }

    private func entry(from state: (habits: [HabitModel], activeHabitName: String?, timerEndDate: Date?, summary: WidgetSummary?, dayKey: String?), at date: Date = .now) -> SimpleEntry {
        let userDefaults = UserDefaults(suiteName: appGroup)
        if let snapshot = DashboardSnapshot.read() {
            let day = snapshot.days.first(where: { $0.date == SimpleEntry.todayKey(date) })
            return SimpleEntry(date: date, habits: (day?.items ?? []).map { HabitModel(id: $0.id, name: $0.name, isCompleted: $0.isCompleted) },
                               activeHabitName: nil, timerEndDate: nil,
                               summary: WidgetSummary(total: day?.total ?? 0, completed: day?.completed ?? 0),
                               accentFrom: snapshot.accent.from, accentTo: snapshot.accent.to,
                               dayKey: day?.date ?? snapshot.dayKey)
        }
        return SimpleEntry(
            date: Date(),
            habits: state.habits,
            activeHabitName: state.activeHabitName,
            timerEndDate: state.timerEndDate,
            summary: state.summary,
            accentFrom: userDefaults?.string(forKey: "accentFrom"),
            accentTo: userDefaults?.string(forKey: "accentTo"),
            dayKey: state.dayKey
        )
    }
    
    private func getData() -> (habits: [HabitModel], activeHabitName: String?, timerEndDate: Date?, summary: WidgetSummary?, dayKey: String?) {
        let userDefaults = UserDefaults(suiteName: appGroup)
        let activeHabitName = userDefaults?.string(forKey: "activeHabitName")
        let dayKey = userDefaults?.string(forKey: "dayKey")

        let timerEndDate: Date?
        if let timerEndDateString = userDefaults?.string(forKey: "timerEndDate"),
           let timerEndTimestamp = Double(timerEndDateString) {
            timerEndDate = Date(timeIntervalSince1970: timerEndTimestamp / 1000)
        } else {
            timerEndDate = nil
        }

        let summary: WidgetSummary?
        if let summaryString = userDefaults?.string(forKey: "widgetSummary"),
           let summaryData = summaryString.data(using: .utf8),
           let decodedSummary = try? JSONDecoder().decode(WidgetSummary.self, from: summaryData) {
            summary = decodedSummary
        } else {
            summary = nil
        }
        
        if let data = userDefaults?.string(forKey: "habitsData")?.data(using: .utf8),
           let habits = try? JSONDecoder().decode([HabitModel].self, from: data) {
            return (habits, activeHabitName, timerEndDate, summary, dayKey)
        }

        return ([], activeHabitName, timerEndDate, summary, dayKey)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let habits: [HabitModel]
    let activeHabitName: String?
    let timerEndDate: Date?
    let summary: WidgetSummary?
    /// The accent the user picked in the app, written alongside the day.
    var accentFrom: String? = nil
    var accentTo: String? = nil
    /// The day the app last wrote. The widget cannot work out a habit's
    /// schedule on its own, so once this is not today it says so instead of
    /// showing yesterday's list as if it were due now.
    var dayKey: String? = nil

    var accent: LinearGradient {
        LinearGradient(
            colors: [
                Color(habyssHex: accentFrom) ?? Habyss.fallbackFrom,
                Color(habyssHex: accentTo) ?? Habyss.fallbackTo,
            ],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    }

    var accentSolid: Color { Color(habyssHex: accentFrom) ?? Habyss.fallbackFrom }

    var isStale: Bool {
        guard let dayKey else { return false }
        return dayKey != SimpleEntry.todayKey(date)
    }

    static func todayKey(_ date: Date = Date()) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

struct WidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var completedCount: Int {
        entry.isStale ? 0 : (entry.summary?.completed ?? entry.habits.filter { $0.isCompleted }.count)
    }

    /// The rows to draw: none once they belong to a day that has gone by.
    var rows: [HabitModel] {
        entry.isStale ? [] : entry.habits
    }
    
    var totalCount: Int {
        entry.isStale ? 0 : (entry.summary?.total ?? entry.habits.count)
    }
    
    var progress: Double {
        totalCount > 0 ? Double(completedCount) / Double(totalCount) : 0
    }

    var activeFocusTitle: String? {
        guard let activeHabitName = entry.activeHabitName,
              !activeHabitName.isEmpty,
              activeHabitName != "No Active Habit"
        else { return nil }
        return activeHabitName
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: progress) {
                Text("\(completedCount)/\(totalCount)")
            } currentValueLabel: {
                Text("\(Int(progress * 100))%")
            }
            .gaugeStyle(.accessoryCircular)
            
        case .accessoryRectangular:
            HStack {
                VStack(alignment: .leading) {
                    Text("HABYSS")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(1.2)
                    if entry.isStale {
                        Text("Open Habyss")
                            .font(.headline)
                    } else if let first = rows.first(where: { !$0.isCompleted }) {
                        Text(first.name)
                            .font(.headline)
                            .lineLimit(1)
                    } else if totalCount == 0 {
                        Text("Nothing due")
                            .font(.headline)
                    } else {
                        Text("All done")
                            .font(.headline)
                    }
                }
                Spacer()
                Gauge(value: progress) {
                    Text("")
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .frame(width: 30, height: 30) // Small indicator
            }
            
        case .accessoryInline:
            Text("\(completedCount)/\(totalCount) Completed (\(Int(progress * 100))%)")
            
        case .systemSmall, .systemMedium:
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack {
                    Text(activeFocusTitle == nil ? "DAILY TASKS" : "FOCUS")
                        .sectionLabel()

                    Spacer()

                    // The ring closes as the day is won, and turns green at the
                    // moment it closes — the same signal as the profile ring.
                    ZStack {
                        Circle()
                            .stroke(Habyss.line, lineWidth: 3.5)
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(
                                progress >= 1 ? AnyShapeStyle(Habyss.done) : AnyShapeStyle(entry.accent),
                                style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 22, height: 22)
                }
                .padding(.bottom, 12)

                if let activeFocusTitle {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(activeFocusTitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        if let timerEndDate = entry.timerEndDate {
                            Text(timerInterval: min(Date(), timerEndDate)...timerEndDate, countsDown: true)
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(entry.accent)
                        } else if let summary = entry.summary {
                            Text("\(summary.completed)/\(summary.total) done")
                                .font(.system(size: 12))
                                .foregroundStyle(Habyss.dim)
                        }
                    }
                    .padding(.bottom, 12)
                }
                
                // List
                if rows.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: entry.isStale ? "arrow.clockwise" : "checkmark.circle")
                            .font(.system(size: 26, weight: .light))
                            .foregroundStyle(entry.accent)
                        Text(entry.isStale ? "Open Habyss for today" : totalCount > 0 ? "Open Habyss for remaining tasks" : "Nothing due today")
                            .font(.system(size: 12))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Habyss.dim)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(rows.prefix(family == .systemSmall ? 3 : 4)) { habit in
                            HStack(spacing: 10) {
                                // The same rounded box the day's list uses in
                                // the app, rather than iOS's circle.
                                Button(intent: ToggleHabitIntent(id: habit.id)) {
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .fill(habit.isCompleted ? AnyShapeStyle(Habyss.done) : AnyShapeStyle(Color.clear))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .stroke(habit.isCompleted ? Habyss.done : Color.white.opacity(0.26), lineWidth: 1.5)
                                        )
                                        .overlay(
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 10, weight: .bold))
                                                .foregroundStyle(.white)
                                                .opacity(habit.isCompleted ? 1 : 0)
                                        )
                                        .frame(width: 19, height: 19)
                                }
                                .buttonStyle(.plain)

                                Text(habit.name)
                                    .font(.system(size: 13, weight: habit.isCompleted ? .regular : .medium))
                                    .strikethrough(habit.isCompleted)
                                    .foregroundStyle(habit.isCompleted ? Habyss.faint : .white)
                                    .lineLimit(1)

                                Spacer()
                            }
                        }
                    }
                    
                    if totalCount > (family == .systemSmall ? 3 : 4) {
                        Spacer()
                        Text("+\(totalCount - (family == .systemSmall ? 3 : 4)) more")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Habyss.faint)
                    }
                    Spacer()
                }
            }
            .padding(12) // Slightly less padding for density
            /* .containerBackground(.fill.tertiary, for: .widget) // Moved to configuration */
        default:
            Text("Unsupported")
        }
    }
}

struct HabyssWidget: Widget {
    let kind: String = "HabyssWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WidgetEntryView(entry: entry)
                .widgetURL(URL(string: "habyss://roadmap"))
                // The app is a near-black void with one wash of the accent at
                // the top; the widget is a small window onto the same thing.
                .containerBackground(for: .widget) {
                    ZStack {
                        Habyss.void
                        RadialGradient(
                            colors: [entry.accentSolid.opacity(0.22), .clear],
                            center: .topLeading, startRadius: 0, endRadius: 190
                        )
                    }
                }
        }
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .configurationDisplayName("Daily Tasks")
        .description("Today’s tasks, including overdue work. Check them off right here.")
    }
}

#Preview(as: .systemSmall) {
    HabyssWidget()
} timeline: {
    SimpleEntry(date: .now, habits: [
        HabitModel(id: "1", name: "Meditate", isCompleted: false),
        HabitModel(id: "2", name: "Gym", isCompleted: true),
        HabitModel(id: "3", name: "Read", isCompleted: false),
        HabitModel(id: "4", name: "Journal", isCompleted: false),
        HabitModel(id: "5", name: "Sleep", isCompleted: false)
    ], activeHabitName: "Deep Work", timerEndDate: .now.addingTimeInterval(20 * 60), summary: WidgetSummary(total: 5, completed: 1), dayKey: SimpleEntry.todayKey())
    
    SimpleEntry(date: .now, habits: [], activeHabitName: nil, timerEndDate: nil, summary: WidgetSummary(total: 0, completed: 0), dayKey: SimpleEntry.todayKey())
}

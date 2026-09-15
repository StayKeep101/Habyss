//
//  Widget.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import WidgetKit
import SwiftUI
import AppIntents

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

// MARK: - App Intent for Interaction
struct ToggleHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Habit"
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Habit ID")
    var id: String
    
    init() {}
    
    init(id: String) {
        self.id = id
    }
    
    func perform() async throws -> some IntentResult {
        let appGroup = "group.com.habyss.data"
        let userDefaults = UserDefaults(suiteName: appGroup)
        
        // 1. Load Habits
        if let data = userDefaults?.string(forKey: "habitsData")?.data(using: .utf8),
           var habits = try? JSONDecoder().decode([HabitModel].self, from: data) {
            
            // 2. Toggle Target
            if let index = habits.firstIndex(where: { $0.id == id }) {
                habits[index].isCompleted.toggle()
                
                // 3. Save Back (Optimistic Update)
                if let newData = try? JSONEncoder().encode(habits),
                   let jsonString = String(data: newData, encoding: .utf8) {
                    userDefaults?.set(jsonString, forKey: "habitsData")
                }
                
                var pendingToggleIds = userDefaults?.array(forKey: "pending_widget_toggles") as? [String] ?? []
                pendingToggleIds.append(id)
                userDefaults?.set(pendingToggleIds, forKey: "pending_widget_toggles")
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
        
        return .result()
    }
}

struct Provider: TimelineProvider {
    let appGroup = "group.com.habyss.data"

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), habits: [
            HabitModel(id: "1", name: "Meditate", isCompleted: false),
            HabitModel(id: "2", name: "Drink Water", isCompleted: true),
            HabitModel(id: "3", name: "Read", isCompleted: false)
        ], activeHabitName: "Deep Work", timerEndDate: Date().addingTimeInterval(25 * 60), summary: WidgetSummary(total: 3, completed: 1))
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        let state = getData()
        let entry = SimpleEntry(date: Date(), habits: state.habits, activeHabitName: state.activeHabitName, timerEndDate: state.timerEndDate, summary: state.summary)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let state = getData()
        // Reload immediately after interactions
        let entry = SimpleEntry(date: Date(), habits: state.habits, activeHabitName: state.activeHabitName, timerEndDate: state.timerEndDate, summary: state.summary)
        // Refresh every 15 minutes or when app requests reload
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
    
    private func getData() -> (habits: [HabitModel], activeHabitName: String?, timerEndDate: Date?, summary: WidgetSummary?) {
        let userDefaults = UserDefaults(suiteName: appGroup)
        let activeHabitName = userDefaults?.string(forKey: "activeHabitName")

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
            return (habits, activeHabitName, timerEndDate, summary)
        }
        
        return ([], activeHabitName, timerEndDate, summary)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let habits: [HabitModel]
    let activeHabitName: String?
    let timerEndDate: Date?
    let summary: WidgetSummary?
}

struct WidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var completedCount: Int {
        entry.habits.filter { $0.isCompleted }.count
    }
    
    var totalCount: Int {
        entry.habits.count
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
                        .font(.caption)
                        .bold()
                    if let first = entry.habits.first(where: { !$0.isCompleted }) {
                        Text(first.name)
                            .font(.headline)
                            .lineLimit(1)
                    } else {
                        Text("All Completed")
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
                    Text(activeFocusTitle == nil ? "TODAY" : "FOCUS")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.secondary)
                    
                    Spacer()
                    
                    // Mini Progress Ring
                    ZStack {
                        Circle()
                            .stroke(Color.secondary.opacity(0.2), lineWidth: 4)
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 20, height: 20)
                }
                .padding(.bottom, 12)

                if let activeFocusTitle {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(activeFocusTitle)
                            .font(.headline)
                            .lineLimit(1)
                        if let timerEndDate = entry.timerEndDate {
                            Text(timerInterval: Date()...timerEndDate, countsDown: true)
                                .font(.system(.title3, design: .monospaced))
                                .fontWeight(.semibold)
                        } else if let summary = entry.summary {
                            Text("\(summary.completed)/\(summary.total) habits done")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.bottom, 12)
                }
                
                // List
                if entry.habits.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "checklist")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No active habits")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(entry.habits.prefix(family == .systemSmall ? 3 : 4)) { habit in
                            HStack(spacing: 8) {
                                Button(intent: ToggleHabitIntent(id: habit.id)) {
                                    Image(systemName: habit.isCompleted ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(habit.isCompleted ? .secondary : .primary)
                                }
                                .buttonStyle(.plain)
                                
                                Text(habit.name)
                                    .font(.subheadline)
                                    .fontWeight(habit.isCompleted ? .regular : .medium)
                                    .strikethrough(habit.isCompleted)
                                    .foregroundStyle(habit.isCompleted ? .secondary : .primary)
                                    .lineLimit(1)
                                
                                Spacer()
                            }
                        }
                    }
                    
                    if entry.habits.count > (family == .systemSmall ? 3 : 4) {
                        Spacer()
                        Text("+\(entry.habits.count - (family == .systemSmall ? 3 : 4)) more")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
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
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
        .configurationDisplayName("Daily Habits")
        .description("Check off your habits directly from the home screen.")
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
    ], activeHabitName: "Deep Work", timerEndDate: .now.addingTimeInterval(20 * 60), summary: WidgetSummary(total: 5, completed: 1))
    
    SimpleEntry(date: .now, habits: [], activeHabitName: nil, timerEndDate: nil, summary: WidgetSummary(total: 0, completed: 0))
}

import WidgetKit
import SwiftUI
import AppIntents

struct WidgetHabit: Codable, Identifiable {
    let id: String
    let name: String
    let completed: Bool
    let category: String
    let icon: String
}

struct WidgetQuote: Codable {
    let text: String
    let author: String
}

struct WidgetData: Codable {
    let completedHabitsToday: Int
    let totalHabitsToday: Int
    let streakDays: Int
    let lastUpdated: Double
    let quote: WidgetQuote?
    let todayHabits: [WidgetHabit]?
    let nextHabit: WidgetHabit?
    let motivationalMessage: String?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: WidgetData(
            completedHabitsToday: 3,
            totalHabitsToday: 5,
            streakDays: 7,
            lastUpdated: Date().timeIntervalSince1970,
            quote: WidgetQuote(text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock"),
            todayHabits: [
                WidgetHabit(id: "1", name: "Morning Meditation", completed: true, category: "mindfulness", icon: "leaf"),
                WidgetHabit(id: "2", name: "Read 20 Pages", completed: false, category: "personal", icon: "book")
            ],
            nextHabit: WidgetHabit(id: "2", name: "Read 20 Pages", completed: false, category: "personal", icon: "book"),
            motivationalMessage: "Halfway through. Keep the momentum!"
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), data: loadData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = SimpleEntry(date: Date(), data: loadData())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadData() -> WidgetData {
        let userDefaults = UserDefaults(suiteName: "group.com.habyss.app")
        if let data = userDefaults?.string(forKey: "habyss_widget_data"),
           let jsonData = data.data(using: .utf8) {
            do {
                return try JSONDecoder().decode(WidgetData.self, from: jsonData)
            } catch {
                print("Error decoding widget data: \(error)")
            }
        }
        return WidgetData(completedHabitsToday: 0, totalHabitsToday: 0, streakDays: 0, lastUpdated: 0, quote: nil, todayHabits: nil, nextHabit: nil, motivationalMessage: nil)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct CompleteHabitIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Habit"
    static var description = IntentDescription("Marks a habit as completed.")

    @Parameter(title: "Habit ID")
    var habitId: String

    init() {}
    init(habitId: String) {
        self.habitId = habitId
    }

    func perform() async throws -> some IntentResult {
        // In a real app, this would update shared storage or call a background task
        // For now, we deep link back to the app with the completion action
        return .result()
    }
}

struct HabyssTodayWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // Background gradient for a premium feel
            LinearGradient(
                gradient: Gradient(colors: [Color(hex: "#1A1A2E"), Color(hex: "#16213E")]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            VStack(alignment: .leading, spacing: 8) {
                headerView
                
                if family == .accessoryCircular {
                    circularProgressView
                } else if family == .accessoryRectangular {
                    rectangularLockScreenView
                } else if family == .accessoryInline {
                    inlineLockScreenView
                } else {
                    mainContentView
                }
            }
            .padding(family.isLockScreen ? 0 : 12)
        }
        .containerBackground(for: .widget) {
            Color(hex: "#1A1A2E")
        }
    }
    
    private var headerView: some View {
        Group {
            if !family.isLockScreen {
                HStack {
                    Text("HABYSS")
                        .font(.system(size: 10, weight: .black))
                        .kerning(1)
                        .foregroundColor(Color(hex: "#6B46C1"))
                    Spacer()
                    if entry.data.streakDays > 0 {
                        HStack(spacing: 2) {
                            Text("🔥")
                            Text("\(entry.data.streakDays)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.orange)
                        }
                    }
                }
            }
        }
    }
    
    private var mainContentView: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let nextHabit = entry.data.nextHabit, family == .systemSmall {
                smallHabitView(nextHabit)
            } else if let habits = entry.data.todayHabits, family == .systemMedium {
                mediumHabitsView(habits)
            } else {
                defaultProgressView
            }
            
            Spacer()
            
            if let quote = entry.data.quote, family == .systemMedium {
                Text("\"\(quote.text)\"")
                    .font(.system(size: 10, style: .italic))
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            } else if let message = entry.data.motivationalMessage {
                Text(message)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private func smallHabitView(_ habit: WidgetHabit) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("NEXT UP")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(.secondary)
            
            HStack {
                VStack(alignment: .leading) {
                    Text(habit.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                Spacer()
                Button(intent: CompleteHabitIntent(habitId: habit.id)) {
                    Image(systemName: "circle")
                        .font(.system(size: 20))
                        .foregroundColor(Color(hex: "#6B46C1"))
                }
                .buttonStyle(.plain)
            }
            .padding(8)
            .background(Color.white.opacity(0.05))
            .cornerRadius(8)
            
            progressIndicator
        }
    }
    
    private func mediumHabitsView(_ habits: [WidgetHabit]) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("TODAY")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(.secondary)
                
                ForEach(habits.prefix(3)) { habit in
                    HStack {
                        Image(systemName: habit.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(habit.completed ? .green : Color(hex: "#6B46C1"))
                        Text(habit.name)
                            .font(.system(size: 12))
                            .foregroundColor(habit.completed ? .secondary : .white)
                            .lineLimit(1)
                        Spacer()
                    }
                }
            }
            
            Divider().background(Color.white.opacity(0.1))
            
            VStack(alignment: .leading, spacing: 8) {
                Text("PROGRESS")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(.secondary)
                
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: entry.data.totalHabitsToday > 0 ? CGFloat(entry.data.completedHabitsToday) / CGFloat(entry.data.totalHabitsToday) : 0)
                        .stroke(
                            LinearGradient(colors: [Color(hex: "#6B46C1"), Color(hex: "#9F7AEA")], startPoint: .top, endPoint: .bottom),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                    
                    VStack(spacing: 0) {
                        Text("\(entry.data.completedHabitsToday)/\(entry.data.totalHabitsToday)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .frame(width: 60, height: 60)
            }
        }
    }
    
    private var defaultProgressView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(entry.data.completedHabitsToday) / \(entry.data.totalHabitsToday) habits done")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
            
            progressIndicator
        }
    }
    
    private var progressIndicator: some View {
        ProgressView(value: Double(entry.data.completedHabitsToday), total: Double(entry.data.totalHabitsToday))
            .accentColor(Color(hex: "#6B46C1"))
            .scaleEffect(x: 1, y: 1.5, anchor: .center)
    }
    
    // MARK: - Lock Screen Views
    
    private var circularProgressView: some View {
        ZStack {
            AccessoryWidgetBackground()
            Circle()
                .trim(from: 0, to: entry.data.totalHabitsToday > 0 ? CGFloat(entry.data.completedHabitsToday) / CGFloat(entry.data.totalHabitsToday) : 0)
                .stroke(lineWidth: 4)
            Text("\(entry.data.completedHabitsToday)")
                .font(.system(size: 12, weight: .bold))
        }
    }
    
    private var rectangularLockScreenView: some View {
        VStack(alignment: .leading) {
            HStack {
                Text("🔥 \(entry.data.streakDays)")
                Spacer()
                Text("\(entry.data.completedHabitsToday)/\(entry.data.totalHabitsToday)")
            }
            .font(.system(size: 12, weight: .bold))
            
            ProgressView(value: Double(entry.data.completedHabitsToday), total: Double(entry.data.totalHabitsToday))
            
            if let next = entry.data.nextHabit {
                Text(next.name)
                    .font(.system(size: 10))
                    .lineLimit(1)
            }
        }
    }
    
    private var inlineLockScreenView: some View {
        Text("Habyss: \(entry.data.completedHabitsToday)/\(entry.data.totalHabitsToday) habits done")
    }
}

extension WidgetFamily {
    var isLockScreen: Bool {
        switch self {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            return true
        default:
            return false
        }
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

@main
struct HabyssTodayWidget: Widget {
    let kind: String = "HabyssTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            HabyssTodayWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Habyss Today")
        .description("Track your daily habit progress.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

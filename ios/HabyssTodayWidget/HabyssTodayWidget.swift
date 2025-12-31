import WidgetKit
import SwiftUI

struct WidgetData: Codable {
    let completedHabitsToday: Int
    let totalHabitsToday: Int
    let streakDays: Int
    let lastUpdated: Double
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), data: WidgetData(completedHabitsToday: 3, totalHabitsToday: 5, streakDays: 7, lastUpdated: Date().timeIntervalSince1970))
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
        return WidgetData(completedHabitsToday: 0, totalHabitsToday: 0, streakDays: 0, lastUpdated: 0)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct HabyssTodayWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("HABYSS")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
                if entry.data.streakDays > 0 {
                    Text("🔥 \(entry.data.streakDays)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.orange)
                }
            }
            
            Spacer()
            
            if entry.data.totalHabitsToday > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.data.completedHabitsToday) / \(entry.data.totalHabitsToday) habits done")
                        .font(.system(size: 16, weight: .semibold))
                    
                    ProgressView(value: Double(entry.data.completedHabitsToday), total: Double(entry.data.totalHabitsToday))
                        .accentColor(Color(hex: "#6B46C1"))
                        .scaleEffect(x: 1, y: 2, anchor: .center)
                }
            } else {
                Text("Start a habit today 👋")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text("Keep going!")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
        }
        .padding()
        .widgetURL(URL(string: "habyss://today"))
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
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

//
//  EchoWidget.swift
//  Widget
//
//  Echo on the lock screen, one line an hour.
//

import WidgetKit
import SwiftUI

/// One line and the moment it takes over. Written by `lib/echoLockScreen.ts`.
struct EchoHour: Codable {
    let at: Double
    let line: String

    var date: Date { Date(timeIntervalSince1970: at / 1000) }
}

struct EchoEntry: TimelineEntry {
    let date: Date
    let line: String
    let accent: Color
}

/// A widget cannot ask Echo anything — it cannot run the app's code or reach
/// its database — so the app writes the day's lines ahead of time and this only
/// chooses which one the hour has reached.
struct EchoProvider: TimelineProvider {
    let appGroup = "group.com.habyss.data"
    static let fallback = "Small things, often. That is the whole trick."

    func placeholder(in context: Context) -> EchoEntry {
        EchoEntry(date: .now, line: Self.fallback, accent: Habyss.fallbackTo)
    }

    func getSnapshot(in context: Context, completion: @escaping (EchoEntry) -> Void) {
        completion(timeline().first ?? placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EchoEntry>) -> Void) {
        let entries = timeline()
        // Refreshed after the last line rather than on a fixed interval: past
        // it there is nothing new to say until the app writes again.
        let after = entries.last?.date.addingTimeInterval(3600) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: entries, policy: .after(after)))
    }

    private func accent() -> Color {
        let defaults = UserDefaults(suiteName: appGroup)
        return Habyss.accent(from: defaults?.string(forKey: "accentFrom"), to: defaults?.string(forKey: "accentTo"))
    }

    private func timeline() -> [EchoEntry] {
        let tint = accent()
        guard let raw = UserDefaults(suiteName: appGroup)?.string(forKey: "echoHours"),
              let data = raw.data(using: .utf8),
              let hours = try? JSONDecoder().decode([EchoHour].self, from: data),
              !hours.isEmpty
        else { return [EchoEntry(date: .now, line: Self.fallback, accent: tint)] }

        let now = Date()
        let sorted = hours.sorted { $0.at < $1.at }
        // WidgetKit will not accept a first entry in the future, so whichever
        // line the hour has already reached is shown as of now.
        let current = sorted.last(where: { $0.date <= now }) ?? sorted[0]
        var entries = [EchoEntry(date: now, line: current.line, accent: tint)]
        entries += sorted.filter { $0.date > now }.prefix(12).map { EchoEntry(date: $0.date, line: $0.line, accent: tint) }
        return entries
    }
}

struct EchoWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EchoEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            // One line, no room for a label: the words have to do the work.
            Text(entry.line)

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Echo")
                    .font(.system(size: 10, weight: .medium))
                    .widgetAccentable()
                Text(entry.line)
                    .font(.system(size: 12))
                    .lineLimit(3)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

        default:
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 5) {
                    Circle().fill(entry.accent).frame(width: 6, height: 6)
                    Text("Echo")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(entry.accent)
                    Spacer()
                    Text(entry.date, style: .time)
                        .font(.system(size: 10))
                        .foregroundStyle(Habyss.faint)
                }
                Text(entry.line)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(5)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
        }
    }
}

struct HabyssEchoWidget: Widget {
    let kind: String = "HabyssEchoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EchoProvider()) { entry in
            EchoWidgetView(entry: entry)
                .widgetURL(URL(string: "habyss://home"))
                .containerBackground(for: .widget) { DashboardBackground(accent: entry.accent) }
        }
        .supportedFamilies([.accessoryRectangular, .accessoryInline, .systemSmall, .systemMedium])
        .configurationDisplayName("Echo")
        .description("A line from Echo, on the hour.")
    }
}

#Preview(as: .accessoryRectangular) {
    HabyssEchoWidget()
} timeline: {
    EchoEntry(date: .now, line: "Two of five today. The next one is Read.", accent: Habyss.fallbackTo)
    EchoEntry(date: .now.addingTimeInterval(3600), line: "Four days running. Keep it boring.", accent: Habyss.fallbackTo)
}

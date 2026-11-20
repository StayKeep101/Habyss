import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

/// Screen time, drawn inside Habyss (the Focus page's Screen time side). iOS only
/// lets this extension see the numbers: it draws them here and nothing leaves it,
/// so Habyss itself never reads anyone's app usage. The app picks the days
/// (ScreenTimeReportView in ios/ScreenTimeModule.swift); this draws the daily
/// average, what that costs over a year, a bar per day and the top apps.
@main
struct ScreenTimeReportExtension: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        UsageScene { usage in UsageView(usage: usage) }
    }
}

extension DeviceActivityReport.Context {
    static let usage = Self("habyss.usage")
}

struct AppUsage: Identifiable {
    let id: String
    let token: ApplicationToken?
    let name: String
    var seconds: TimeInterval
}

struct DayUsage: Identifiable {
    var id: Date { day }
    let day: Date
    var seconds: TimeInterval
}

struct Usage {
    var days: [DayUsage] = []
    var apps: [AppUsage] = []
    var pickups = 0

    var total: TimeInterval { days.reduce(0) { $0 + $1.seconds } }
    /// Over the days that have come, not the ones still ahead.
    var average: TimeInterval {
        let today = Calendar.current.startOfDay(for: Date())
        let counted = days.filter { $0.day <= today }
        return counted.isEmpty ? 0 : counted.reduce(0) { $0 + $1.seconds } / Double(counted.count)
    }
}

struct UsageScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .usage
    let content: (Usage) -> UsageView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> Usage {
        var byDay: [Date: TimeInterval] = [:]
        var byApp: [String: AppUsage] = [:]
        var pickups = 0
        for await device in data {
            for await segment in device.activitySegments {
                let day = Calendar.current.startOfDay(for: segment.dateInterval.start)
                byDay[day, default: 0] += segment.totalActivityDuration
                pickups += segment.totalPickupsWithoutApplicationActivity
                for await category in segment.categories {
                    for await activity in category.applications {
                        let app = activity.application
                        let key = app.bundleIdentifier ?? app.localizedDisplayName ?? "app"
                        pickups += activity.numberOfPickups
                        if byApp[key] == nil {
                            byApp[key] = AppUsage(id: key, token: app.token, name: app.localizedDisplayName ?? "An app", seconds: 0)
                        }
                        byApp[key]?.seconds += activity.totalActivityDuration
                    }
                }
            }
        }
        var usage = Usage()
        usage.days = byDay.map { DayUsage(day: $0.key, seconds: $0.value) }.sorted { $0.day < $1.day }
        usage.apps = byApp.values.filter { $0.seconds >= 60 }.sorted { $0.seconds > $1.seconds }
        usage.pickups = pickups
        return usage
    }
}

// MARK: - The look (the Focus page's, in SwiftUI)

private let group = UserDefaults(suiteName: "group.com.habyss.data")

private func color(_ hex: String?, _ fallback: Color) -> Color {
    guard var text = hex?.trimmingCharacters(in: .whitespaces), text.hasPrefix("#") else { return fallback }
    text.removeFirst()
    guard text.count == 6, let value = Int(text, radix: 16) else { return fallback }
    return Color(red: Double((value >> 16) & 0xFF) / 255, green: Double((value >> 8) & 0xFF) / 255, blue: Double(value & 0xFF) / 255)
}

/// "3h 12m", "45m".
private func duration(_ seconds: TimeInterval) -> String {
    let minutes = Int((seconds / 60).rounded())
    let hours = minutes / 60, rest = minutes % 60
    if hours == 0 { return "\(rest)m" }
    return rest == 0 ? "\(hours)h" : "\(hours)h \(rest)m"
}

struct UsageView: View {
    let usage: Usage
    @Environment(\.colorScheme) private var scheme

    private var accent: Color { color(group?.string(forKey: "accentFrom"), .blue) }
    private var primary: Color { scheme == .dark ? .white : .black }
    private var muted: Color { primary.opacity(0.6) }
    private var track: Color { primary.opacity(0.1) }

    /// What this pace costs: days of a year, waking hours (16 a day).
    private var yearLine: String? {
        guard usage.average >= 15 * 60 else { return nil }
        let days = Int((usage.average * 365 / (16 * 3600)).rounded())
        return days >= 1 ? "At this pace: \(days) waking days a year on your phone." : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text(duration(usage.average))
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(primary)
                Text("Daily average")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(muted)
                if let yearLine {
                    Text(yearLine)
                        .font(.system(size: 15))
                        .foregroundColor(muted)
                        .padding(.top, 2)
                }
            }

            bars

            if !usage.apps.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Where it went")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(primary)
                    VStack(spacing: 14) {
                        ForEach(usage.apps.prefix(8)) { app in row(app) }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(primary.opacity(0.05)))
                }
            }

            if usage.pickups > 0, !usage.days.isEmpty {
                Text("Picked up \(usage.pickups / max(1, usage.days.count)) times a day.")
                    .font(.system(size: 15))
                    .foregroundColor(muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var bars: some View {
        let ceiling = max(1, usage.days.map(\.seconds).max() ?? 1)
        let today = Calendar.current.startOfDay(for: Date())
        return VStack(spacing: 8) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(usage.days) { day in
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(day.day == today ? accent : accent.opacity(0.55))
                        .frame(height: max(4, 150 * day.seconds / ceiling))
                        .frame(maxWidth: .infinity)
                        .accessibilityLabel("\(day.day.formatted(.dateTime.weekday(.wide))), \(duration(day.seconds))")
                }
            }
            .frame(height: 150, alignment: .bottom)
            if usage.days.count <= 7 {
                HStack(spacing: 4) {
                    ForEach(usage.days) { day in
                        Text(day.day.formatted(.dateTime.weekday(.narrow)))
                            .font(.system(size: 12))
                            .foregroundColor(day.day == today ? primary : muted)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    private func row(_ app: AppUsage) -> some View {
        let top = max(1, usage.apps.first?.seconds ?? 1)
        return VStack(spacing: 8) {
            HStack(spacing: 10) {
                if let token = app.token {
                    Label(token).labelStyle(.iconOnly).frame(width: 24, height: 24)
                }
                Text(app.name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(primary)
                    .lineLimit(1)
                Spacer()
                Text(duration(app.seconds))
                    .font(.system(size: 14, weight: .semibold))
                    .monospacedDigit()
                    .foregroundColor(muted)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(track)
                    Capsule().fill(accent).frame(width: proxy.size.width * app.seconds / top)
                }
            }
            .frame(height: 6)
        }
    }
}

import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

/// Screen time, drawn inside Habyss: the Focus page's Screen time side, in the
/// Focus page's own design (app/(root)/focus-stats.tsx). iOS lets only this
/// extension see the numbers: it draws them and nothing leaves it, so Habyss
/// itself never reads anyone's app usage. The app picks the days
/// (ScreenTimeReportView in ios/ScreenTimeModule.swift) and hands over its
/// colours (components/Focus/ScreenTimeReport.tsx); this draws the average, a
/// bar per day (tap one to read it, tap it again for the average) and where the
/// time went, exactly as the Focus side draws focus time.
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
    var pickups: Int
    var apps: [String: AppUsage]
}

struct Usage {
    var days: [DayUsage] = []

    /// Over the days that have come, not the ones still ahead.
    var elapsed: [DayUsage] {
        let today = Calendar.current.startOfDay(for: Date())
        return days.filter { $0.day <= today }
    }
    var average: TimeInterval {
        let counted = elapsed
        return counted.isEmpty ? 0 : counted.reduce(0) { $0 + $1.seconds } / Double(counted.count)
    }
    /// Apps across the given days, most first.
    func apps(in list: [DayUsage]) -> [AppUsage] {
        var merged: [String: AppUsage] = [:]
        for day in list {
            for (key, app) in day.apps {
                if merged[key] == nil { merged[key] = AppUsage(id: key, token: app.token, name: app.name, seconds: 0) }
                merged[key]?.seconds += app.seconds
            }
        }
        return merged.values.filter { $0.seconds >= 60 }.sorted { $0.seconds > $1.seconds }
    }
}

struct UsageScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .usage
    let content: (Usage) -> UsageView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> Usage {
        var byDay: [Date: DayUsage] = [:]
        for await device in data {
            for await segment in device.activitySegments {
                let day = Calendar.current.startOfDay(for: segment.dateInterval.start)
                var entry = byDay[day] ?? DayUsage(day: day, seconds: 0, pickups: 0, apps: [:])
                entry.seconds += segment.totalActivityDuration
                entry.pickups += segment.totalPickupsWithoutApplicationActivity
                for await category in segment.categories {
                    for await activity in category.applications {
                        let app = activity.application
                        let key = app.bundleIdentifier ?? app.localizedDisplayName ?? "app"
                        entry.pickups += activity.numberOfPickups
                        if entry.apps[key] == nil {
                            entry.apps[key] = AppUsage(id: key, token: app.token, name: app.localizedDisplayName ?? "An app", seconds: 0)
                        }
                        entry.apps[key]?.seconds += activity.totalActivityDuration
                    }
                }
                byDay[day] = entry
            }
        }
        var usage = Usage()
        usage.days = byDay.values.sorted { $0.day < $1.day }
        return usage
    }
}

// MARK: - The app's look (handed over by the app; Lexend is bundled with this extension)

private struct Theme {
    var text = Color.white
    var muted = Color.white.opacity(0.7)
    var subtle = Color.white.opacity(0.45)
    var border = Color.white.opacity(0.1)
    var accent = Color(red: 0.55, green: 0.66, blue: 0.95)
    var card: [Color] = [Color.white.opacity(0.07), Color.white.opacity(0.05), Color.white.opacity(0.04)]

    static func load() -> Theme {
        var theme = Theme()
        guard let raw = UserDefaults(suiteName: "group.com.habyss.data")?.string(forKey: "habyss_report_theme"),
              let data = raw.data(using: .utf8),
              let values = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return theme }
        func colour(_ key: String) -> Color? { values[key].flatMap(Color.init(hex:)) }
        theme.text = colour("text") ?? theme.text
        theme.muted = colour("muted") ?? theme.muted
        theme.subtle = colour("subtle") ?? theme.subtle
        theme.border = colour("border") ?? theme.border
        theme.accent = colour("accent") ?? theme.accent
        if let top = colour("cardTop"), let fill = colour("cardFill"), let bottom = colour("cardBottom") { theme.card = [top, fill, bottom] }
        return theme
    }
}

private extension Color {
    init?(hex: String) {
        var text = hex.trimmingCharacters(in: .whitespaces)
        guard text.hasPrefix("#") else { return nil }
        text.removeFirst()
        guard text.count == 6 || text.count == 8, let value = UInt64(text, radix: 16) else { return nil }
        let rgb = text.count == 8 ? value >> 8 : value
        let alpha = text.count == 8 ? Double(value & 0xFF) / 255 : 1
        self.init(.sRGB, red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255, blue: Double(rgb & 0xFF) / 255, opacity: alpha)
    }
}

private func lexend(_ size: CGFloat, _ weight: String) -> Font { .custom("Lexend-\(weight)", fixedSize: size) }

/// "3h 12m", "45m" (the Focus page's way).
private func duration(_ seconds: TimeInterval) -> String {
    let minutes = Int((seconds / 60).rounded())
    let hours = minutes / 60, rest = minutes % 60
    if hours == 0 { return "\(rest)m" }
    return rest == 0 ? "\(hours)h" : "\(hours)h \(rest)m"
}

private func longDay(_ day: Date) -> String { day.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) }
private func shortDay(_ day: Date) -> String { day.formatted(.dateTime.day().month(.abbreviated)) }

struct UsageView: View {
    let usage: Usage
    @State private var picked: Date?
    /// Where the current drag began, once it has moved the pick.
    @State private var dragFrom: Date?
    private let theme = Theme.load()

    private var pickedDay: DayUsage? { picked.flatMap { day in usage.days.first { $0.day == day } } }
    private var today: Date { Calendar.current.startOfDay(for: Date()) }

    // The whole page scrolls here, inside the report: iOS draws it in its own
    // process, so the app's scroll view never sees a finger that lands on it.
    // Pinned to the top, so there is never a gap above the figure.
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                hero
                bars
                wentTo
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 48)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // The big figure: the daily average, or the day you tapped (as on the Focus side).
    private var hero: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(duration(pickedDay?.seconds ?? usage.average))
                .font(lexend(56, "Bold"))
                .tracking(-2)
                .monospacedDigit()
                .foregroundColor(theme.text)
            Text(pickedDay.map { longDay($0.day) } ?? "Daily average")
                .font(lexend(15, "Medium"))
                .foregroundColor(theme.muted)
        }
        .padding(.top, 6)
    }

    /// The day under the finger, from where it is across the chart.
    private func day(at x: CGFloat, width: CGFloat) -> Date? {
        guard !usage.days.isEmpty, width > 0 else { return nil }
        let index = min(usage.days.count - 1, max(0, Int(x / width * CGFloat(usage.days.count))))
        return usage.days[index].day
    }

    // A bar a day, as on the Focus page: drag a finger across to read each day; the
    // day stays when you let go. Tap the picked day again for the average.
    private var bars: some View {
        let ceiling = max(1, usage.days.map(\.seconds).max() ?? 1)
        return VStack(spacing: 4) {
            GeometryReader { proxy in
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(usage.days) { day in
                        let lit = picked.map { $0 == day.day } ?? (day.day == today)
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(day.seconds > 0 ? theme.accent : theme.border)
                            .opacity(lit ? 1 : (picked == nil ? 0.6 : 0.3))
                            .frame(height: max(4, 150 * day.seconds / ceiling))
                            .frame(maxWidth: .infinity)
                            .accessibilityLabel("\(longDay(day.day)), \(duration(day.seconds))")
                            .accessibilityAddTraits(.isButton)
                            .accessibilityAction { picked = picked == day.day ? nil : day.day }
                    }
                }
                .frame(width: proxy.size.width, height: 150, alignment: .bottom)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let start = self.day(at: value.startLocation.x, width: proxy.size.width)
                            let now = self.day(at: value.location.x, width: proxy.size.width)
                            // Pressed on the day already picked and not moved off it yet: wait for the release.
                            if now == start, start == picked, dragFrom == nil { return }
                            dragFrom = start
                            if now != picked { picked = now }
                        }
                        .onEnded { value in
                            let start = self.day(at: value.startLocation.x, width: proxy.size.width)
                            let end = self.day(at: value.location.x, width: proxy.size.width)
                            // A tap on the picked day: back to the average.
                            if dragFrom == nil, start == end, start == picked { picked = nil }
                            dragFrom = nil
                        }
                )
            }
            .frame(height: 150)
            if usage.days.count <= 7 {
                HStack(spacing: 4) {
                    ForEach(usage.days) { day in
                        Text(day.day.formatted(.dateTime.weekday(.narrow)))
                            .font(lexend(12, "Regular"))
                            .foregroundColor(day.day == (picked ?? today) ? theme.text : theme.subtle)
                            .frame(maxWidth: .infinity)
                    }
                }
            } else if let first = usage.days.first, let last = usage.days.last {
                HStack {
                    Text(shortDay(first.day)).font(lexend(12, "Regular")).foregroundColor(theme.subtle)
                    Spacer()
                    Text(last.day == today ? "Today" : shortDay(last.day)).font(lexend(12, "Regular")).foregroundColor(theme.subtle)
                }
            }
        }
    }

    // Where the time went, most first: the Focus page's list, in the app's card.
    @ViewBuilder private var wentTo: some View {
        let apps = Array(usage.apps(in: pickedDay.map { [$0] } ?? usage.elapsed).prefix(8))
        if !apps.isEmpty {
            let top = max(1, apps.first?.seconds ?? 1)
            VStack(alignment: .leading, spacing: 12) {
                Text(pickedDay.map { "\(shortDay($0.day)) went to" } ?? (usage.days.count <= 7 ? "This week went to" : "The last 30 days went to"))
                    .font(lexend(20, "Bold"))
                    .tracking(-0.3)
                    .foregroundColor(theme.text)
                VStack(spacing: 0) {
                    ForEach(apps) { app in
                        VStack(spacing: 8) {
                            HStack(spacing: 10) {
                                if let token = app.token {
                                    Label(token).labelStyle(.iconOnly).frame(width: 22, height: 22)
                                }
                                Text(app.name).font(lexend(15, "Medium")).foregroundColor(theme.text).lineLimit(1)
                                Spacer()
                                Text(duration(app.seconds)).font(lexend(14, "SemiBold")).monospacedDigit().foregroundColor(theme.muted)
                            }
                            GeometryReader { proxy in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(theme.border)
                                    Capsule().fill(theme.accent).frame(width: proxy.size.width * app.seconds / top)
                                }
                            }
                            .frame(height: 6)
                        }
                        .padding(.vertical, 10)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(LinearGradient(colors: theme.card, startPoint: .top, endPoint: .bottom))
                )
            }
        }
    }
}

import SwiftUI
import WidgetKit

struct ActivitySnapshot: Decodable {
    let generated_at: Double
    let active_ms: Double
    let focus_ms: Double
    let state: String
    let focus_label: String?
    let focus_start: Double?
    let focus_target_ms: Double?
    let focus_paused_ms: Double?
    let focus_paused_at: Double?
    static let empty = ActivitySnapshot(generated_at: 0, active_ms: 0, focus_ms: 0, state: "No snapshot", focus_label: nil, focus_start: nil, focus_target_ms: nil, focus_paused_ms: nil, focus_paused_at: nil)
}
struct Entry: TimelineEntry { let date: Date; let snapshot: ActivitySnapshot }
struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { Entry(date: .now, snapshot: .empty) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(read()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [read()], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
    func read() -> Entry {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "HabyssAppGroup") as? String,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group),
              let data = try? Data(contentsOf: container.appendingPathComponent("snapshot.json")),
              let snapshot = try? JSONDecoder().decode(ActivitySnapshot.self, from: data) else { return Entry(date: .now, snapshot: .empty) }
        if !Calendar.current.isDateInToday(Date(timeIntervalSince1970: snapshot.generated_at / 1000)) { return Entry(date: .now, snapshot: .empty) }
        return Entry(date: .now, snapshot: snapshot)
    }
}
func duration(_ ms: Double) -> String { let minutes = Int(max(0, ms) / 60000); return minutes >= 60 ? "\(minutes / 60)h \(minutes % 60)m" : "\(minutes)m" }
struct SnapshotFooter: View {
    let snapshot: ActivitySnapshot
    var body: some View {
        if snapshot.generated_at > 0 {
            HStack(spacing: 3) { Text("As of"); Text(Date(timeIntervalSince1970: snapshot.generated_at / 1000), format: .dateTime.month(.abbreviated).day().hour().minute()) }
                .font(.system(size: 10)).foregroundStyle(.secondary)
        } else { Text("Open Habyss to get started").font(.caption2).foregroundStyle(.secondary) }
    }
}
struct TodayView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack { Image(systemName: "h.square.fill").foregroundStyle(.indigo); Text("Habyss").font(.headline) }
            Spacer(minLength: 0)
            Text(duration(entry.snapshot.active_ms)).font(.system(size: 30, weight: .medium, design: .rounded)).minimumScaleFactor(0.6)
            Text("Active · \(duration(entry.snapshot.focus_ms)) declared focus").font(.system(size: 10)).foregroundStyle(.secondary)
            HStack(spacing: 5) { Circle().fill(entry.snapshot.state == "active" ? Color.green : Color.secondary).frame(width: 5, height: 5); Text(entry.snapshot.state.replacingOccurrences(of: "_", with: " ")).font(.caption2) }
            SnapshotFooter(snapshot: entry.snapshot)
        }.containerBackground(.background, for: .widget).widgetURL(URL(string: "habyss://dashboard"))
    }
}
struct FocusView: View {
    let entry: Entry
    var body: some View {
        HStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 9) {
                Label("Habyss Focus", systemImage: "flag.fill").font(.headline).foregroundStyle(.indigo)
                Text(entry.snapshot.focus_label ?? "Space for what matters").font(.headline).lineLimit(2)
                // Session state is a snapshot: do not show a live timer that can keep running after a crash.
                if let start = entry.snapshot.focus_start {
                    let snap = entry.snapshot
                    // Same formula as focus.rs: wall time minus stored pauses and any open pause.
                    let open = snap.focus_paused_at.map { max(0, snap.generated_at - $0) } ?? 0
                    Text(duration(max(0, snap.generated_at - start - (snap.focus_paused_ms ?? 0) - open))).font(.system(size: 28, weight: .medium, design: .rounded))
                    Text(snap.focus_paused_at != nil ? "Paused" : "Elapsed at last update").font(.caption2).foregroundStyle(.secondary)
                } else { Text("No active focus session").font(.caption).foregroundStyle(.secondary) }
                SnapshotFooter(snapshot: entry.snapshot)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 10) {
                Text(duration(entry.snapshot.focus_ms)).font(.title2).fontWeight(.medium)
                Text("Declared focus\ntoday").font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
                Link(destination: URL(string: "habyss://focus")!) { Label("Open", systemImage: "arrow.up.right").font(.caption) }
            }
        }.containerBackground(.background, for: .widget).widgetURL(URL(string: "habyss://focus"))
    }
}
struct TodayWidget: Widget {
    let kind = "HabyssToday"
    var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: Provider()) { TodayView(entry: $0) }.configurationDisplayName("Habyss Today").description("A private snapshot of today's active and declared focus time.").supportedFamilies([.systemSmall]) }
}
struct FocusWidget: Widget {
    let kind = "HabyssFocus"
    var body: some WidgetConfiguration { StaticConfiguration(kind: kind, provider: Provider()) { FocusView(entry: $0) }.configurationDisplayName("Habyss Focus").description("Your latest focus session snapshot. Open Habyss to manage it.").supportedFamilies([.systemMedium]) }
}
@main struct HabyssWidgets: WidgetBundle { var body: some Widget { TodayWidget(); FocusWidget() } }

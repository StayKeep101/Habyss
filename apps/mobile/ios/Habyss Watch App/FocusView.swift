import SwiftUI
import WatchKit
import Combine

/**
 * Focus on the wrist, for any task or habit: a countdown as long as the
 * timeline gives it (its cut length if it was cut short), a ring that empties
 * as it goes, pause and resume, and Done to finish it. Counted from when it
 * ends, so lowering the wrist and raising it again shows the right time. At
 * zero it taps your wrist and the item is finished.
 */
struct FocusView: View {
    @EnvironmentObject var day: WatchSessionManager
    @Environment(\.dismiss) private var dismiss
    let item: DayItem
    /// Opens the next thing's focus, after this one is done.
    var onNext: (DayItem) -> Void = { _ in }

    @State private var endsAt: Date?
    @State private var left: TimeInterval = 0
    @State private var total: TimeInterval = 0
    @State private var finished = false
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: total > 0 ? CGFloat(remaining / total) : 0)
                    .stroke(Color.habyssAccent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: remaining)
                VStack(spacing: 0) {
                    Text(Self.format(Int(remaining.rounded(.up))))
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                    Text(item.title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
                .padding(.horizontal, 10)
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: 8) {
                Button {
                    if endsAt != nil { pause() } else { start() }
                } label: {
                    Image(systemName: endsAt != nil ? "pause.fill" : "play.fill")
                }
                .disabled(finished)
                .accessibilityLabel(endsAt != nil ? "Pause" : "Start")

                Button {
                    finish()
                } label: {
                    Image(systemName: "arrow.forward")
                }
                .tint(.habyssAccent)
                .accessibilityLabel("Done, next")
            }
        }
        .navigationTitle("Focus")
        .onAppear {
            total = TimeInterval(item.minutes * 60)
            left = total
            start()
        }
        .onReceive(tick) { _ in
            guard let ends = endsAt, !finished else { return }
            if ends <= Date() { left = 0; endsAt = nil; finish() }
        }
    }

    /// Seconds left, from when it ends while running, as saved while paused.
    private var remaining: TimeInterval {
        if let ends = endsAt { return max(0, ends.timeIntervalSinceNow) }
        return left
    }

    private func start() {
        guard !finished, left > 0 else { return }
        endsAt = Date().addingTimeInterval(left)
        HapticService.play(.start)
    }

    private func pause() {
        left = remaining
        endsAt = nil
        HapticService.play(.stop)
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        endsAt = nil
        HapticService.play(.success)
        day.finish(item)
        // Straight on to the next thing in the day, or back to the list when nothing is left.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            if let next = day.next(after: item.id) { onNext(next) } else { dismiss() }
        }
    }

    /// "24:59", "1:05:00".
    static func format(_ seconds: Int) -> String {
        let s = max(0, seconds)
        let (h, m, sec) = (s / 3600, (s % 3600) / 60, s % 60)
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
    }
}

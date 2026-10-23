import SwiftUI

/**
 * The whole watch app: today's tasks and habits in one list, a tap to tick.
 *
 * It used to be five pages stacked vertically, each scrolling inside the
 * pager; scrolling past the end of one fought the pager and crashed. One list,
 * one scroll.
 */
struct ContentView: View {
    @EnvironmentObject var day: WatchSessionManager
    /// The item whose focus timer is open.
    @State private var focusing: DayItem?
    @State private var showPhoneFocus = false

    var body: some View {
        NavigationStack {
            List {
                Header(done: day.doneCount, total: day.totalCount)
                    .listRowBackground(Color.clear)

                // A session running on the phone: the same countdown, here.
                if let focus = day.phoneFocus {
                    Button { showPhoneFocus = true } label: { PhoneFocusRow(focus: focus) }
                        .listRowBackground(RoundedRectangle(cornerRadius: 14).fill(Color.habyssAccent.opacity(0.18)))
                } else if let now = day.current {
                    // What to do now, one tap from its timer.
                    Section("Now") {
                        Button { focusing = now } label: { NowRow(item: now) }
                    }
                }

                if day.totalCount == 0 {
                    Text(day.dayKey.isEmpty ? "Open Habyss on your iPhone to bring today here." : "Nothing set for today.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }

                // Every task and habit, in the order the timeline has them.
                if !day.items.isEmpty {
                    Section("Today") {
                        ForEach(day.items) { item in
                            Row(item: item) { day.toggle(item) }
                                .swipeActions(edge: .trailing) {
                                    Button { focusing = item } label: { Label("Focus", systemImage: "timer") }
                                        .tint(.habyssAccent)
                                }
                        }
                    }
                }

                if day.isStale {
                    Text("From \(day.dayKey). Open Habyss on your iPhone to update.")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Today")
            .navigationDestination(item: $focusing) { item in FocusView(item: item) }
            .navigationDestination(isPresented: $showPhoneFocus) {
                if let focus = day.phoneFocus { PhoneFocusView(focus: focus) }
            }
        }
        .tint(.habyssAccent)
    }
}

/// The one to do now: its name, its time, and the way into its timer.
private struct NowRow: View {
    let item: DayItem
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.title).font(.headline).lineLimit(2)
            HStack(spacing: 4) {
                if item.cut { Image(systemName: "scissors").font(.system(size: 10)) }
                Text(item.timeLabel.isEmpty ? "\(item.minutes) min" : item.timeLabel)
            }
            .font(.caption2).foregroundStyle(.secondary)
            Label("Focus", systemImage: "timer")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.habyssAccent)
                .padding(.top, 2)
        }
        .padding(.vertical, 2)
    }
}

/// The phone's session, as a row: what and how long is left.
private struct PhoneFocusRow: View {
    let focus: PhoneFocus
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Focusing", systemImage: "timer").font(.caption2.weight(.semibold)).foregroundStyle(Color.habyssAccent)
            Text(focus.title).font(.headline).lineLimit(2)
            PhoneClock(focus: focus).font(.system(.title3, design: .rounded).weight(.semibold)).monospacedDigit()
        }
    }
}

/// The phone's countdown (or count up), ticking here from the time it ends.
struct PhoneClock: View {
    let focus: PhoneFocus
    var body: some View {
        if focus.paused {
            Text(FocusView.format(focus.left) + " · paused")
        } else if let ends = focus.endsAt {
            Text(timerInterval: Date()...max(Date(), ends), countsDown: true)
        } else {
            Text(focus.startedAt, style: .timer)
        }
    }
}

/// The phone's session, full screen: the same clock, nothing to press.
private struct PhoneFocusView: View {
    let focus: PhoneFocus
    var body: some View {
        VStack(spacing: 8) {
            Text(focus.title).font(.headline).multilineTextAlignment(.center).lineLimit(3)
            PhoneClock(focus: focus).font(.system(size: 34, weight: .semibold, design: .rounded)).monospacedDigit()
            Text("On your iPhone").font(.caption2).foregroundStyle(.secondary)
        }
        .padding()
    }
}

/// How much of today is done: a ring in the app's accent and the count.
private struct Header: View {
    let done: Int
    let total: Int

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().stroke(Color.white.opacity(0.12), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: total > 0 ? CGFloat(done) / CGFloat(total) : 0)
                    .stroke(Color.habyssAccent, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.4), value: done)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 0) {
                Text("\(done) of \(total)")
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .animation(.default, value: done)
                Text(done == total && total > 0 ? "All done" : "done today")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }
}

/// One thing to do: a circle that fills with the accent when ticked, its time on the timeline beside it.
private struct Row: View {
    let item: DayItem
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .strokeBorder(item.completed ? Color.clear : Color.white.opacity(0.35), lineWidth: 1.5)
                        .background(Circle().fill(item.completed ? Color.habyssAccent : Color.clear))
                    if item.completed {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.black)
                    } else if !item.canTick {
                        Image(systemName: "timer")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 22, height: 22)
                .animation(.spring(duration: 0.25), value: item.completed)

                VStack(alignment: .leading, spacing: 1) {
                    Text(item.title)
                        .font(.system(.body))
                        .lineLimit(2)
                        .strikethrough(item.completed)
                        .foregroundStyle(item.completed ? .secondary : .primary)
                    if !item.timeLabel.isEmpty || item.streak > 0 {
                        HStack(spacing: 3) {
                            if item.cut { Image(systemName: "scissors") }
                            if !item.timeLabel.isEmpty { Text(item.timeLabel) }
                            if item.streak > 0 {
                                Image(systemName: "flame.fill")
                                Text("\(item.streak)").monospacedDigit()
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(item.now && !item.completed ? Color.habyssAccent : .secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 4)
        }
        // A timed habit is finished by its timer: the tap opens nothing, the swipe gives Focus.
        .disabled(!item.canTick)
        .accessibilityLabel("\(item.title), \(item.completed ? "done" : "not done")\(item.timeLabel.isEmpty ? "" : ", " + item.timeLabel)")
    }
}

#Preview {
    ContentView().environmentObject(WatchSessionManager.shared)
}

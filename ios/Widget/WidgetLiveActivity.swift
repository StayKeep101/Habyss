//
//  WidgetLiveActivity.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import ActivityKit
import AppIntents
import WidgetKit
import SwiftUI

struct HabyssLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WidgetAttributes.self) { context in
            // Lock Screen: the focus page, smaller. The ring with the Habyss
            // mark filling as the time goes, then the name and the digits,
            // centred in the room beside it. No "Focus" word: the ring says it.
            // Once its time is up the card shows what comes next, so it never
            // sits on a finished item until the app is opened.
            let state = context.state.current(stale: context.isStale)
            let stale = context.isStale && context.state.nextTitle == nil
            let accent = Color(habyssHex: state.accentHex) ?? Habyss.fallbackTo
            HStack(alignment: .center, spacing: 16) {
                FocusRing(state: state, total: context.attributes.totalDurationSeconds, accent: accent, size: 64, mark: 26)
                VStack(alignment: .center, spacing: 0) {
                    StatusLine(state: state, stale: stale)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundStyle(accent)
                        .lineLimit(1)
                    Text(state.title)
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                    TimeLeft(state: state, stale: stale)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
                DoneButton(state: state, activityName: context.attributes.name, accent: accent)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            // The focus page's night: a little of the sky at the top, black below.
            .background(LinearGradient(colors: [Habyss.night, .black], startPoint: .top, endPoint: .bottom))
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(.white)
            .widgetURL(URL(string: state.url ?? "habyss://home"))

        } dynamicIsland: { context in
            let state = context.state.current(stale: context.isStale)
            let stale = context.isStale && context.state.nextTitle == nil
            let accent = Color(habyssHex: state.accentHex) ?? Habyss.fallbackTo
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    FocusRing(state: state, total: context.attributes.totalDurationSeconds, accent: accent, size: 52, mark: 20)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 0) {
                        StatusLine(state: state, stale: stale)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(accent)
                            .lineLimit(1)
                        TimeLeft(state: state, stale: stale)
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120, alignment: .trailing)
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(state.title)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(Habyss.dim)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        DoneButton(state: state, activityName: context.attributes.name, accent: accent)
                    }
                    .padding(.horizontal, 6)
                }
            } compactLeading: {
                HabyssMark(size: 18)
            } compactTrailing: {
                TimeLeft(state: state, stale: stale)
                    .monospacedDigit()
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(accent)
                    .frame(maxWidth: 56)
                    .minimumScaleFactor(0.8)
            } minimal: {
                FocusRing(state: state, total: context.attributes.totalDurationSeconds, accent: accent, size: 22, mark: 10)
            }
            .widgetURL(URL(string: state.url ?? "habyss://home"))
            .keylineTint(accent)
        }
    }

    func getSharedImage(named filename: String) -> Image? {
        guard let containerUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.habyss.data") else {
            return nil
        }
        let fileUrl = containerUrl.appendingPathComponent(filename)
        if let data = try? Data(contentsOf: fileUrl), let uiImage = UIImage(data: data) {
            return Image(uiImage: uiImage)
        }
        return nil
    }
}

/// The Habyss logo, where the Dynamic Island and the Mac menu bar show the app.
private struct HabyssMark: View {
    var size: CGFloat = 20
    var body: some View {
        Image("HabyssMark")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
    }
}

/// The focus page's ring: the Habyss mark in the middle, the arc filling in your colour as the time goes.
private struct FocusRing: View {
    let state: WidgetAttributes.ContentState
    let total: Double?
    let accent: Color
    let size: CGFloat
    let mark: CGFloat
    var body: some View {
        ZStack {
            Group {
                if let span = interval {
                    ProgressView(timerInterval: span, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                } else {
                    ProgressView(value: min(1, max(0, state.progress)))
                }
            }
            .progressViewStyle(.circular)
            .tint(accent)
            HabyssMark(size: mark)
        }
        .frame(width: size, height: size)
    }

    /// From its start to its end: a focus timer runs back from its end by its length.
    private var interval: ClosedRange<Date>? {
        if let end = state.timerEndDateInMilliseconds, let total, total > 0 {
            let ends = Date(timeIntervalSince1970: end / 1000)
            return ends.addingTimeInterval(-total)...ends
        }
        if let start = state.scheduledStartDateInMilliseconds, let end = state.scheduledEndDateInMilliseconds, end > start {
            return Date(timeIntervalSince1970: start / 1000)...Date(timeIntervalSince1970: end / 1000)
        }
        return nil
    }
}

/// Done, without opening anything: ticks the habit or task on the card and moves the card on.
private struct DoneButton: View {
    let state: WidgetAttributes.ContentState
    let activityName: String
    let accent: Color
    var body: some View {
        if #available(iOS 17.0, *), let item = state.itemId, state.timerEndDateInMilliseconds == nil {
            Button(intent: CompleteNowIntent(itemId: item, activityName: activityName)) {
                // Black on white whatever the accent (21:1); the accent rings it.
                Image(systemName: "checkmark")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.white))
                    .overlay(Circle().stroke(accent, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Done: \(state.title)")
        }
    }
}

/// When it is: "Now · until 6:07 PM", "Next · 6:30 PM", nothing for a focus session, or "Check in" once its time is over.
private struct StatusLine: View {
    let state: WidgetAttributes.ContentState
    let stale: Bool
    var body: some View {
        if stale {
            Text("Check in")
        } else if let start = state.scheduledStartDateInMilliseconds {
            let begins = Date(timeIntervalSince1970: start / 1000)
            if begins > Date() {
                Text("Next · ") + Text(begins, style: .time)
            } else if let end = state.scheduledEndDateInMilliseconds {
                Text("Now · until ") + Text(Date(timeIntervalSince1970: end / 1000), style: .time)
            } else {
                Text("Now")
            }
        } else if state.timerEndDateInMilliseconds != nil {
            // A focus session: the ring already says so, no word needed.
            EmptyView()
        } else {
            Text("\(Int(state.progress * 100))% done")
        }
    }
}

/// The clock: time to its start while it is up next, then time left.
private struct TimeLeft: View {
    let state: WidgetAttributes.ContentState
    let stale: Bool
    var body: some View {
        let now = Date()
        if stale {
            Text("—")
        } else if let end = state.timerEndDateInMilliseconds {
            let ends = Date(timeIntervalSince1970: end / 1000)
            Text(timerInterval: min(now, ends)...ends, countsDown: true)
        } else if let start = state.scheduledStartDateInMilliseconds {
            let begins = Date(timeIntervalSince1970: start / 1000)
            if begins > now {
                Text(timerInterval: now...begins, countsDown: true)
            } else if let end = state.scheduledEndDateInMilliseconds {
                let ends = Date(timeIntervalSince1970: end / 1000)
                Text(timerInterval: min(now, ends)...ends, countsDown: true)
            } else {
                Text("Now")
            }
        } else {
            Text("\(Int(state.progress * 100))%")
        }
    }
}

extension WidgetAttributes {
    fileprivate static var preview: WidgetAttributes {
        WidgetAttributes(name: "Habyss Live Activity", totalDurationSeconds: 3600)
    }
}

extension WidgetAttributes.ContentState {
    fileprivate static var focus: WidgetAttributes.ContentState {
        WidgetAttributes.ContentState(
            title: "Deep Work",
            subtitle: "",
            timerEndDateInMilliseconds: Date().addingTimeInterval(1500).timeIntervalSince1970 * 1000,
            progress: 0.3,
            profileImagePath: nil
        )
     }
     
     fileprivate static var done: WidgetAttributes.ContentState {
         WidgetAttributes.ContentState(
            title: "5/10 Habits",
            subtitle: "Keep going!",
            timerEndDateInMilliseconds: nil,
            progress: 0.5,
            profileImagePath: nil
         )
     }
}

#Preview("Notification", as: .content, using: WidgetAttributes.preview) {
   HabyssLiveActivity()
} contentStates: {
    WidgetAttributes.ContentState.focus
    WidgetAttributes.ContentState.done
}

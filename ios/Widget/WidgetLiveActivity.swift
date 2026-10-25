//
//  WidgetLiveActivity.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct HabyssLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WidgetAttributes.self) { context in
            // Lock Screen: what it is, how long is left, and a thin bar. Nothing else.
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 12) {
                    HabyssMark(size: 26)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.title)
                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        StatusLine(state: context.state, stale: context.isStale)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Habyss.dim)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    TimeLeft(state: context.state, stale: context.isStale)
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 120, alignment: .trailing)
                }
                ActivityProgress(state: context.state)
                    .tint(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            // The app's matte card: lit at the top, falling off below.
            .background(LinearGradient(colors: [Habyss.matteTop, Habyss.matteMid, Habyss.matteBottom], startPoint: .top, endPoint: .bottom))
            .activityBackgroundTint(Habyss.matteMid)
            .activitySystemActionForegroundColor(.white)
            .widgetURL(URL(string: context.state.url ?? "habyss://home"))

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        HabyssMark(size: 22)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(context.state.title).font(.system(size: 15, weight: .semibold, design: .rounded)).lineLimit(1)
                            StatusLine(state: context.state, stale: context.isStale)
                                .font(.system(size: 12, weight: .medium)).foregroundStyle(Habyss.dim).lineLimit(1)
                        }
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimeLeft(state: context.state, stale: context.isStale)
                        .font(.system(size: 22, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 90, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ActivityProgress(state: context.state)
                        .tint(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
                        .padding(.horizontal, 4)
                }
            } compactLeading: {
                if let imagePath = context.state.profileImagePath,
                   let image = getSharedImage(named: imagePath) {
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 20, height: 20)
                        .clipShape(Circle())
                } else {
                    HabyssMark()
                }
            } compactTrailing: {
                TimeLeft(state: context.state, stale: context.isStale)
                    .monospacedDigit()
                    .foregroundStyle(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
                    .frame(maxWidth: 56)
                    .minimumScaleFactor(0.8)
            } minimal: {
                if let imagePath = context.state.profileImagePath,
                   let image = getSharedImage(named: imagePath) {
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 20, height: 20)
                        .clipShape(Circle())
                } else {
                    HabyssMark()
                }
            }
            .widgetURL(URL(string: context.state.url ?? "habyss://home"))
            .keylineTint(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
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

/// When it is: "Now · until 6:07 PM", "Next · 6:30 PM", "Focusing", or "Check in" once its time is over.
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
            Text("Focusing")
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

private struct ActivityProgress: View {
    let state: WidgetAttributes.ContentState
    var body: some View {
        if let start = state.scheduledStartDateInMilliseconds,
           let end = state.scheduledEndDateInMilliseconds, end > start {
            ProgressView(timerInterval: Date(timeIntervalSince1970: start / 1000)...Date(timeIntervalSince1970: end / 1000), countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
        } else {
            ProgressView(value: min(1, max(0, state.progress)))
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

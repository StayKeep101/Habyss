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
            // Lock screen/banner UI
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading) {
                        Text(context.state.title)
                            .font(.headline)
                            .foregroundColor(.white)
                        if context.isStale || !context.state.subtitle.isEmpty {
                            Text(context.isStale ? "Session window finished · check in when you’re ready" : context.state.subtitle)
                                .font(.subheadline)
                                .foregroundColor(.gray)
                        }
                    }
                    Spacer()
                }
                
                // Big Timer for StandBy/Lock Screen
                if let endDate = context.state.timerEndDateInMilliseconds {
                    HStack {
                        Spacer()
                        Text(timerInterval: min(Date(), Date(timeIntervalSince1970: endDate / 1000))...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                            .font(.system(size: 60, weight: .bold)).monospacedDigit()
                            // White, like the big numbers in the app; the colour lives in the progress bar.
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)
                        Spacer()
                    }
                }
                
                if let start = context.state.scheduledStartDateInMilliseconds,
                   let end = context.state.scheduledEndDateInMilliseconds {
                    HStack(spacing: 8) {
                        Image(systemName: "clock")
                        Text(Date(timeIntervalSince1970: start / 1000), style: .time)
                        Text("–")
                        Text(Date(timeIntervalSince1970: end / 1000), style: .time)
                        Spacer()
                        WhenLabel(start: start, stale: context.isStale).font(.caption.weight(.medium))
                    }
                    .font(.subheadline).foregroundStyle(Habyss.dim)
                }
                ActivityProgress(state: context.state)
                    .tint(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
            }
            .padding()
            // The app's matte card: lit at the top, falling off below.
            .background(LinearGradient(colors: [Habyss.matteTop, Habyss.matteMid, Habyss.matteBottom], startPoint: .top, endPoint: .bottom))
            .activityBackgroundTint(Habyss.matteMid)
            .activitySystemActionForegroundColor(.white)
            .widgetURL(URL(string: context.state.url ?? "habyss://home"))

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.title).font(.caption2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    // Timer or Icon
                     if let endDate = context.state.timerEndDateInMilliseconds {
                        Text(timerInterval: min(Date(), Date(timeIntervalSince1970: endDate / 1000))...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 50)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                     // Progress Bar in Expanded
                     VStack {
                         if context.isStale || !context.state.subtitle.isEmpty {
                             Text(context.isStale ? "Session window finished · check in when you’re ready" : context.state.subtitle).font(.caption)
                         }
                         ActivityProgress(state: context.state)
                             .tint(Color(habyssHex: context.state.accentHex) ?? Habyss.fallbackTo)
                     }
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
                if let endDate = context.state.timerEndDateInMilliseconds {
                     Text(timerInterval: min(Date(), Date(timeIntervalSince1970: endDate / 1000))...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                        .monospacedDigit()
                        .frame(maxWidth: 60) // Increased width
                        .minimumScaleFactor(0.8)
                        
                } else {
                    if let start = context.state.scheduledStartDateInMilliseconds {
                        WhenLabel(start: start, stale: context.isStale)
                    } else {
                        Text("\(Int(context.state.progress * 100))%")
                    }
                }
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
    var body: some View {
        Image("HabyssMark")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 20, height: 20)
    }
}

/// "in 12 min" before it starts (the card for what is up next), "Now" while it runs.
private struct WhenLabel: View {
    let start: Double
    let stale: Bool
    var body: some View {
        let date = Date(timeIntervalSince1970: start / 1000)
        if stale {
            Text("Check in")
        } else if date > Date() {
            Text(timerInterval: Date()...date, countsDown: true).monospacedDigit()
        } else {
            Text("Now")
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

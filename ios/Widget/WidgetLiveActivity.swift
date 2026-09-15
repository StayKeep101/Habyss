//
//  WidgetLiveActivity.swift
//  Widget
//
//  Created by erwan on 2026-02-14.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct WidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties
        var title: String
        var subtitle: String
        var timerEndDateInMilliseconds: Double?
        var progress: Double
        var profileImagePath: String?
    }

    // Fixed non-changing properties
    var name: String
    var totalDurationSeconds: Double?
}

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
                        Text(context.state.subtitle)
                            .font(.subheadline)
                            .foregroundColor(.gray)
                    }
                    Spacer()
                }
                
                // Big Timer for StandBy/Lock Screen
                if let endDate = context.state.timerEndDateInMilliseconds {
                    HStack {
                        Spacer()
                        Text(timerInterval: Date()...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                            .font(.system(size: 60, weight: .bold, design: .monospaced)) // HUGE Timer
                            .foregroundColor(.cyan)
                            .multilineTextAlignment(.center)
                        Spacer()
                    }
                }
                
                // Progress Bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.gray.opacity(0.3))
                            .frame(height: 12)
                        
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.cyan)
                            .frame(width: geometry.size.width * CGFloat(context.state.progress), height: 12)
                    }
                }
                .frame(height: 12)
            }
            .padding()
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.title).font(.caption2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    // Timer or Icon
                     if let endDate = context.state.timerEndDateInMilliseconds {
                        Text(timerInterval: Date()...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 50)
                            .monospacedDigit()
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                     // Progress Bar in Expanded
                     VStack {
                         Text(context.state.subtitle).font(.caption)
                         ProgressView(value: context.state.progress)
                             .tint(.cyan)
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
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.cyan)
                }
            } compactTrailing: {
                if let endDate = context.state.timerEndDateInMilliseconds {
                     Text(timerInterval: Date()...Date(timeIntervalSince1970: endDate / 1000), countsDown: true)
                        .monospacedDigit()
                        .frame(maxWidth: 60) // Increased width
                        .minimumScaleFactor(0.8)
                        
                } else {
                    Text("\(Int(context.state.progress * 100))%")
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
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.cyan)
                }
            }
            .widgetURL(URL(string: "habyss://home"))
            .keylineTint(Color.cyan)
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

extension WidgetAttributes {
    fileprivate static var preview: WidgetAttributes {
        WidgetAttributes(name: "Habyss Live Activity", totalDurationSeconds: 3600)
    }
}

extension WidgetAttributes.ContentState {
    fileprivate static var focus: WidgetAttributes.ContentState {
        WidgetAttributes.ContentState(
            title: "Deep Work",
            subtitle: "Focusing...",
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

import ActivityKit
import WidgetKit
import SwiftUI

struct HabyssLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveActivityAttributes.self) { context in
            // Lock Screen / Banner UI
            ZStack {
                ContainerRelativeShape()
                    .fill(Color(red: 0.05, green: 0.05, blue: 0.1)) // Deep Void background
                
                HStack {
                    // Left: Icon / Name
                    VStack(alignment: .leading) {
                        HStack(spacing: 6) {
                            Image(systemName: "flame.fill")
                                .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96)) // Purple
                            Text(context.state.title)
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                        if let subtitle = context.state.subtitle {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                    }
                    
                    Spacer()
                    
                    // Right: Timer
                    VStack(alignment: .trailing) {
                        if let endDateMillis = context.state.timerEndDateInMilliseconds {
                            Text(timerInterval: Date()...Date(timeIntervalSince1970: endDateMillis / 1000), countsDown: true)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                                .font(.system(size: 24, weight: .bold))
                                .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96)) // Purple accent
                        }
                    }
                }
                .padding()
            }
            .activityBackgroundTint(Color(red: 0.05, green: 0.05, blue: 0.1))
            .activitySystemActionForegroundColor(Color.white)
            
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: "flame.fill")
                            .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                        Text(context.state.title)
                            .font(.caption)
                            .foregroundColor(.white)
                    }
                    .padding(.leading, 8)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let endDateMillis = context.state.timerEndDateInMilliseconds {
                        Text(timerInterval: Date()...Date(timeIntervalSince1970: endDateMillis / 1000), countsDown: true)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .font(.headline)
                            .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                            .padding(.trailing, 8)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Optional bottom region
                }
            } compactLeading: {
                Image(systemName: "flame.fill")
                    .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                    .padding(.leading, 4)
            } compactTrailing: {
                if let endDateMillis = context.state.timerEndDateInMilliseconds {
                    Text(timerInterval: Date()...Date(timeIntervalSince1970: endDateMillis / 1000), countsDown: true)
                        .monospacedDigit()
                        .font(.caption2)
                        .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
                        .frame(maxWidth: 40)
                        .padding(.trailing, 4)
                }
            } minimal: {
                Image(systemName: "flame.fill")
                    .foregroundColor(Color(red: 0.55, green: 0.36, blue: 0.96))
            }
        }
    }
}

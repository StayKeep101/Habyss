import SwiftUI

struct ProgressRingsView: View {
    @EnvironmentObject var session: WatchSessionManager
    
    // Computed progress values
    var dailyProgress: Double {
        let total = session.habits.count
        guard total > 0 else { return 0 }
        let completed = session.habits.filter(\.isCompletedToday).count
        return Double(completed) / Double(total)
    }
    
    // Weekly and monthly are estimates based on today's data
    // In a full implementation, these would use historical data from the phone
    var weeklyProgress: Double {
        // Approximate: use daily + streak info as a signal
        let avgStreak = session.habits.isEmpty ? 0.0 : Double(session.habits.map(\.streakCount).reduce(0, +)) / Double(session.habits.count)
        return min(avgStreak / 7.0, 1.0) * 0.8 + dailyProgress * 0.2
    }
    
    var monthlyProgress: Double {
        let avgStreak = session.habits.isEmpty ? 0.0 : Double(session.habits.map(\.streakCount).reduce(0, +)) / Double(session.habits.count)
        return min(avgStreak / 30.0, 1.0) * 0.7 + dailyProgress * 0.3
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Three nested activity rings
                ZStack {
                    // Monthly ring (outer)
                    ProgressRingLayer(
                        progress: monthlyProgress,
                        radius: 52,
                        color: .habyssGreen,
                        lineWidth: 9
                    )
                    // Weekly ring (middle)
                    ProgressRingLayer(
                        progress: weeklyProgress,
                        radius: 38,
                        color: .habyssIndigo,
                        lineWidth: 9
                    )
                    // Daily ring (inner)
                    ProgressRingLayer(
                        progress: dailyProgress,
                        radius: 24,
                        color: .habyssBlue,
                        lineWidth: 9
                    )
                }
                .frame(width: 120, height: 120)
                .padding(.vertical, 8)
                
                // Legend
                VStack(alignment: .leading, spacing: 6) {
                    RingLegendRow(color: .habyssBlue,   label: "Today",      value: dailyProgress)
                    RingLegendRow(color: .habyssIndigo, label: "This Week",  value: weeklyProgress)
                    RingLegendRow(color: .habyssGreen,  label: "This Month", value: monthlyProgress)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
        }
        .navigationTitle("Progress")
    }
}

// MARK: - Ring Layer

struct ProgressRingLayer: View {
    let progress: Double
    let radius: CGFloat
    let color: Color
    let lineWidth: CGFloat
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.15), lineWidth: lineWidth)
                .frame(width: radius * 2, height: radius * 2)
            
            Circle()
                .trim(from: 0, to: min(progress, 1.0))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .frame(width: radius * 2, height: radius * 2)
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.8, dampingFraction: 0.7), value: progress)
        }
    }
}

// MARK: - Legend Row

struct RingLegendRow: View {
    let color: Color
    let label: String
    let value: Double
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            
            Text(label)
                .font(.system(.caption2, design: .rounded))
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text("\(Int(value * 100))%")
                .font(.system(.caption2, design: .rounded, weight: .bold))
                .foregroundColor(color)
        }
    }
}
